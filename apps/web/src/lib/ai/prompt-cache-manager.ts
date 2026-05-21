/**
 * KOVAS — Helper Anthropic prompt caching (cache_control ephemeral).
 *
 * Authority : CLAUDE.md §8 + docs/ai-cost-optimization.md.
 *
 * Concepts :
 *   - Anthropic supporte `cache_control: { type: 'ephemeral' }` sur les blocs system
 *     ET sur les blocs user content (tool, text). TTL = 5 minutes par défaut.
 *   - Cache hit (`cache_read_input_tokens`) : 10% du prix input → -90%.
 *   - Cache write (`cache_creation_input_tokens`) : 125% du prix input (+25% overhead).
 *   - Break-even : ~3-4 réutilisations dans la fenêtre 5min → garder le cache "chaud".
 *
 * Stratégies KOVAS :
 *   - regulatory-ai-chat : system_prompt (5k tok) + rag_context (3-5k tok) → 2 blocs cachés
 *     par message. Sur une conv de 10 messages : 9 cache hits → -85% input cost.
 *   - regulatory-analyze : system_prompt + analysis_tool stable inter-documents → 2 blocs
 *     cachés à travers une journée d'ingestion (refresh nécessaire si gap > 5min).
 *
 * Heartbeat : pour conversations actives, stocker `last_cache_refresh_at` dans
 * `regulatory_ai_conversations.session_metadata` JSONB et refresh dès qu'on dépasse
 * 4 min depuis le dernier hit.
 */

/** Bloc de texte cacheable côté Anthropic. */
export interface CacheableTextBlock {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral' }
}

export interface CacheBudget {
  /** Tokens minimums pour qu'un bloc vaille la peine d'être caché.
   *  Anthropic exige un minimum (1024 tokens pour Haiku, plus pour Sonnet/Opus). */
  minTokens: number
}

/** Budget minimum recommandé par tier (Anthropic 2026-05). */
export const CACHE_MIN_TOKENS: Record<'haiku' | 'sonnet' | 'opus', number> = {
  haiku: 1024,
  sonnet: 1024,
  opus: 1024,
}

/** TTL ephemeral Anthropic (millisecondes). */
export const EPHEMERAL_TTL_MS = 5 * 60 * 1000

/** Marge de sécurité avant expiration (déclencher un refresh à -1 min). */
export const REFRESH_THRESHOLD_MS = 4 * 60 * 1000

/**
 * Construit un bloc texte avec cache_control ephemeral.
 * Garde-fou : si le texte est trop court (< minTokens estimés), retourne le bloc
 * sans cache_control pour éviter le rejet API.
 *
 * Estimation tokens (heuristique) : ~4 chars/token pour FR.
 */
export function cacheableTextBlock(
  text: string,
  tier: 'haiku' | 'sonnet' | 'opus' = 'sonnet',
): CacheableTextBlock {
  const estimatedTokens = Math.ceil(text.length / 4)
  if (estimatedTokens < CACHE_MIN_TOKENS[tier]) {
    return { type: 'text', text }
  }
  return {
    type: 'text',
    text,
    cache_control: { type: 'ephemeral' },
  }
}

/** Décide si on doit refresh le cache (TTL ephemeral). */
export function shouldRefreshCache(lastRefreshAtIso: string | null): boolean {
  if (!lastRefreshAtIso) return true
  const last = new Date(lastRefreshAtIso).getTime()
  if (Number.isNaN(last)) return true
  return Date.now() - last > REFRESH_THRESHOLD_MS
}

/**
 * Compte les tokens cachés depuis un usage Anthropic response.
 * Convention SDK : `cache_read_input_tokens` (hit) + `cache_creation_input_tokens` (write).
 */
export interface AnthropicUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

export interface CacheStats {
  cacheReadTokens: number
  cacheWriteTokens: number
  cacheHitRate: number // [0,1] sur l'input total
}

export function computeCacheStats(usage: AnthropicUsage): CacheStats {
  const read = usage.cache_read_input_tokens ?? 0
  const write = usage.cache_creation_input_tokens ?? 0
  const totalInput = usage.input_tokens + read + write
  return {
    cacheReadTokens: read,
    cacheWriteTokens: write,
    cacheHitRate: totalInput > 0 ? read / totalInput : 0,
  }
}

/**
 * Doc inline : structure attendue d'un appel anthropic.messages.create() avec cache.
 *
 * @example
 * await anthropic.messages.create({
 *   model: ANTHROPIC_MODELS.sonnet,
 *   max_tokens: 1024,
 *   system: [cacheableTextBlock(SYSTEM_PROMPT, 'sonnet')],
 *   messages: [{
 *     role: 'user',
 *     content: [
 *       cacheableTextBlock(ragContext, 'sonnet'),  // bloc 2 caché
 *       { type: 'text', text: userQuery },         // bloc dynamique, non caché
 *     ],
 *   }],
 * })
 */
