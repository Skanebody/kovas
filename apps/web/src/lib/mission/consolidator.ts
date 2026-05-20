/**
 * KOVAS — Service Consolidator (Capture-First V1.5 iteration 5).
 *
 * Service SERVEUR UNIQUEMENT (ANTHROPIC_API_KEY). NE JAMAIS importer côté client.
 *
 * Stratégie :
 * - Modèle : claude-sonnet-4-6 (capacité de raisonnement supérieure à Haiku pour
 *   consolider une masse de signaux cross-sources + détecter conflits + planifier
 *   les manques).
 * - Tool use forcé sur `consolidate_dossier_data` pour garantir une sortie structurée.
 * - Prompt caching `ephemeral` (1h TTL) sur le system block — les schémas DPE+AMIANTE
 *   complets pèsent ~5-6k tokens. Le cache réduit le coût des appels suivants sur le
 *   MÊME diagnostics_signature de 60-90%. Au prochain appel du même dossier (ex : après
 *   ajout de 3 photos puis re-consolidation), c'est 90% gratuit.
 * - Retry exponentiel sur erreurs réseau / 429 / 5xx (max 3 tentatives, 800ms / 1.6s / 3.2s).
 *
 * Authority : CLAUDE.md §3 features 1-5-7 + §7bis (autonomisation IA progressive).
 *
 * Coût indicatif Sonnet 4.6 (à confirmer sur https://www.anthropic.com/pricing) :
 * - input  : 3.00 USD / 1M tokens
 * - output : 15.00 USD / 1M tokens
 * - cache write : 3.75 USD / 1M tokens (1.25x input)
 * - cache read  : 0.30 USD / 1M tokens (10% input)
 *
 * Ordre de grandeur sur un dossier moyen (50 photos analysées + 10 voice notes + 2 docs) :
 * - 1er appel (cache cold)   : ~0.10 USD (8k input + 6k output + 6k cache write)
 * - 2e appel (cache hit) ≈   : ~0.05 USD (1k input + 6k output + 6k cache read)
 */

import Anthropic from '@anthropic-ai/sdk'
import { SCHEMAS_BY_DIAGNOSTIC } from './diagnostic-schemas'
import type {
  DiagnosticType,
  FieldSourceType,
  FieldValuePayload,
  VisionAnalysisResult,
} from './types'

const CONSOLIDATION_MODEL = process.env.ANTHROPIC_CONSOLIDATION_MODEL ?? 'claude-sonnet-4-6'

// ============================================
// Pricing — Claude Sonnet 4.6 (USD per 1M tokens)
// ============================================
// Source : https://www.anthropic.com/pricing (Sonnet 4.6 tier).
// TODO VALIDATION : confirmer ces prix avant production.
const PRICE_INPUT_PER_M_USD = 3.0
const PRICE_OUTPUT_PER_M_USD = 15.0
const PRICE_CACHE_WRITE_PER_M_USD = 3.75 // 1.25x input
const PRICE_CACHE_READ_PER_M_USD = 0.3 // 10% input

// ============================================
// Configuration retry
// ============================================
const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 800

// ============================================
// Tool : consolidate_dossier_data
// ============================================

const CONSOLIDATION_TOOL: Anthropic.Tool = {
  name: 'consolidate_dossier_data',
  description:
    'Consolide toutes les sources de données collectées (photos analysées + voice + texte + docs) en un dossier complet pour les diagnostics réglementaires français.',
  input_schema: {
    type: 'object',
    required: [
      'fields_by_diagnostic',
      'conflicts',
      'missing_required',
      'global_confidence',
      'summary',
    ],
    properties: {
      fields_by_diagnostic: {
        type: 'object',
        description:
          "Map diagnostic (DPE, AMIANTE, ...) → array de champs consolidés. N'inclure QUE les diagnostics actifs sur ce dossier.",
        additionalProperties: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'diagnostic',
              'field_path',
              'value',
              'source_type',
              'confidence',
              'rationale',
            ],
            properties: {
              diagnostic: {
                type: 'string',
                enum: ['DPE', 'AMIANTE', 'PLOMB', 'GAZ', 'ELEC', 'TERMITES', 'CARREZ', 'ERP'],
              },
              field_path: {
                type: 'string',
                description:
                  "Chemin exact du champ tel qu'il apparaît dans le schéma du diagnostic.",
              },
              value: {
                description:
                  'Valeur consolidée. Type doit correspondre au kind du champ : string pour enum/string/year, number, boolean, ou null si information indéterminable.',
              },
              unit: {
                type: ['string', 'null'],
                description: 'Unité si applicable (cm, m², kW, %). null sinon.',
              },
              source_type: {
                type: 'string',
                enum: [
                  'photo_vision',
                  'voice_extraction',
                  'text_extraction',
                  'document_ocr',
                  'manual_entry',
                  'inferred_ai',
                  'calculated',
                ],
                description:
                  'Source primaire qui a permis la consolidation. inferred_ai = extrapolation Claude pure (rare et marquée confidence < 0.6).',
              },
              primary_source_id: {
                type: 'string',
                description:
                  'UUID de la source primaire (photo_id, voice_id, text_id, document_id). Vide si manual_entry ou inferred_ai.',
              },
              supporting_source_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'UUIDs des autres sources qui confirment la valeur.',
              },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              rationale: {
                type: 'string',
                description:
                  'Explication brève en français (max 240 caractères) de comment la valeur a été déterminée à partir des sources.',
              },
            },
          },
        },
      },
      conflicts: {
        type: 'array',
        description:
          'Liste des champs où plusieurs sources se contredisent. Pour chaque conflit : candidats + suggestion de résolution.',
        items: {
          type: 'object',
          required: ['diagnostic', 'field_path', 'candidates', 'suggested_resolution'],
          properties: {
            diagnostic: { type: 'string' },
            field_path: { type: 'string' },
            candidates: {
              type: 'array',
              minItems: 2,
              items: {
                type: 'object',
                required: ['value', 'source_type', 'confidence', 'rationale'],
                properties: {
                  value: {},
                  source_type: { type: 'string' },
                  source_id: { type: 'string' },
                  confidence: { type: 'number', minimum: 0, maximum: 1 },
                  rationale: { type: 'string' },
                },
              },
            },
            suggested_resolution: {
              type: 'string',
              enum: ['keep_highest_confidence', 'manual_review_required'],
            },
          },
        },
      },
      missing_required: {
        type: 'array',
        description: 'Champs marqués required dans les schémas et non collectés.',
        items: {
          type: 'object',
          required: ['diagnostic', 'field_path', 'label', 'why_required', 'suggestion'],
          properties: {
            diagnostic: { type: 'string' },
            field_path: { type: 'string' },
            label: {
              type: 'string',
              description: 'Label humain du champ (ex: Ventilation, Production ECS).',
            },
            why_required: {
              type: 'string',
              description: 'Pourquoi obligatoire pour ce diagnostic (1 phrase).',
            },
            suggestion: {
              type: 'string',
              description:
                "Action concrète FR : 'Capturer une photo du tableau électrique', 'Demander la dernière facture EDF', 'Saisir manuellement la surface habitable'.",
            },
          },
        },
      },
      global_confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confiance globale du dossier après consolidation.',
      },
      summary: {
        type: 'string',
        description:
          'Synthèse 2-3 phrases en français sur la qualité du dossier (complétude, fiabilité, points bloquants).',
      },
    },
  },
}

// ============================================
// API du module
// ============================================

export interface ConsolidationInput {
  dossier: {
    id: string
    reference: string
    property: {
      address?: string
      year_built?: number
      surface_total?: number
      property_type?: string
    }
    client_name?: string
  }
  activeDiagnostics: DiagnosticType[]
  photos: Array<{
    id: string
    room_name: string | null
    captured_at: string
    vision_analysis: VisionAnalysisResult | null
    vision_confidence: number | null
  }>
  voiceNotes: Array<{
    id: string
    attached_photo_id: string | null
    transcript_raw: string | null
    transcript_structured: Record<string, unknown> | null
    room_name: string | null
  }>
  textNotes: Array<{
    id: string
    attached_photo_id: string | null
    text: string
    room_name: string | null
  }>
  ownerDocuments: Array<{
    id: string
    doc_kind: string
    extracted_data: Record<string, unknown> | null
  }>
}

export interface ConsolidationOutput {
  result: ConsolidatedDossier
  costUsd: number
  model: string
  durationMs: number
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
}

export interface ConsolidatedField {
  diagnostic: DiagnosticType
  field_path: string
  value: FieldValuePayload
  unit: string | null
  source_type: FieldSourceType
  primary_source_id: string | null
  supporting_source_ids: string[]
  confidence: number
  rationale: string
}

export interface ConflictReportCandidate {
  value: FieldValuePayload
  source_type: string
  source_id: string | null
  confidence: number
  rationale: string
}

export interface ConflictReport {
  diagnostic: DiagnosticType
  field_path: string
  candidates: ConflictReportCandidate[]
  suggested_resolution: 'keep_highest_confidence' | 'manual_review_required'
}

export interface MissingField {
  diagnostic: DiagnosticType
  field_path: string
  label: string
  why_required: string
  suggestion: string
}

export type ConsolidatedFieldsByDiagnostic = Partial<Record<DiagnosticType, ConsolidatedField[]>>

export interface ConsolidatedDossier {
  fields_by_diagnostic: ConsolidatedFieldsByDiagnostic
  conflicts: ConflictReport[]
  missing_required: MissingField[]
  global_confidence: number
  summary: string
}

/**
 * Consolide toutes les sources d'un dossier (photos + voix + texte + docs)
 * en un seul appel Claude Sonnet 4.6. Retourne :
 * - valeurs consolidées par champ avec source primaire + confiance + rationale
 * - conflits identifiés
 * - champs obligatoires manquants + suggestions
 * - synthèse + confiance globale
 *
 * Throw `ConsolidationError` si toutes les tentatives échouent.
 */
export async function consolidateDossier(input: ConsolidationInput): Promise<ConsolidationOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ConsolidationError('ANTHROPIC_API_KEY not configured', 'config_missing')
  }
  if (input.activeDiagnostics.length === 0) {
    throw new ConsolidationError(
      'activeDiagnostics is empty — at least one diagnostic must be active',
      'invalid_input',
    )
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const systemPrompt = buildSystemPrompt(input)
  const userContent = buildUserContent(input)

  let lastError: unknown = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const t0 = Date.now()
    try {
      const response = await client.messages.create({
        model: CONSOLIDATION_MODEL,
        max_tokens: 8000,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [CONSOLIDATION_TOOL],
        tool_choice: { type: 'tool', name: 'consolidate_dossier_data' },
        messages: [
          {
            role: 'user',
            content: userContent,
          },
        ],
      })

      const durationMs = Date.now() - t0

      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      )
      if (!toolUseBlock) {
        throw new ConsolidationError(
          'Claude did not return a tool_use block despite forced tool_choice',
          'parse_failed',
        )
      }

      const parsed = parseToolResponse(toolUseBlock.input, input.activeDiagnostics)

      const inputTokens = response.usage.input_tokens
      const outputTokens = response.usage.output_tokens
      const cacheCreationTokens = response.usage.cache_creation_input_tokens ?? 0
      const cacheReadTokens = response.usage.cache_read_input_tokens ?? 0
      const costUsd = computeCostUsd(
        inputTokens,
        outputTokens,
        cacheCreationTokens,
        cacheReadTokens,
      )

      return {
        result: parsed,
        costUsd,
        model: CONSOLIDATION_MODEL,
        durationMs,
        inputTokens,
        outputTokens,
        cacheCreationTokens,
        cacheReadTokens,
      }
    } catch (err) {
      lastError = err
      if (!isRetryableError(err) || attempt === MAX_ATTEMPTS) {
        break
      }
      const delay = BASE_BACKOFF_MS * 2 ** (attempt - 1)
      await sleep(delay)
    }
  }

  const msg = lastError instanceof Error ? lastError.message : 'unknown consolidation error'
  throw new ConsolidationError(
    `Consolidation failed after ${MAX_ATTEMPTS} attempts : ${msg}`,
    'api_failed',
  )
}

// ============================================
// Errors
// ============================================

export type ConsolidationErrorCode =
  | 'config_missing'
  | 'invalid_input'
  | 'parse_failed'
  | 'api_failed'

export class ConsolidationError extends Error {
  readonly code: ConsolidationErrorCode

  constructor(message: string, code: ConsolidationErrorCode) {
    super(message)
    this.name = 'ConsolidationError'
    this.code = code
  }
}

// ============================================
// Helpers internes
// ============================================

function buildSystemPrompt(input: ConsolidationInput): string {
  // Sérialise les schémas complets des diagnostics actifs. Les schémas étant
  // mis en cache 1h via cache_control:ephemeral, c'est le bloc qu'on veut
  // gros et stable. Le user message porte les données du dossier (volatiles).
  const schemasSerialized = input.activeDiagnostics
    .map((diag) => {
      const schema = SCHEMAS_BY_DIAGNOSTIC[diag]
      if (!schema) {
        return `### ${diag}\n(Schéma non encore implémenté côté KOVAS — pas de field_hint à produire pour ce type.)`
      }
      return `### ${diag} (version ${schema.version})\n${schema.description}\n\n\`\`\`json\n${JSON.stringify(
        schema.sections,
        null,
        2,
      )}\n\`\`\``
    })
    .join('\n\n')

  return `Tu es l'expert chargé de consolider les données collectées par un diagnostiqueur immobilier français pour produire un dossier complet et fiable pour ses diagnostics réglementaires.

MISSION :
1. Consolide toutes les sources (photos Vision IA, transcriptions vocales, notes texte, OCR documents) en valeurs cohérentes par champ.
2. Identifie les CONFLITS (sources différentes pour le même champ avec des valeurs incompatibles).
3. Pour chaque valeur consolidée : source primaire + confiance 0-1 + rationale (FR) brève.
4. Identifie clairement les champs OBLIGATOIRES (required:true dans le schéma) NON collectés.
5. Pour chaque manque, suggère une action concrète et actionnable (photo ciblée à prendre, doc à demander, saisie manuelle).
6. N'INVENTE JAMAIS une donnée manquante : préférer null + déclaration en missing_required.

RÈGLES DE COHÉRENCE :
- Surface habitable ≈ surface Carrez (peuvent différer 5-10%, ne PAS marquer conflit dans cette plage).
- Année construction : prioriser cadastre > ancien DPE > déclaration propriétaire > note diag.
- Marque/modèle chaudière : photo directe (plaque signalétique) > note vocale > ancien DPE.
- Enums strictes : utilise UNIQUEMENT les valeurs autorisées dans les schémas (options.value).
- Si source vocale + photo confirment → confidence très haute (0.95+).
- Si seule source vocale sans photo → confidence moyenne (0.7-0.85).
- Si extrapolation IA pure → source_type='inferred_ai' avec confidence < 0.6 (à éviter).
- Si une photo est marquée non pertinente (relevant=false), ignore ses field_hints.
- Si un champ existe seulement dans un voice transcript sans value claire (juste mention) → confidence 0.65, source_type='voice_extraction'.

DIAGNOSTICS ACTIFS DU DOSSIER : ${input.activeDiagnostics.join(', ')}

SCHÉMAS COMPLETS DES DIAGNOSTICS ACTIFS :
${schemasSerialized}

CONTRAINTES SORTIE :
- Tu DOIS utiliser l'outil "consolidate_dossier_data".
- N'inclus dans fields_by_diagnostic QUE les diagnostics actifs listés ci-dessus.
- Les field_path DOIVENT correspondre EXACTEMENT aux paths des schémas (sinon ils seront filtrés côté app).
- N'écris JAMAIS de texte libre en dehors du tool call.`
}

function buildUserContent(input: ConsolidationInput): Anthropic.TextBlockParam[] {
  // Le user message porte les données dossier (volatiles, ne profitent pas du cache).
  // On les sérialise en JSON compact pour limiter les tokens.
  const payload = {
    dossier: {
      reference: input.dossier.reference,
      property: input.dossier.property,
      client_name: input.dossier.client_name ?? null,
    },
    photos_with_analysis: input.photos.map((p) => ({
      id: p.id,
      room: p.room_name,
      captured_at: p.captured_at,
      vision_confidence: p.vision_confidence,
      analysis: p.vision_analysis
        ? {
            relevant: p.vision_analysis.relevant,
            primary_subject: p.vision_analysis.primarySubject,
            caption: p.vision_analysis.caption,
            field_hints: p.vision_analysis.fieldHints.map((h) => ({
              diagnostic: h.diagnosticType,
              field_path: h.fieldPath,
              value: h.value,
              unit: h.unit,
              confidence: h.confidence,
              rationale: h.rationale,
            })),
          }
        : null,
    })),
    voice_transcriptions: input.voiceNotes.map((v) => ({
      id: v.id,
      attached_photo_id: v.attached_photo_id,
      room: v.room_name,
      transcript: v.transcript_raw,
      structured: v.transcript_structured,
    })),
    text_notes: input.textNotes.map((t) => ({
      id: t.id,
      attached_photo_id: t.attached_photo_id,
      room: t.room_name,
      text: t.text,
    })),
    documents_ocr: input.ownerDocuments.map((d) => ({
      id: d.id,
      doc_kind: d.doc_kind,
      extracted_data: d.extracted_data,
    })),
  }

  return [
    {
      type: 'text',
      text: `Voici toutes les données collectées sur le dossier ${input.dossier.reference}.

Consolide-les en suivant strictement les schémas et les règles fournis. Renvoie le résultat via l'outil consolidate_dossier_data.

\`\`\`json
${JSON.stringify(payload, null, 2)}
\`\`\``,
    },
  ]
}

const VALID_DIAGS: ReadonlySet<DiagnosticType> = new Set<DiagnosticType>([
  'DPE',
  'AMIANTE',
  'PLOMB',
  'GAZ',
  'ELEC',
  'TERMITES',
  'CARREZ',
  'ERP',
])

const VALID_SOURCE_TYPES: ReadonlySet<FieldSourceType> = new Set<FieldSourceType>([
  'photo_vision',
  'voice_extraction',
  'text_extraction',
  'document_ocr',
  'manual_entry',
  'imported_liciel',
  'inferred_ai',
  'calculated',
])

/**
 * Parse + valide la réponse du tool. Filtre :
 * - les diagnostics retournés par Claude hors de activeDiagnostics (défense
 *   contre hallucination cross-diag).
 * - les confidences hors plage [0,1].
 * - les source_type inconnus.
 */
function parseToolResponse(
  input: unknown,
  activeDiagnostics: DiagnosticType[],
): ConsolidatedDossier {
  if (!isRecord(input)) {
    throw new ConsolidationError('Tool response is not an object', 'parse_failed')
  }

  const activeSet = new Set(activeDiagnostics)

  // ---- fields_by_diagnostic ----
  const fieldsByDiagnostic: ConsolidatedFieldsByDiagnostic = {}
  const rawFields = isRecord(input.fields_by_diagnostic) ? input.fields_by_diagnostic : {}

  for (const [diag, rawList] of Object.entries(rawFields)) {
    if (!VALID_DIAGS.has(diag as DiagnosticType)) continue
    const diagType = diag as DiagnosticType
    if (!activeSet.has(diagType)) continue // défense : Claude ne doit pas inventer un diag hors scope
    if (!Array.isArray(rawList)) continue

    const fields: ConsolidatedField[] = []
    for (const raw of rawList) {
      if (!isRecord(raw)) continue
      const path = raw.field_path
      if (typeof path !== 'string' || path.length === 0) continue

      const confidence = typeof raw.confidence === 'number' ? raw.confidence : null
      if (confidence === null || confidence < 0 || confidence > 1) continue

      const sourceType = raw.source_type
      if (
        typeof sourceType !== 'string' ||
        !VALID_SOURCE_TYPES.has(sourceType as FieldSourceType)
      ) {
        continue
      }

      if (!('value' in raw)) continue

      const supportingIds = Array.isArray(raw.supporting_source_ids)
        ? raw.supporting_source_ids.filter((x): x is string => typeof x === 'string')
        : []

      fields.push({
        diagnostic: diagType,
        field_path: path,
        value: raw.value as FieldValuePayload,
        unit: typeof raw.unit === 'string' ? raw.unit : null,
        source_type: sourceType as FieldSourceType,
        primary_source_id:
          typeof raw.primary_source_id === 'string' && raw.primary_source_id.length > 0
            ? raw.primary_source_id
            : null,
        supporting_source_ids: supportingIds,
        confidence,
        rationale: typeof raw.rationale === 'string' ? raw.rationale.slice(0, 240) : '',
      })
    }

    if (fields.length > 0) {
      fieldsByDiagnostic[diagType] = fields
    }
  }

  // ---- conflicts ----
  const conflicts: ConflictReport[] = []
  const rawConflicts = Array.isArray(input.conflicts) ? input.conflicts : []
  for (const raw of rawConflicts) {
    if (!isRecord(raw)) continue
    const diag = raw.diagnostic
    const path = raw.field_path
    if (typeof diag !== 'string' || !VALID_DIAGS.has(diag as DiagnosticType)) continue
    if (!activeSet.has(diag as DiagnosticType)) continue
    if (typeof path !== 'string' || path.length === 0) continue

    const rawCandidates = Array.isArray(raw.candidates) ? raw.candidates : []
    const candidates: ConflictReportCandidate[] = []
    for (const rc of rawCandidates) {
      if (!isRecord(rc)) continue
      if (!('value' in rc)) continue
      const cConf = typeof rc.confidence === 'number' ? rc.confidence : null
      if (cConf === null || cConf < 0 || cConf > 1) continue
      candidates.push({
        value: rc.value as FieldValuePayload,
        source_type: typeof rc.source_type === 'string' ? rc.source_type : 'inferred_ai',
        source_id:
          typeof rc.source_id === 'string' && rc.source_id.length > 0 ? rc.source_id : null,
        confidence: cConf,
        rationale: typeof rc.rationale === 'string' ? rc.rationale.slice(0, 240) : '',
      })
    }
    if (candidates.length < 2) continue // un conflit suppose 2+ candidats

    const suggested = raw.suggested_resolution
    const suggestedResolution: ConflictReport['suggested_resolution'] =
      suggested === 'manual_review_required' ? 'manual_review_required' : 'keep_highest_confidence'

    conflicts.push({
      diagnostic: diag as DiagnosticType,
      field_path: path,
      candidates,
      suggested_resolution: suggestedResolution,
    })
  }

  // ---- missing_required ----
  const missing: MissingField[] = []
  const rawMissing = Array.isArray(input.missing_required) ? input.missing_required : []
  for (const raw of rawMissing) {
    if (!isRecord(raw)) continue
    const diag = raw.diagnostic
    const path = raw.field_path
    if (typeof diag !== 'string' || !VALID_DIAGS.has(diag as DiagnosticType)) continue
    if (!activeSet.has(diag as DiagnosticType)) continue
    if (typeof path !== 'string' || path.length === 0) continue

    missing.push({
      diagnostic: diag as DiagnosticType,
      field_path: path,
      label: typeof raw.label === 'string' ? raw.label : path,
      why_required: typeof raw.why_required === 'string' ? raw.why_required.slice(0, 280) : '',
      suggestion: typeof raw.suggestion === 'string' ? raw.suggestion.slice(0, 280) : '',
    })
  }

  // ---- global_confidence + summary ----
  const globalConfidence =
    typeof input.global_confidence === 'number' &&
    input.global_confidence >= 0 &&
    input.global_confidence <= 1
      ? input.global_confidence
      : 0
  const summary = typeof input.summary === 'string' ? input.summary.slice(0, 1000) : ''

  return {
    fields_by_diagnostic: fieldsByDiagnostic,
    conflicts,
    missing_required: missing,
    global_confidence: globalConfidence,
    summary,
  }
}

function computeCostUsd(
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number,
): number {
  // inputTokens inclut déjà cache_creation + cache_read (convention Anthropic).
  // On déduit donc pour ne pas double-compter.
  const billableInput = Math.max(0, inputTokens - cacheCreationTokens - cacheReadTokens)
  const cost =
    (billableInput / 1_000_000) * PRICE_INPUT_PER_M_USD +
    (cacheCreationTokens / 1_000_000) * PRICE_CACHE_WRITE_PER_M_USD +
    (cacheReadTokens / 1_000_000) * PRICE_CACHE_READ_PER_M_USD +
    (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_M_USD
  return Math.round(cost * 1_000_000) / 1_000_000
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    if (err.status === 429) return true
    if (typeof err.status === 'number' && err.status >= 500 && err.status < 600) return true
    return false
  }
  if (err instanceof ConsolidationError) {
    return false
  }
  // Erreurs réseau bas niveau — retry.
  return true
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
