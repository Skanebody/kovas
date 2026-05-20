/**
 * KOVAS — Document Intelligence : classification automatique.
 *
 * Modèle : claude-haiku-4-5 (rapide + low cost ~$0.001/scan).
 *
 * Stratégie :
 *   - Image → bloc `image` (PNG/JPEG/WebP/HEIC dégradé HEIC→JPEG côté client).
 *   - PDF → bloc `document` (Anthropic SDK supporte nativement les PDFs ≤ 32 Mo).
 *   - Prompt court + JSON-only output (pas de tool use ici : tool use serait
 *     surdimensionné pour 1 enum + 1 confidence + 3 alternatives).
 *   - Prompt caching ephemeral 1h sur le system block (réduit -90% les coûts
 *     sur les classifications suivantes).
 *
 * Authority : CLAUDE.md §3 feature 6 (Document Intelligence V1.5).
 */

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeCostUsd,
  extractTextBlock,
  parseJsonResponse,
  usdToEur,
  withRetry,
} from './ai-utils'
import {
  ALL_BACKEND_DOCUMENT_TYPES,
  type BackendDocumentType,
  isBackendDocumentType,
} from './backend-types'

const CLASSIFIER_MODEL = process.env.ANTHROPIC_CLASSIFIER_MODEL ?? 'claude-haiku-4-5'

export interface ClassificationResult {
  type: BackendDocumentType
  /** Confidence 0-100 (entier). */
  confidence: number
  /** Jusqu'à 3 types alternatifs proposés (decroissant). */
  alternativeTypes: { type: BackendDocumentType; confidence: number }[]
  /** Premières lignes texte (preview pour UI). */
  textPreview: string
}

export class ClassificationError extends Error {
  readonly code: 'config_missing' | 'unsupported_mime' | 'api_failed' | 'parse_failed'

  constructor(message: string, code: ClassificationError['code']) {
    super(message)
    this.name = 'ClassificationError'
    this.code = code
  }
}

const SYSTEM_PROMPT = `Tu es un classifieur de documents immobiliers français.

Tu reçois UN document (image ou PDF). Tu identifies son type parmi les 15 catégories suivantes :

- "dpe" : DPE (Diagnostic de Performance Énergétique) — étiquette A-G, classes énergie/GES, surface
- "audit_energetique" : audit énergétique réglementaire (plus détaillé que DPE)
- "amiante" : diagnostic amiante (DAPP, repérage)
- "plomb" : CREP (Constat de Risque d'Exposition au Plomb)
- "plaque_chaudiere" : photo plaque signalétique chaudière (marque, modèle, puissance)
- "plaque_ecs" : plaque signalétique ballon ECS / chauffe-eau
- "plaque_climatisation" : plaque signalétique climatiseur / PAC
- "facture_energie" : facture EDF, Engie, TotalEnergies, etc.
- "plan" : plan architectural / cadastral
- "reglement_copro" : règlement de copropriété
- "carnet_entretien" : carnet d'entretien immeuble
- "acte_propriete" : acte notarié de vente
- "permis_construire" : permis de construire / déclaration de travaux
- "bordereau_mission" : bordereau mission / commande client
- "unknown" : impossible de classer

Tu retournes UNIQUEMENT un JSON conforme à ce schéma (pas de markdown, pas de texte additionnel) :

{
  "type": "dpe" | "audit_energetique" | ...,
  "confidence": <int 0-100>,
  "alternative_types": [
    { "type": "...", "confidence": <int> },
    { "type": "...", "confidence": <int> }
  ],
  "text_preview": "<premieres lignes lisibles, max 200 caractères>"
}

Règles :
- confidence > 90 : marquage évident (titre, logo, structure type)
- confidence 70-89 : structure cohérente mais des indices manquent
- confidence < 70 : forte ambiguïté, donner alternative_types non vides
- alternative_types : 0 à 3 alternatives, confiance décroissante
- text_preview : extrait court 50-200c de ce qui est lisible (pour UI preview), null si illisible`

export interface ClassifyOptions {
  /** Marquer le doc en status='classifying' avant l'appel IA. */
  updateStatus?: boolean
}

/**
 * Classifie un document.
 *
 * @param documentId  UUID de la row documents
 * @param imageBase64 contenu fichier encodé base64 (sans prefix data:)
 * @param mimeType    application/pdf | image/jpeg | image/png | image/webp
 * @param supabase    client Supabase (côté serveur)
 */
export async function classifyDocument(
  documentId: string,
  imageBase64: string,
  mimeType: string,
  supabase: SupabaseClient,
  options: ClassifyOptions = {},
): Promise<ClassificationResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ClassificationError('ANTHROPIC_API_KEY not configured', 'config_missing')
  }

  const isPdf = mimeType === 'application/pdf'
  const isImage = mimeType.startsWith('image/')
  if (!isPdf && !isImage) {
    throw new ClassificationError(`Type ${mimeType} non supporté`, 'unsupported_mime')
  }

  // 1. Marque status='classifying'
  if (options.updateStatus !== false) {
    await supabase
      // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
      .from('documents' as any)
      .update({ status: 'classifying' })
      .eq('id', documentId)
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // 2. Build content blocks
  // biome-ignore lint/suspicious/noExplicitAny: union complexe Anthropic content blocks
  const docBlock: any = isPdf
    ? {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: imageBase64 },
      }
    : {
        type: 'image',
        source: { type: 'base64', media_type: mimeType, data: imageBase64 },
      }

  const t0 = Date.now()

  const response = await withRetry(() =>
    client.messages.create({
      model: CLASSIFIER_MODEL,
      max_tokens: 600,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            docBlock,
            {
              type: 'text',
              text: 'Classifie ce document. Retourne UNIQUEMENT le JSON.',
            },
          ],
        },
      ],
    }),
  )

  const durationMs = Date.now() - t0

  // 3. Parse JSON
  const raw = extractTextBlock(response)
  let parsed: unknown
  try {
    parsed = parseJsonResponse(raw)
  } catch (e) {
    throw new ClassificationError(
      `JSON parse failed: ${e instanceof Error ? e.message : 'unknown'}`,
      'parse_failed',
    )
  }

  const result = validateClassificationResponse(parsed)

  // 4. Log usage + UPDATE documents.document_type
  const costUsd = computeCostUsd(CLASSIFIER_MODEL, {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
  })

  await Promise.all([
    supabase
      // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
      .from('documents' as any)
      .update({
        document_type: result.type,
        classification_confidence: result.confidence,
        status: 'classified',
        ocr_text: result.textPreview,
      })
      .eq('id', documentId),
    logAiUsage(supabase, {
      documentId,
      operation: 'classify',
      model: CLASSIFIER_MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      costEur: usdToEur(costUsd),
      durationMs,
      success: true,
    }),
  ])

  return result
}

// ============================================
// Helpers
// ============================================

function validateClassificationResponse(parsed: unknown): ClassificationResult {
  if (!isRecord(parsed)) {
    throw new ClassificationError('response is not an object', 'parse_failed')
  }
  const typeRaw = parsed.type
  const type: BackendDocumentType =
    typeof typeRaw === 'string' && isBackendDocumentType(typeRaw) ? typeRaw : 'unknown'

  const confidenceRaw = parsed.confidence
  const confidence =
    typeof confidenceRaw === 'number' && confidenceRaw >= 0 && confidenceRaw <= 100
      ? Math.round(confidenceRaw)
      : 0

  const alternativesRaw = Array.isArray(parsed.alternative_types) ? parsed.alternative_types : []
  const alternativeTypes: ClassificationResult['alternativeTypes'] = []
  for (const alt of alternativesRaw.slice(0, 3)) {
    if (!isRecord(alt)) continue
    const t = alt.type
    const c = alt.confidence
    if (
      typeof t === 'string' &&
      isBackendDocumentType(t) &&
      typeof c === 'number' &&
      c >= 0 &&
      c <= 100
    ) {
      alternativeTypes.push({ type: t, confidence: Math.round(c) })
    }
  }

  const previewRaw = parsed.text_preview
  const textPreview = typeof previewRaw === 'string' ? previewRaw.slice(0, 200) : ''

  return { type, confidence, alternativeTypes, textPreview }
}

interface LogAiUsageInput {
  documentId: string | null
  operation: string
  model: string
  inputTokens: number
  outputTokens: number
  costEur: number
  durationMs: number
  success: boolean
  errorMessage?: string
}

export async function logAiUsage(supabase: SupabaseClient, input: LogAiUsageInput): Promise<void> {
  // user_id récupéré via la row documents si documentId présent — sinon caller doit
  // gérer (les routes API qui appellent classifyDocument fourniront documentId).
  let userId: string | null = null
  if (input.documentId) {
    const { data: doc } = await supabase
      // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
      .from('documents' as any)
      .select('user_id')
      .eq('id', input.documentId)
      .maybeSingle()
    userId = (doc as { user_id?: string } | null)?.user_id ?? null
  }
  if (!userId) return // log skip si pas de user_id (RLS-protected)

  await supabase
    // biome-ignore lint/suspicious/noExplicitAny: table `ai_usage_log` pas encore dans le type Database généré
    .from('ai_usage_log' as any)
    .insert({
      user_id: userId,
      document_id: input.documentId,
      operation: input.operation,
      ai_model: input.model,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      cost_eur: input.costEur,
      duration_ms: input.durationMs,
      success: input.success,
      error_message: input.errorMessage ?? null,
    })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export { ALL_BACKEND_DOCUMENT_TYPES as ALL_DOCUMENT_TYPES }
