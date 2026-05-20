/**
 * Rate limiting in-memory par chat_id.
 *
 * V1 : fenêtre glissante 60s, max 30 requêtes par chat_id. La map vit dans le
 * process Node — sur Vercel chaque instance serverless a sa propre map.
 * Acceptable V1 (peu d'admins, peu de spam attendu).
 *
 * V2 (si scaling) : basculer vers Upstash Redis ou Vercel KV avec INCR + EXPIRE.
 */

const WINDOW_MS = 60_000
const MAX_REQUESTS = 30
const HARD_MAX_ENTRIES = 1000 // garde-fou anti memory leak

const requests = new Map<number, number[]>()

export function isRateLimited(chatId: number): boolean {
  const now = Date.now()
  const existing = requests.get(chatId) ?? []
  // Filtre les timestamps trop anciens
  const fresh = existing.filter((t) => now - t < WINDOW_MS)
  if (fresh.length >= MAX_REQUESTS) {
    // Réinsère la liste filtrée même en cas de blocage (sinon on perd l'historique)
    requests.set(chatId, fresh)
    return true
  }
  fresh.push(now)
  requests.set(chatId, fresh)

  // Garde-fou : si la map devient trop grande (rare), purge les entrées vides.
  if (requests.size > HARD_MAX_ENTRIES) {
    for (const [k, v] of requests) {
      const stillFresh = v.filter((t) => now - t < WINDOW_MS)
      if (stillFresh.length === 0) requests.delete(k)
      else requests.set(k, stillFresh)
    }
  }

  return false
}

/** Helper test/debug — retourne le nombre de requêtes restantes dans la fenêtre. */
export function remainingRequests(chatId: number): number {
  const now = Date.now()
  const fresh = (requests.get(chatId) ?? []).filter((t) => now - t < WINDOW_MS)
  return Math.max(0, MAX_REQUESTS - fresh.length)
}

/** Helper test — purge complète. À ne PAS utiliser en prod. */
export function __resetRateLimiterForTests(): void {
  requests.clear()
}
