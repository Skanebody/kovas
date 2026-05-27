/**
 * KOVAS — Configuration centralisée Anthropic / Claude.
 *
 * Authority : CLAUDE.md §8 (stack IA) + docs/ai-cost-optimization.md (cette vague).
 *
 * Objectif : un seul endroit pour le mapping feature → modèle + pricing USD/Mtok,
 * pour pouvoir basculer Haiku/Sonnet/Opus sans grep dans le repo. Toute Edge Function
 * IA doit lire son modèle via ce module (ou via l'env var équivalente côté Deno).
 *
 * Pricing snapshot 2026-05 (cf. https://www.anthropic.com/pricing) :
 *   - Haiku 4.5  : 1$/Mtok input · 5$/Mtok output · 0.10$ cached · 1.25$ cache write
 *   - Sonnet 4.6 : 3$/Mtok input · 15$/Mtok output · 0.30$ cached · 3.75$ cache write
 *   - Opus 4.7   : 15$/Mtok input · 75$/Mtok output · 1.50$ cached · 18.75$ cache write
 *
 * Pour la lecture côté Edge Function Deno, dupliquer ces constantes dans la function
 * (Deno isolate sans accès aux modules Node). Source de vérité = ce fichier.
 */

/** Modèles Anthropic V1 KOVAS (cf. CLAUDE.md §8). */
export const ANTHROPIC_MODELS = {
  haiku: process.env.ANTHROPIC_HAIKU_MODEL ?? 'claude-haiku-4-5',
  sonnet: process.env.ANTHROPIC_SONNET_MODEL ?? 'claude-sonnet-4-6',
  opus: process.env.ANTHROPIC_OPUS_MODEL ?? 'claude-opus-4-7',
} as const

export type AnthropicTier = keyof typeof ANTHROPIC_MODELS
export type AnthropicModelId =
  | (typeof ANTHROPIC_MODELS)[AnthropicTier]
  | 'claude-haiku-4-5'
  | 'claude-sonnet-4-6'
  | 'claude-opus-4-7'

/**
 * Pricing USD par million de tokens (snapshot 2026-05).
 * Garder synchronisé avec la page pricing Anthropic.
 */
export const PRICING_USD_PER_MTOK: Record<
  string,
  { input: number; output: number; cached: number; cacheWrite: number }
> = {
  'claude-haiku-4-5': { input: 1, output: 5, cached: 0.1, cacheWrite: 1.25 },
  'claude-sonnet-4-6': { input: 3, output: 15, cached: 0.3, cacheWrite: 3.75 },
  'claude-opus-4-7': { input: 15, output: 75, cached: 1.5, cacheWrite: 18.75 },
}

/** Taux conversion USD → EUR. Override via env pour audit comptable. */
export function usdToEur(): number {
  const raw = process.env.USD_TO_EUR_RATE
  const parsed = raw ? Number.parseFloat(raw) : 0.92
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.92
}

export interface TokenBreakdown {
  /** Input tokens billable (hors cache hit, hors cache write). */
  input: number
  /** Output tokens. */
  output: number
  /** Cache READ tokens (hit). Coût réduit à `cached`. */
  cached?: number
  /** Cache WRITE tokens (création/refresh). Coût à `cacheWrite`. */
  cacheWrite?: number
}

/**
 * Calcule le coût EUR d'un appel Anthropic.
 *
 * IMPORTANT : la SDK Anthropic renvoie `input_tokens` qui INCLUT déjà
 * `cache_read_input_tokens` et `cache_creation_input_tokens` selon la doc.
 * On suppose ici que `input` est le nombre de tokens FACTURÉS au prix input
 * standard (i.e. hors cache hit, hors cache write).
 *
 * Appelants : passer `input = response.usage.input_tokens` directement
 * (la doc Anthropic confirme que ce champ exclut les cache hits/writes).
 */
export function computeAnthropicCostEur(model: string, tokens: TokenBreakdown): number {
  const p = PRICING_USD_PER_MTOK[model]
  if (!p) return 0
  const usd =
    (tokens.input / 1_000_000) * p.input +
    (tokens.output / 1_000_000) * p.output +
    ((tokens.cached ?? 0) / 1_000_000) * p.cached +
    ((tokens.cacheWrite ?? 0) / 1_000_000) * p.cacheWrite
  return Math.round(usd * usdToEur() * 1_000_000) / 1_000_000
}

/** Coût d'un batch = coût standard * 0.5 (Anthropic Batch API discount). */
export function computeAnthropicBatchCostEur(model: string, tokens: TokenBreakdown): number {
  return computeAnthropicCostEur(model, tokens) * 0.5
}

/**
 * Mapping feature (slug stable) → tier Anthropic.
 *
 * - haiku 4.5  : volume élevé, prompts courts, structuration simple
 * - sonnet 4.6 : analyse, synthèse, raisonnement métier
 * - opus 4.7   : précision juridique critique (réglementaire), réservé
 */
export const MODEL_FOR_FEATURE = {
  chatbot_methodo: 'sonnet',
  parameter_suggestion: 'haiku',
  defense_dossier: 'sonnet',
  auto_quote_extraction: 'haiku',
  regulatory_analysis: 'opus',
  vision_photo: 'haiku',
  consolidation: 'sonnet',
  document_extraction: 'sonnet',
  community_anonymize: 'haiku',
  litigation_response: 'sonnet',
} as const satisfies Record<string, AnthropicTier>

export type Feature = keyof typeof MODEL_FOR_FEATURE

/** Résout l'ID modèle Claude pour une feature donnée. */
export function modelForFeature(feature: Feature): string {
  const tier = MODEL_FOR_FEATURE[feature]
  return ANTHROPIC_MODELS[tier]
}

/**
 * Vérifie qu'un modèle utilisé correspond au mapping recommandé.
 * Renvoie un warning string si divergence (à logger en obs, pas bloquant).
 */
export function checkModelAlignment(feature: Feature, modelUsed: string): string | null {
  const expected = modelForFeature(feature)
  if (modelUsed === expected) return null
  return `[anthropic-config] feature='${feature}' uses model='${modelUsed}' but recommended='${expected}'`
}

/** Tarifs OpenAI embeddings (utilisé par certaines Edge Functions). */
export const OPENAI_EMBEDDING_PRICING_USD_PER_MTOK = {
  'text-embedding-3-small': 0.02,
  'text-embedding-3-large': 0.13,
} as const

export function computeOpenAIEmbeddingCostEur(model: string, tokens: number): number {
  const pricing =
    OPENAI_EMBEDDING_PRICING_USD_PER_MTOK[
      model as keyof typeof OPENAI_EMBEDDING_PRICING_USD_PER_MTOK
    ]
  if (!pricing) return 0
  const usd = (tokens / 1_000_000) * pricing
  return Math.round(usd * usdToEur() * 1_000_000) / 1_000_000
}
