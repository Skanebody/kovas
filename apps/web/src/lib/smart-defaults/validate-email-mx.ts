/**
 * Validation email avec heuristique côté client + cache localStorage 24h.
 *
 * ⚠️ Zone grise — choix d'implémentation :
 * - Pas de vraie résolution DNS MX possible depuis un navigateur (interdit par CORS).
 * - Trois options possibles côté serveur :
 *   1. Free service `https://mailcheck.p.rapidapi.com/` ou `https://api.eva.pingutil.com/email?email=<x>` (rate-limit serré, fiabilité variable)
 *   2. API payante (Hunter.io ~50$/mo, Kickbox 8$/1000, Bouncer 4$/1000)
 *   3. Route API custom Next.js qui appelle `dns.resolveMx()` côté Node — gratuit, fiable, ~50ms
 *
 * Décision Phase 1 : on combine
 *   (a) validation regex stricte + format (synchrone, gratuit)
 *   (b) liste blocklist providers free/jetable (déjà gérée par validateProEmail)
 *   (c) typo detection sur top 30 domaines (gmail.con, hotmal.com…)
 *   (d) optionnel : appel route API Next.js `/api/email/mx-check` si disponible
 *
 * Le hook caller (use-debounced-validation) gère le debounce 500ms.
 */

import { validateProEmail } from '@/lib/validation/email'

const CACHE_KEY = 'kovas:email-mx-cache:v1'
const TTL_MS = 24 * 60 * 60 * 1000

interface CacheEntry {
  valid: boolean
  reason?: string
  expiresAt: number
}

type CachePayload = Record<string, CacheEntry>

function readCache(): CachePayload {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as CachePayload
  } catch {
    return {}
  }
}

function writeCache(payload: CachePayload): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    // Quota dépassé → silencieux
  }
}

/** Top domaines pour détection de typos courants. */
const COMMON_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'outlook.fr',
  'hotmail.com',
  'hotmail.fr',
  'yahoo.fr',
  'yahoo.com',
  'icloud.com',
  'orange.fr',
  'free.fr',
  'wanadoo.fr',
  'sfr.fr',
  'laposte.net',
  'live.fr',
  'protonmail.com',
]

/** Calcule la distance de Levenshtein. Renvoie un entier. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) matrix[i]![0] = i
  for (let j = 0; j <= b.length; j++) matrix[0]![j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      )
    }
  }
  return matrix[a.length]![b.length]!
}

/** Détecte une typo probable et propose la correction la plus proche. */
export function suggestDomainCorrection(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at < 0) return null
  const domain = email.slice(at + 1).toLowerCase()
  if (!domain) return null
  if (COMMON_DOMAINS.includes(domain)) return null
  let best: { domain: string; distance: number } | null = null
  for (const candidate of COMMON_DOMAINS) {
    const d = levenshtein(domain, candidate)
    if (d <= 2 && (!best || d < best.distance)) {
      best = { domain: candidate, distance: d }
    }
  }
  if (!best || best.distance === 0) return null
  return `${email.slice(0, at + 1)}${best.domain}`
}

export interface EmailMxValidationResult {
  valid: boolean
  reason?: string
  suggestion?: string
}

/**
 * Validation principale.
 * @param email à valider
 * @param opts.mode 'pro' applique la blocklist free/disposable (signup). 'lax' accepte tout email syntaxiquement valide (forms client/contact).
 */
export async function validateEmailMx(
  email: string,
  opts: { mode?: 'pro' | 'lax' } = {},
): Promise<EmailMxValidationResult> {
  const mode = opts.mode ?? 'lax'
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return { valid: false, reason: 'Email requis.' }

  // Cache lookup
  const cache = readCache()
  const cached = cache[trimmed]
  if (cached && cached.expiresAt > Date.now()) {
    return { valid: cached.valid, ...(cached.reason ? { reason: cached.reason } : {}) }
  }

  // Validation syntaxique + blocklist providers
  const result = validateProEmail(trimmed)
  if (!result.valid) {
    // En mode lax on accepte free providers (un client peut avoir un gmail)
    if (mode === 'lax' && (result.reason === 'free_provider' || result.reason === 'disposable_provider')) {
      // Vérification format seulement
      const formatOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
      if (formatOk) {
        cache[trimmed] = { valid: true, expiresAt: Date.now() + TTL_MS }
        writeCache(cache)
        return { valid: true }
      }
    }
    let reason: string
    switch (result.reason) {
      case 'invalid_format':
        reason = 'Format email invalide.'
        break
      case 'free_provider':
        reason = "Utilisez votre email professionnel (avec votre nom de domaine)."
        break
      case 'disposable_provider':
        reason = "Les emails temporaires ne sont pas autorisés."
        break
      case 'no_mx':
        reason = "Le domaine de cet email n'est pas joignable."
        break
      default:
        reason = 'Email invalide.'
    }
    const suggestion = suggestDomainCorrection(trimmed)
    cache[trimmed] = { valid: false, reason, expiresAt: Date.now() + 60 * 60 * 1000 } // 1h pour invalides
    writeCache(cache)
    return suggestion ? { valid: false, reason, suggestion } : { valid: false, reason }
  }

  // Suggestion typo possible même si syntaxe ok (ex gmail.co → gmail.com)
  const suggestion = suggestDomainCorrection(trimmed)
  if (suggestion) {
    return { valid: true, suggestion }
  }

  cache[trimmed] = { valid: true, expiresAt: Date.now() + TTL_MS }
  writeCache(cache)
  return { valid: true }
}
