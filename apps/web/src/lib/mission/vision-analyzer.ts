/**
 * KOVAS — Service Vision IA pour le mode Capture-First (V1.5 iteration 3).
 *
 * Service SERVEUR UNIQUEMENT (ANTHROPIC_API_KEY). NE JAMAIS importer côté client.
 *
 * Stratégie :
 * - Modèle : claude-haiku-4-5 (rapide + low cost).
 * - Tool use forcé sur `extract_photo_analysis` pour garantir une sortie structurée.
 * - Prompt caching `ephemeral` (1h TTL) sur le system block — les schémas DPE/AMIANTE
 *   font ~3-5k tokens, le cache réduit le coût des appels suivants de 60-90%.
 * - Retry exponentiel sur erreurs réseau / 429 / 5xx (max 3 tentatives).
 *
 * Authority : CLAUDE.md §3 feature 1 (parser hybride) + §7bis (autonomisation IA progressive).
 *
 * TODO : confirmer prix exact sur https://www.anthropic.com/pricing avant prod.
 */

import Anthropic from '@anthropic-ai/sdk'
import { SCHEMAS_BY_DIAGNOSTIC } from './diagnostic-schemas'
import type { DiagnosticType, VisionAnalysisFieldHint, VisionAnalysisResult } from './types'

const VISION_MODEL = process.env.ANTHROPIC_VISION_MODEL ?? 'claude-haiku-4-5'

// ============================================
// Pricing — Claude Haiku 4.5 (USD per 1M tokens)
// ============================================
// Source : https://www.anthropic.com/pricing (Haiku 4.5 tier).
// TODO VALIDATION : confirmer ces prix avant production. Les valeurs sont basées
// sur la tarification publique au moment du dev iteration 3.
const PRICE_INPUT_PER_M_USD = 1.0 // $1.00 / 1M input tokens
const PRICE_OUTPUT_PER_M_USD = 5.0 // $5.00 / 1M output tokens
const PRICE_CACHE_WRITE_PER_M_USD = 1.25 // 1.25x input pour cache write (5min/1h)
const PRICE_CACHE_READ_PER_M_USD = 0.1 // 10% input pour cache read

// ============================================
// Configuration retry
// ============================================
const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 800

// ============================================
// Tool : extract_photo_analysis
// ============================================
// L'`input_schema` est volontairement permissif sur les `field_hints` car Claude
// doit pouvoir produire des paths libres (basés sur les schémas injectés dans le
// system prompt). Le format strict est validé côté app via TS (VisionAnalysisFieldHint).

const EXTRACT_PHOTO_TOOL: Anthropic.Tool = {
  name: 'extract_photo_analysis',
  description:
    "Extrait les informations exploitables d'une photo terrain prise par un diagnostiqueur immobilier (DPE, amiante, ...).",
  input_schema: {
    type: 'object',
    properties: {
      relevant: {
        type: 'boolean',
        description:
          'true si la photo contient des informations exploitables pour un des diagnostics actifs ; false sinon (photo non pertinente, illisible, sans intérêt métier).',
      },
      primary_subject: {
        type: 'string',
        description:
          "Sujet principal identifié sur la photo (ex: 'chaudiere_gaz', 'tableau_electrique', 'piece_vue_generale', 'menuiserie_pvc', 'isolant_combles', 'dalle_sol_suspecte_amiante', 'plaque_signaletique', ...). Null si non identifiable.",
      },
      caption: {
        type: 'string',
        description:
          "Caption courte en français (max 200 caractères) décrivant ce qui est visible. Sert au cockpit pour l'utilisateur.",
      },
      field_hints: {
        type: 'array',
        description:
          "Liste des champs détectés à insérer dans dossier_field_values. JAMAIS inventer une valeur. confidence < 0.7 = champ douteux (sera proposé à l'utilisateur sans écraser une valeur validée).",
        items: {
          type: 'object',
          properties: {
            diagnostic_type: {
              type: 'string',
              enum: ['DPE', 'AMIANTE', 'PLOMB', 'GAZ', 'ELEC', 'TERMITES', 'CARREZ', 'ERP'],
            },
            field_path: {
              type: 'string',
              description:
                "Chemin du champ dans le schéma diagnostic (ex: 'systeme_chauffage.energie_principale', 'enveloppe.isolation_combles.epaisseur_cm', 'inspection_visuelle.dalles_sol.presence_suspectee').",
            },
            value: {
              description:
                'Valeur extraite. Type doit correspondre au kind du champ : string pour enum/string/year, number pour number/integer, boolean pour boolean, ou null si information incertaine.',
            },
            unit: {
              type: ['string', 'null'],
              description: "Unité si applicable (ex: 'cm', 'm²', 'kW', '%'). null sinon.",
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description:
                'Confiance 0.00 à 1.00. > 0.85 = haute confiance (visible explicitement, plaque signalétique, marquage clair). 0.6-0.85 = inférence raisonnable. < 0.6 = supposition (à éviter).',
            },
            rationale: {
              type: 'string',
              description:
                'Justification courte FR (max 200c) : ce qui est visible sur la photo et permet cette extraction.',
            },
          },
          required: ['diagnostic_type', 'field_path', 'value', 'confidence', 'rationale'],
        },
      },
    },
    required: ['relevant', 'field_hints'],
  },
}

// ============================================
// API du module
// ============================================

export interface VisionAnalysisInput {
  /** Image complète encodée en base64 (pas de prefix `data:`). */
  imageBase64: string
  /** Mime type — typiquement 'image/jpeg' depuis le preprocessing browser. */
  imageMimeType: 'image/jpeg' | 'image/png' | 'image/webp' | string
  /** Nom de la pièce (ex: 'Salon'). null si non rattachée à une pièce. */
  roomName: string | null
  /** Diagnostics actifs sur le dossier (au moins un). */
  activeDiagnostics: DiagnosticType[]
  /** Annotation associée à la photo (note vocale transcrite ou texte rapide). */
  annotation: { kind: 'voice' | 'text'; content: string } | null
}

export interface VisionAnalysisOutput {
  result: VisionAnalysisResult
  costUsd: number
  model: string
  durationMs: number
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
}

/**
 * Analyse une photo terrain avec Claude Vision (Haiku 4.5) et retourne un
 * VisionAnalysisResult structuré + métadonnées coût/usage.
 *
 * Throw `VisionAnalysisError` si toutes les tentatives échouent.
 */
export async function analyzePhotoWithVision(
  input: VisionAnalysisInput,
): Promise<VisionAnalysisOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new VisionAnalysisError('ANTHROPIC_API_KEY not configured', 'config_missing')
  }
  if (input.activeDiagnostics.length === 0) {
    throw new VisionAnalysisError(
      'activeDiagnostics is empty — at least one diagnostic must be active to run Vision IA',
      'invalid_input',
    )
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const systemPrompt = buildSystemPrompt(input.activeDiagnostics, input.roomName, input.annotation)

  let lastError: unknown = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const t0 = Date.now()
    try {
      const response = await client.messages.create({
        model: VISION_MODEL,
        max_tokens: 4000,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [EXTRACT_PHOTO_TOOL],
        tool_choice: { type: 'tool', name: 'extract_photo_analysis' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: input.imageMimeType as 'image/jpeg' | 'image/png' | 'image/webp',
                  data: input.imageBase64,
                },
              },
              {
                type: 'text',
                text: input.annotation
                  ? `Annotation ${input.annotation.kind} associée à la photo : "${input.annotation.content}"`
                  : 'Aucune annotation associée à cette photo. Analyse uniquement les informations visibles.',
              },
            ],
          },
        ],
      })

      const durationMs = Date.now() - t0

      // Le tool_choice forcé garantit que content[0] est un tool_use.
      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      )
      if (!toolUseBlock) {
        throw new VisionAnalysisError(
          'Claude did not return a tool_use block despite forced tool_choice',
          'parse_failed',
        )
      }

      const parsed = parseToolResponse(toolUseBlock.input)

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

      const result: VisionAnalysisResult = {
        relevant: parsed.relevant,
        primarySubject: parsed.primarySubject,
        caption: parsed.caption,
        fieldHints: parsed.fieldHints,
        inputTokens,
        outputTokens,
        model: VISION_MODEL,
        costUsd,
      }

      return {
        result,
        costUsd,
        model: VISION_MODEL,
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
      // Backoff exponentiel : 800ms, 1600ms, 3200ms
      const delay = BASE_BACKOFF_MS * 2 ** (attempt - 1)
      await sleep(delay)
    }
  }

  const msg = lastError instanceof Error ? lastError.message : 'unknown vision error'
  throw new VisionAnalysisError(
    `Vision analysis failed after ${MAX_ATTEMPTS} attempts : ${msg}`,
    'api_failed',
  )
}

// ============================================
// Errors
// ============================================

export type VisionAnalysisErrorCode =
  | 'config_missing'
  | 'invalid_input'
  | 'parse_failed'
  | 'api_failed'

export class VisionAnalysisError extends Error {
  readonly code: VisionAnalysisErrorCode

  constructor(message: string, code: VisionAnalysisErrorCode) {
    super(message)
    this.name = 'VisionAnalysisError'
    this.code = code
  }
}

// ============================================
// Helpers internes
// ============================================

function buildSystemPrompt(
  activeDiagnostics: DiagnosticType[],
  roomName: string | null,
  annotation: { kind: 'voice' | 'text'; content: string } | null,
): string {
  // Sérialise les schémas des diagnostics actifs pour que Claude voie la structure
  // attendue (paths + kind + enum options + extraction_hints).
  // Itération 6 : les 8 diagnostics MVP V1.5 sont couverts → SCHEMAS_BY_DIAGNOSTIC
  // garantit un schéma non-null pour tout DiagnosticType valide.
  const schemasSerialized = activeDiagnostics
    .map((diag) => {
      const schema = SCHEMAS_BY_DIAGNOSTIC[diag]
      return `### ${diag} (version ${schema.version})\n${schema.description}\n\n\`\`\`json\n${JSON.stringify(
        schema.sections,
        null,
        2,
      )}\n\`\`\``
    })
    .join('\n\n')

  const annotationLine = annotation
    ? `Annotation associée (${annotation.kind}) : "${annotation.content}"`
    : 'Aucune annotation associée.'

  const roomLine = roomName ? `Pièce : ${roomName}` : 'Pièce : (non renseignée)'

  return `Tu analyses une photo prise par un diagnostiqueur immobilier français lors d'une visite terrain.

CONTEXTE :
- Diagnostics actifs pour ce dossier : ${activeDiagnostics.join(', ')}
- ${roomLine}
- ${annotationLine}

INSTRUCTIONS :
1. Identifie le sujet principal visible sur la photo (chaudière, tableau électrique, dalle de sol, vue générale de pièce, plaque signalétique, isolant en place, menuiserie, etc.).
2. Extrais TOUTES les informations utiles aux diagnostics actifs ci-dessous, en respectant strictement les paths de leur schéma.
3. Pour chaque champ : valeur + confidence 0.00-1.00 + rationale courte (ce qui est visible et justifie l'extraction).
4. N'INVENTE JAMAIS. Si tu n'es pas sûr : confidence < 0.7 OU n'inclus pas le champ.
5. Si la photo n'est PAS pertinente (sol vide, partie de mur sans intérêt, photo floue, photo de mobilier sans valeur diagnostic) : relevant=false et field_hints vide.
6. Plaque signalétique chaudière / climatiseur / VMC : extraction prioritaire (marque, modèle, année, puissance) avec confidence haute si lisible.
7. Si l'annotation vocale/texte précise une info non visible mais cohérente avec la photo, tu PEUX l'inclure avec une confidence modérée (0.7-0.85).

SCHÉMAS DES DIAGNOSTICS ACTIFS :
${schemasSerialized}

Tu DOIS utiliser l'outil "extract_photo_analysis" pour structurer ta réponse. N'écris JAMAIS de texte libre en dehors du tool call.`
}

interface ToolResponseParsed {
  relevant: boolean
  primarySubject: string | null
  caption: string | null
  fieldHints: VisionAnalysisFieldHint[]
}

/**
 * Parse + valide la réponse du tool. Filtre les diagnostics inconnus et les
 * confidences hors plage. Pas de zod pour éviter une dépendance lourde côté
 * Edge — on fait la validation à la main de manière défensive.
 */
function parseToolResponse(input: unknown): ToolResponseParsed {
  if (!isRecord(input)) {
    throw new VisionAnalysisError('Tool response is not an object', 'parse_failed')
  }
  const relevant = typeof input.relevant === 'boolean' ? input.relevant : false
  const primarySubject =
    typeof input.primary_subject === 'string' && input.primary_subject.trim().length > 0
      ? input.primary_subject.trim()
      : null
  const caption =
    typeof input.caption === 'string' && input.caption.trim().length > 0
      ? input.caption.trim()
      : null

  const rawHints = Array.isArray(input.field_hints) ? input.field_hints : []
  const fieldHints: VisionAnalysisFieldHint[] = []
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

  for (const raw of rawHints) {
    if (!isRecord(raw)) continue
    const diag = raw.diagnostic_type
    const path = raw.field_path
    const confidence = raw.confidence
    if (typeof diag !== 'string' || !VALID_DIAGS.has(diag as DiagnosticType)) continue
    if (typeof path !== 'string' || path.length === 0) continue
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) continue
    if (!('value' in raw)) continue

    fieldHints.push({
      diagnosticType: diag as DiagnosticType,
      fieldPath: path,
      value: raw.value as VisionAnalysisFieldHint['value'],
      unit: typeof raw.unit === 'string' ? raw.unit : null,
      confidence,
      rationale: typeof raw.rationale === 'string' ? raw.rationale.slice(0, 200) : '',
    })
  }

  return { relevant, primarySubject, caption, fieldHints }
}

function computeCostUsd(
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number,
): number {
  // inputTokens inclut déjà cache_creation + cache_read selon les conventions
  // Anthropic. On déduit donc pour ne pas double-compter.
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
  if (err instanceof VisionAnalysisError) {
    // parse_failed / invalid_input / config_missing ne sont pas retryables.
    return false
  }
  // Erreurs réseau bas niveau (fetch failed, timeout, ECONNRESET) — retry.
  return true
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
