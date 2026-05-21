/**
 * Fallback Claude Haiku pour les transcripts à faible confiance (< 0,7).
 *
 * Stratégie hybride :
 * - Parser custom JS gère 80% des cas (0€ coût)
 * - Pour les 20% restants → Claude Haiku 4.5 (~$0.001/mission)
 * - Prompt caching 1h TTL (gros gain sur appels répétés)
 *
 * Coût total approximatif : 0,01€/mission (vs 0,15€ tout-Claude).
 */

import Anthropic from '@anthropic-ai/sdk'
import { buildClaudeContextVocabulary } from './local-ai/vocabulary/diagnostic-jargon'
import type { VoiceParsedData } from './voice-parser'

const HAIKU_MODEL = process.env.ANTHROPIC_MODEL_VOICE ?? 'claude-haiku-4-5'
const SYSTEM_PROMPT_BASE = `Tu es un assistant spécialisé en diagnostic immobilier français.

Tu reçois un transcript brut d'un diagnostiqueur qui décrit ce qu'il voit sur place.
Tu retournes un JSON strictement conforme au schéma indiqué.

Règles :
- Ne pas inventer de données absentes du transcript
- Utiliser null/undefined si l'info n'est pas mentionnée
- Surfaces en m² (number), années 4 chiffres
- Marques/modèles seulement si explicitement nommés
- equipment.kind : exactement parmi {chaudiere, chauffe_eau, radiateur, pac, climatisation, fenetre, isolation, ventilation, tableau_elec, autre}
- observations[] : phrases d'intérêt (risques, défauts) verbatim depuis le transcript`

/**
 * Construit le system prompt complet avec le lexique métier injecté.
 * Si `diagnostics` est vide → lexique complet (toutes sections).
 * Sinon → uniquement les sections pertinentes (économie de tokens).
 */
function buildSystemPrompt(diagnostics: readonly string[]): string {
  const vocab = buildClaudeContextVocabulary(diagnostics)
  return `${SYSTEM_PROMPT_BASE}\n\n${vocab}`
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    surface_m2: { type: 'number' },
    year_built: { type: 'number' },
    ceiling_height_m: { type: 'number' },
    rooms_count: { type: 'number' },
    equipment: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['chaudiere', 'chauffe_eau', 'radiateur', 'pac', 'climatisation', 'fenetre', 'isolation', 'ventilation', 'tableau_elec', 'autre'] },
          brand: { type: 'string' },
          model: { type: 'string' },
          energy_class: { type: 'string' },
          year_install: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['kind'],
      },
    },
    observations: { type: 'array', items: { type: 'string' } },
  },
}

export interface ClaudeStructureResult {
  data: VoiceParsedData
  costEur: number
  latencyMs: number
}

export async function structureWithClaude(
  transcript: string,
  diagnostics: readonly string[] = [],
): Promise<ClaudeStructureResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const t0 = Date.now()
  const systemPrompt = buildSystemPrompt(diagnostics)

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Transcript à structurer :\n\n${transcript}\n\nRetourne un JSON conforme à ce schéma :\n${JSON.stringify(RESPONSE_SCHEMA, null, 2)}\n\nRéponds UNIQUEMENT avec le JSON, sans markdown ni texte additionnel.`,
      },
    ],
  })

  const latencyMs = Date.now() - t0
  const block = response.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Claude returned non-text content')
  }

  // Strip markdown fences if present
  const cleaned = block.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const parsed = JSON.parse(cleaned) as Partial<VoiceParsedData>

  // Approximate cost calculation (Haiku pricing: $0.80/M input, $4/M output)
  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const cachedInput = response.usage.cache_read_input_tokens ?? 0
  const billableInput = inputTokens - cachedInput
  const costUsd =
    (billableInput * 0.0000008) +
    (cachedInput * 0.00000008) + // cache read is 10x cheaper
    (outputTokens * 0.000004)
  const costEur = Math.round(costUsd * 0.93 * 100000) / 100000

  return {
    data: {
      surface_m2: parsed.surface_m2,
      year_built: parsed.year_built,
      ceiling_height_m: parsed.ceiling_height_m,
      rooms_count: parsed.rooms_count,
      equipment: parsed.equipment ?? [],
      observations: parsed.observations ?? [],
      raw_keywords: [],
      confidence: 0.95, // Claude confident by construction
    },
    costEur,
    latencyMs,
  }
}
