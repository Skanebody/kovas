/**
 * KOVAS — Analyzer réglementaire (Node.js / Next.js side).
 *
 * Wrapper Claude tool use + embeddings OpenAI réutilisable depuis :
 *   - API routes Next.js (preview / re-run depuis l'admin)
 *   - Tests Vitest
 *
 * NB : l'Edge Function Supabase `regulatory-analyze` a une copie locale
 * du même algorithme (runtime Deno). Toute évolution doit être propagée.
 *
 * Convention coût : log `ai_usage_log` (operation='regulatory_analyze') via supabase admin client.
 */

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'

// ────────────────────────────────────────────────────────────
// Constantes & types
// ────────────────────────────────────────────────────────────

const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL_REGULATORY ?? 'claude-sonnet-4-6'
const OPENAI_EMBED_MODEL = 'text-embedding-3-small'

const ANTHROPIC_INPUT_USD_PER_MTOK = 3
const ANTHROPIC_OUTPUT_USD_PER_MTOK = 15
const OPENAI_EMBED_USD_PER_MTOK = 0.02
const USD_TO_EUR = 0.92

export type ActionType =
  | 'update_coherence_rule'
  | 'update_report_template'
  | 'update_pricing'
  | 'update_workflow'
  | 'inform_users'

export type Urgency = 'low' | 'medium' | 'high' | 'critical'

export type AffectedModule =
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'gaz'
  | 'electricite'
  | 'termites'
  | 'carrez'
  | 'erp'

export interface RegulatoryAction {
  action_type: ActionType
  description: string
  target?: string
  urgency: Urgency
}

export interface RegulatoryAnalysis {
  summary: string
  impact_analysis: string
  affected_modules: AffectedModule[]
  affected_diagnostic_types?: string[]
  entry_in_force_date?: string | null
  actions_required: RegulatoryAction[]
  topics: string[]
  is_modification_of?: string | null
}

export interface RegulatoryDocument {
  id: string
  title: string | null
  reference: string | null
  document_type: string
  publication_date: string | null
  full_text: string | null
  full_text_url: string | null
}

// ────────────────────────────────────────────────────────────
// Tool schema
// ────────────────────────────────────────────────────────────

export const REGULATORY_ANALYSIS_TOOL = {
  name: 'submit_regulatory_analysis',
  description:
    'Submit structured analysis of a French real estate diagnostic regulatory document (DPE, amiante, plomb, gaz, électricité, termites, Carrez/Boutin, ERP).',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: { type: 'string' as const },
      impact_analysis: { type: 'string' as const },
      affected_modules: {
        type: 'array' as const,
        items: {
          type: 'string' as const,
          enum: ['dpe', 'amiante', 'plomb', 'gaz', 'electricite', 'termites', 'carrez', 'erp'],
        },
      },
      affected_diagnostic_types: {
        type: 'array' as const,
        items: { type: 'string' as const },
      },
      entry_in_force_date: {
        type: ['string', 'null'] as ['string', 'null'],
      },
      actions_required: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            action_type: {
              type: 'string' as const,
              enum: [
                'update_coherence_rule',
                'update_report_template',
                'update_pricing',
                'update_workflow',
                'inform_users',
              ],
            },
            description: { type: 'string' as const },
            target: { type: 'string' as const },
            urgency: {
              type: 'string' as const,
              enum: ['low', 'medium', 'high', 'critical'],
            },
          },
          required: ['action_type', 'description', 'urgency'],
        },
      },
      topics: { type: 'array' as const, items: { type: 'string' as const } },
      is_modification_of: { type: ['string', 'null'] as ['string', 'null'] },
    },
    required: ['summary', 'impact_analysis', 'affected_modules', 'actions_required', 'topics'],
  },
}

const SYSTEM_PROMPT = `Tu es un assistant juridique expert en réglementation française du diagnostic immobilier.
KOVAS est un SaaS B2B utilisé par ~13 000 diagnostiqueurs immobiliers indépendants en France.

Mission : analyser un document réglementaire (arrêté, décret, circulaire DHUP, communiqué ADEME, FAQ Cofrac, etc.)
et structurer ton analyse via l'outil submit_regulatory_analysis.

Périmètre KOVAS V1 : 8 diagnostics standards (DPE, amiante, plomb CREP, gaz, électricité, termites, Carrez/Boutin, ERP).
EXCLU : audit énergétique, DTG, marketplace MAR/RGE.

Ton FR sobre, professionnel. JAMAIS de marketing. Cite la référence exacte si possible.
Si le document n'a aucun impact métier KOVAS, renvoie summary="Document hors périmètre KOVAS" et actions_required=[].`

// ────────────────────────────────────────────────────────────
// Clients
// ────────────────────────────────────────────────────────────

function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY missing')
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY missing')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

export interface AnalyzeResult {
  analysis: RegulatoryAnalysis
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  latencyMs: number
}

/**
 * Appelle Claude avec tool use forcé sur `submit_regulatory_analysis`.
 *
 * Retry exponentiel sur 429/500/502/503/504 (3 tentatives).
 * Prompt caching 1h sur le system prompt (stable entre documents).
 */
export async function analyzeDocument(doc: RegulatoryDocument): Promise<AnalyzeResult> {
  const anthropic = getAnthropic()
  const started = Date.now()

  const userContent = `Document à analyser :

Titre : ${doc.title ?? '(sans titre)'}
Référence : ${doc.reference ?? '(sans référence)'}
Type : ${doc.document_type}
Date publication : ${doc.publication_date ?? '(inconnue)'}
URL : ${doc.full_text_url ?? '(aucune)'}

--- Contenu ---
${(doc.full_text ?? '').slice(0, 60_000)}
--- Fin ---

Analyse le document et appelle obligatoirement l'outil submit_regulatory_analysis.`

  // biome-ignore lint/suspicious/noExplicitAny: Anthropic SDK ne type pas encore cache_control sur system blocks.
  const systemBlocks: any = [
    { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
  ]

  let attempt = 0
  while (true) {
    try {
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        system: systemBlocks,
        // biome-ignore lint/suspicious/noExplicitAny: tools input_schema typing limitation
        tools: [REGULATORY_ANALYSIS_TOOL] as any,
        tool_choice: { type: 'tool', name: 'submit_regulatory_analysis' },
        messages: [{ role: 'user', content: userContent }],
      })

      const toolUse = response.content.find(
        (c): c is Extract<typeof response.content[number], { type: 'tool_use' }> =>
          c.type === 'tool_use' && c.name === 'submit_regulatory_analysis',
      )
      if (!toolUse) {
        throw new Error('Claude did not call submit_regulatory_analysis tool')
      }

      // biome-ignore lint/suspicious/noExplicitAny: tool_use input is unknown JSON
      const cacheRead = (response.usage as any)?.cache_read_input_tokens ?? 0

      return {
        analysis: toolUse.input as RegulatoryAnalysis,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: cacheRead as number,
        latencyMs: Date.now() - started,
      }
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status && [429, 500, 502, 503, 504].includes(status) && attempt < 3) {
        const backoffMs = 2 ** attempt * 1000 + Math.floor(Math.random() * 500)
        await new Promise((r) => setTimeout(r, backoffMs))
        attempt++
        continue
      }
      throw err
    }
  }
}

/**
 * Génère un embedding text-embedding-3-small (1536 dimensions) pour pgvector.
 * Cape l'input à ~25k chars (~6k tokens, sous la limite 8192).
 */
export async function generateEmbedding(text: string): Promise<{
  vector: number[]
  tokens: number
}> {
  const openai = getOpenAI()
  const response = await openai.embeddings.create({
    model: OPENAI_EMBED_MODEL,
    input: text.slice(0, 25_000),
  })
  const first = response.data[0]
  if (!first) throw new Error('OpenAI embeddings: empty response')
  return { vector: first.embedding, tokens: response.usage.total_tokens }
}

// ────────────────────────────────────────────────────────────
// Cost tracking
// ────────────────────────────────────────────────────────────

export function computeCostEur(input: {
  inputTokens: number
  outputTokens: number
  embedTokens: number
}): number {
  const claudeUsd =
    (input.inputTokens / 1_000_000) * ANTHROPIC_INPUT_USD_PER_MTOK +
    (input.outputTokens / 1_000_000) * ANTHROPIC_OUTPUT_USD_PER_MTOK
  const openaiUsd = (input.embedTokens / 1_000_000) * OPENAI_EMBED_USD_PER_MTOK
  return (claudeUsd + openaiUsd) * USD_TO_EUR
}

/**
 * Log AI usage dans `ai_usage_log` (table existante).
 *
 * `user_id` est NOT NULL ; on utilise un user technique "system" stocké dans
 * l'env var `KOVAS_SYSTEM_USER_ID`. Skip silencieux si absent.
 */
export async function logRegulatoryAiUsage(
  client: SupabaseClient,
  params: {
    inputTokens: number
    outputTokens: number
    embedTokens: number
    durationMs: number
    success: boolean
    errorMessage?: string
  },
): Promise<void> {
  const systemUserId = process.env.KOVAS_SYSTEM_USER_ID
  if (!systemUserId) return

  const costEur = computeCostEur({
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    embedTokens: params.embedTokens,
  })

  // biome-ignore lint/suspicious/noExplicitAny: ai_usage_log not yet in generated Database types.
  const { error } = await (client as any).from('ai_usage_log').insert({
    user_id: systemUserId,
    document_id: null,
    operation: 'regulatory_analyze',
    ai_model: ANTHROPIC_MODEL,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    cost_eur: costEur,
    duration_ms: params.durationMs,
    success: params.success,
    error_message: params.errorMessage ?? null,
  })
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[logRegulatoryAiUsage] insert error:', error.message)
  }
}
