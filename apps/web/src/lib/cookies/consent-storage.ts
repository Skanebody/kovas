/**
 * Stockage du consentement cookies (CNIL).
 *
 * Persistance localStorage côté navigateur uniquement. Toutes les fonctions
 * sont SSR-safe (no-op si `window` indéfini).
 *
 * Schéma versionné : `kovas_consent_v1`. En cas d'évolution majeure (nouvelle
 * catégorie de cookies, refonte juridique), incrémenter `CONSENT_VERSION` et
 * créer une clé `kovas_consent_v2` — l'ancien consentement sera invalidé
 * automatiquement et l'utilisateur re-sollicité.
 *
 * Renouvellement annuel : la CNIL recommande de re-solliciter le consentement
 * tous les 13 mois maximum. Au-delà, `loadConsent()` retourne `null` et le
 * banner est ré-affiché.
 */

export const CONSENT_VERSION = '1.0' as const
export const CONSENT_STORAGE_KEY = 'kovas_consent_v1' as const

// 13 mois en millisecondes (recommandation CNIL : renouvellement annuel
// avec une tolérance d'un mois). Au-delà, le consent stocké est expiré et
// le banner doit être ré-affiché.
const CONSENT_MAX_AGE_MS = 13 * 30 * 24 * 60 * 60 * 1000

/**
 * État du consentement cookies pour un utilisateur donné.
 *
 *  - `essential` : toujours `true` (cookies nécessaires au fonctionnement de
 *    KOVAS : authentification, panier, préférences). Pas de toggle utilisateur.
 *  - `analytics` : PostHog (mesure d'usage, feature flags). Opt-in explicite.
 *  - `functional` : Sentry session replay (enregistrement sessions sur erreur).
 *    Opt-in explicite. Sentry errors capture reste actif sans consent (base
 *    juridique = intérêt légitime art. 6.1.f RGPD).
 */
export interface ConsentState {
  readonly essential: true
  readonly analytics: boolean
  readonly functional: boolean
  readonly ts: string
  readonly version: typeof CONSENT_VERSION
}

/**
 * Catégories de cookies présentables à l'utilisateur (essentiel est figé).
 */
export type ToggleableConsentCategory = 'analytics' | 'functional'

/**
 * Événement custom dispatché sur `window` à chaque mise à jour du consentement.
 * Les modules PostHog/Sentry réinitialisés au runtime peuvent s'abonner pour
 * activer/désactiver leurs trackers sans rechargement de page.
 */
export const CONSENT_CHANGE_EVENT = 'kovas:consent-change' as const

export interface ConsentChangeEventDetail {
  readonly consent: ConsentState
  readonly previous: ConsentState | null
}

/**
 * Lit le consent stocké. Retourne `null` si :
 *  - SSR (pas de localStorage)
 *  - aucune entrée stockée (premier visiteur)
 *  - entrée corrompue (JSON invalide)
 *  - version obsolète
 *  - ts > 13 mois (recommandation CNIL renouvellement annuel)
 */
export function loadConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<ConsentState>
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.version !== CONSENT_VERSION) return null
    if (parsed.essential !== true) return null
    if (typeof parsed.analytics !== 'boolean') return null
    if (typeof parsed.functional !== 'boolean') return null
    if (typeof parsed.ts !== 'string') return null

    // Renouvellement 13 mois (CNIL recommandation)
    const ageMs = Date.now() - new Date(parsed.ts).getTime()
    if (Number.isNaN(ageMs) || ageMs > CONSENT_MAX_AGE_MS) return null

    return {
      essential: true,
      analytics: parsed.analytics,
      functional: parsed.functional,
      ts: parsed.ts,
      version: CONSENT_VERSION,
    }
  } catch {
    return null
  }
}

/**
 * Persiste le consent et dispatch un event custom `kovas:consent-change`
 * pour réactivité runtime (PostHog opt_in/opt_out, Sentry replay toggle).
 */
export function saveConsent(input: {
  readonly analytics: boolean
  readonly functional: boolean
}): ConsentState {
  const previous = loadConsent()
  const next: ConsentState = {
    essential: true,
    analytics: input.analytics,
    functional: input.functional,
    ts: new Date().toISOString(),
    version: CONSENT_VERSION,
  }

  if (typeof window === 'undefined') return next

  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Quota dépassé ou storage désactivé (private browsing Safari) — le banner
    // re-apparaîtra à la prochaine session, ce qui est le bon comportement par
    // défaut conformément à la CNIL.
  }

  const detail: ConsentChangeEventDetail = { consent: next, previous }
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail }))
  } catch {
    // CustomEvent peut échouer dans certains navigateurs très anciens — on
    // tolère silencieusement, le consent reste persisté dans localStorage.
  }

  return next
}

/**
 * Efface le consent stocké. Utile pour les tests ou un futur bouton "Effacer
 * mes choix" dans la modale de préférences.
 */
export function clearConsent(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY)
  } catch {
    // no-op
  }
}

/**
 * Détecte si l'utilisateur a activé Do Not Track au niveau navigateur.
 *
 * CNIL : DNT seul ne constitue PAS un refus explicite valable (besoin d'une
 * action utilisateur sur notre banner). En revanche, il influence les valeurs
 * par défaut de la modale "Personnaliser" : DNT = ON → toggles OFF par défaut.
 */
export function isDoNotTrackEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const navWithDnt = window.navigator as Navigator & {
    readonly msDoNotTrack?: string
  }
  const dnt =
    window.navigator.doNotTrack ??
    (window as unknown as { readonly doNotTrack?: string }).doNotTrack ??
    navWithDnt.msDoNotTrack
  return dnt === '1' || dnt === 'yes'
}

/**
 * Indique si analytics PostHog peuvent être activés. Lecture synchrone du
 * localStorage — utilisable depuis n'importe quel module (gate init).
 */
export function hasAnalyticsConsent(): boolean {
  return loadConsent()?.analytics === true
}

/**
 * Indique si le session replay Sentry peut être activé. Lecture synchrone.
 * À noter : Sentry errors capture reste TOUJOURS actif (intérêt légitime).
 */
export function hasFunctionalConsent(): boolean {
  return loadConsent()?.functional === true
}
