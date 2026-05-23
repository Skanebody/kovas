/**
 * Annuaire freemium 3 niveaux + pay-to-unlock leads.
 * Cf. CLAUDE.md §4 + spec G1.
 *
 * 3 niveaux de fiche dans l'annuaire public /trouver-un-diagnostiqueur :
 * - basic    : non-réclamée (donnée DHUP brute, contact masqué)
 * - verified : claimed + tier d'entrée (Essential 19€ ou Découverte 29€)
 * - premium  : claimed + tier supérieur (Pro 39€, All Inclusive 99€, Cabinet 149€)
 *
 * Compat V1 (cf. stripe-config.ts) : discovery/standard → verified, volume → premium.
 * Compat E2c (futur) : essential/decouverte → verified, pro/all_inclusive/cabinet → premium.
 *
 * Pay-to-unlock : tous les diagnostiqueurs peuvent recevoir des
 * quote_requests, mais les coordonnées du prospect sont verrouillées
 * tant que la fiche n'est pas claimed avec un abonnement actif.
 */

import { type SupabaseUntyped, asUntyped } from './supabase-untyped'

export type ListingLevel = 'basic' | 'verified' | 'premium'

export type ListingBadge = 'none' | 'verified' | 'recommended'

export interface ListingLevelFeatures {
  /** Affiche la photo réelle (vs initiales placeholder) */
  showPhoto: boolean
  /** Affiche la bio rédigée par le diag */
  showBio: boolean
  /** Coordonnées email visibles (vs masquées) */
  showContactEmail: boolean
  /** Coordonnées téléphone visibles (vs masquées) */
  showContactPhone: boolean
  /** Site web visible */
  showWebsite: boolean
  /** Badge affiché sur la card et la page */
  showBadge: ListingBadge
  /** Le diag peut RECEVOIR des leads (toujours true en V1 pay-to-unlock) */
  enableQuoteRequests: boolean
  /** Le diag peut VOIR les coordonnées des leads (false si basic) */
  unlockQuoteRequests: boolean
  /** Quota d'unlocks mensuel inclus dans l'abonnement (Infinity = illimité) */
  maxLeadsUnlockedPerMonth: number
  /** Avis Google synchronisés affichés */
  showGoogleReviews: boolean
  /** Section analytics privée accessible */
  showAnalytics: boolean
  /** Position dans le tri annuaire (1 = top, 10 = last) */
  searchPriority: number
}

const FEATURES_BY_LEVEL: Record<ListingLevel, ListingLevelFeatures> = {
  basic: {
    showPhoto: false,
    showBio: false,
    showContactEmail: false,
    showContactPhone: false,
    showWebsite: false,
    showBadge: 'none',
    enableQuoteRequests: true,
    unlockQuoteRequests: false,
    maxLeadsUnlockedPerMonth: 0,
    showGoogleReviews: false,
    showAnalytics: false,
    searchPriority: 10,
  },
  verified: {
    showPhoto: true,
    showBio: true,
    showContactEmail: true,
    showContactPhone: true,
    showWebsite: true,
    showBadge: 'verified',
    enableQuoteRequests: true,
    unlockQuoteRequests: true,
    // Essential 19€ → 10 unlocks/mo · Découverte 29€ → 20 unlocks/mo
    // On retourne la borne basse Essential ici, surcharge par tier dans
    // getQuotaForPlan() ci-dessous.
    maxLeadsUnlockedPerMonth: 10,
    showGoogleReviews: false,
    showAnalytics: true,
    searchPriority: 5,
  },
  premium: {
    showPhoto: true,
    showBio: true,
    showContactEmail: true,
    showContactPhone: true,
    showWebsite: true,
    showBadge: 'recommended',
    enableQuoteRequests: true,
    unlockQuoteRequests: true,
    maxLeadsUnlockedPerMonth: Number.POSITIVE_INFINITY,
    showGoogleReviews: true,
    showAnalytics: true,
    searchPriority: 1,
  },
}

/**
 * Retourne le set de features pour un niveau de fiche.
 * Pure function — testable, mémoïzable.
 */
export function getFeaturesForLevel(level: ListingLevel): ListingLevelFeatures {
  return FEATURES_BY_LEVEL[level]
}

/**
 * Quota d'unlocks mensuel par plan code.
 * À ajuster selon retours bêta. Source de vérité unique.
 */
export function getQuotaForPlan(plan: string | null | undefined): number {
  switch (plan) {
    case 'essential':
      return 10
    case 'decouverte':
    case 'discovery':
      return 20
    case 'standard':
      return 40
    case 'pro':
      return Number.POSITIVE_INFINITY
    case 'all_inclusive':
      return Number.POSITIVE_INFINITY
    case 'cabinet':
      return Number.POSITIVE_INFINITY
    case 'volume':
      return Number.POSITIVE_INFINITY
    default:
      return 0
  }
}

interface ListingLevelRow {
  listing_level: ListingLevel
  plan_code: string | null
  tier: string | null
  subscription_status: string | null
}

/**
 * Lit le niveau calculé de fiche depuis la vue Postgres.
 * Retourne 'basic' par défaut si introuvable.
 */
export async function getDiagnosticianListingLevel(
  supabase: SupabaseUntyped | unknown,
  diagnosticianId: string,
): Promise<ListingLevel> {
  const sb = asUntyped(supabase)
  const { data } = await sb
    .from('v_diagnostician_listing_level')
    .select('listing_level')
    .eq('id', diagnosticianId)
    .maybeSingle<Pick<ListingLevelRow, 'listing_level'>>()

  return data?.listing_level ?? 'basic'
}

/**
 * Variante qui retourne aussi le plan_code (utile pour calculer le quota).
 */
export async function getDiagnosticianListingContext(
  supabase: SupabaseUntyped | unknown,
  diagnosticianId: string,
): Promise<{
  level: ListingLevel
  planCode: string | null
  subscriptionStatus: string | null
}> {
  const sb = asUntyped(supabase)
  const { data } = await sb
    .from('v_diagnostician_listing_level')
    .select('listing_level, plan_code, tier, subscription_status')
    .eq('id', diagnosticianId)
    .maybeSingle<ListingLevelRow>()

  if (!data) {
    return { level: 'basic', planCode: null, subscriptionStatus: null }
  }
  // Si la table E2c plan_code n'est pas encore peuplée, on retombe sur `tier`
  const effectivePlan = data.plan_code ?? data.tier ?? null
  return {
    level: data.listing_level,
    planCode: effectivePlan,
    subscriptionStatus: data.subscription_status,
  }
}

export interface UnlockCheckResult {
  allowed: boolean
  reason?: 'not_claimed' | 'no_subscription' | 'quota_exceeded' | 'already_unlocked' | 'not_owner'
  remainingUnlocks?: number
  quotaMax?: number
  level?: ListingLevel
}

/**
 * Vérifie qu'un user a le droit de déverrouiller une lead donnée.
 * À appeler UNIQUEMENT côté serveur (route API ou Server Action).
 *
 * Règles :
 * 1. Le diag doit être claimed (level !== 'basic')
 * 2. L'abonnement doit être actif (status active/trialing)
 * 3. Le quota mensuel ne doit pas être dépassé
 * 4. La lead ne doit pas déjà être unlocked (idempotent OK mais on signale)
 */
export async function canUnlockLead(
  supabase: SupabaseUntyped | unknown,
  diagnosticianId: string,
  quoteRequestId: string,
): Promise<UnlockCheckResult> {
  const sb = asUntyped(supabase)
  const ctx = await getDiagnosticianListingContext(sb, diagnosticianId)

  if (ctx.level === 'basic') {
    return { allowed: false, reason: 'not_claimed', level: ctx.level }
  }
  if (ctx.subscriptionStatus !== 'active' && ctx.subscriptionStatus !== 'trialing') {
    return { allowed: false, reason: 'no_subscription', level: ctx.level }
  }

  // Idempotence : si déjà unlocked, on autorise (la route renverra 200)
  const { data: existing } = await sb
    .from('quote_request_unlocks')
    .select('id')
    .eq('diagnostician_id', diagnosticianId)
    .eq('quote_request_id', quoteRequestId)
    .maybeSingle()

  if (existing) {
    return {
      allowed: true,
      reason: 'already_unlocked',
      level: ctx.level,
      quotaMax: getQuotaForPlan(ctx.planCode),
    }
  }

  const quotaMax = getQuotaForPlan(ctx.planCode)
  if (quotaMax === Number.POSITIVE_INFINITY) {
    return { allowed: true, remainingUnlocks: Number.POSITIVE_INFINITY, quotaMax, level: ctx.level }
  }

  // Compte des unlocks du mois en cours pour ce diag
  const startOfMonth = startOfCurrentMonthIso()
  const { count } = await sb
    .from('quote_request_unlocks')
    .select('id', { count: 'exact', head: true })
    .eq('diagnostician_id', diagnosticianId)
    .gte('unlocked_at', startOfMonth)

  const used = count ?? 0
  const remaining = Math.max(0, quotaMax - used)

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: 'quota_exceeded',
      remainingUnlocks: 0,
      quotaMax,
      level: ctx.level,
    }
  }

  return { allowed: true, remainingUnlocks: remaining, quotaMax, level: ctx.level }
}

function startOfCurrentMonthIso(): string {
  const now = new Date()
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return startOfMonth.toISOString()
}

/**
 * Mappe un ListingLevel vers les classes de bordure de la card annuaire.
 * Utilisé côté UI publique /trouver-un-diagnostiqueur (navy brand).
 */
export function getCardClassesForLevel(level: ListingLevel): string {
  switch (level) {
    case 'premium':
      return 'border-2 border-[#D4F542]/60 shadow-[0_4px_20px_rgba(212,245,66,0.15)]'
    case 'verified':
      return 'border border-blue-300/60'
    case 'basic':
    default:
      return 'border border-neutral-200'
  }
}

export function getBadgeLabelForLevel(level: ListingLevel): string | null {
  switch (level) {
    case 'premium':
      return 'Recommandé KOVAS'
    case 'verified':
      return 'Vérifié KOVAS'
    case 'basic':
      return 'Non-réclamée par le pro'
  }
}
