/**
 * KOVAS — Algo 23 : LTV forecasting.
 *
 * Pure function qui prédit le LTV (Lifetime Value) d'un user dès la signup,
 * en centimes d'euros sur une fenêtre 24 mois. Sert à :
 *   - Ajuster le CAC autorisé par segment (acquisition payante future)
 *   - Prioriser les efforts customer success (high-LTV users en priorité)
 *   - Décisions remises/discounts (high-LTV = remise OK, low-LTV = risque)
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` (Algo 23).
 *
 * Stratégie :
 *   - Baseline LTV par tier (€ 24 mois fenêtre, basé pricing V5)
 *   - Multipliers selon signaux activation (D7, addons, source)
 *   - CAC autorisé = LTV × 0.30 (cible LTV/CAC ≥ 3,3)
 *
 * Déterministe, testable, zéro IO. Le caller assemble les inputs depuis
 * subscriptions (tier) + onboarding_progress + addons + utm_params + referrals.
 *
 * Limite : modèle rules-based Year 1. Year 2+, transition vers ML entraîné
 * sur historique cohorte M1-M24 (cf. AI_AUTONOMY_V1 §23).
 */

export type PlanTier = 'solo' | 'pro' | 'cabinet' | 'cabinet_plus' | 'enterprise'

export type AcquisitionSource =
  | 'organic_search'
  | 'direct'
  | 'referral'
  | 'paid_ads'
  | 'linkedin'
  | 'press'
  | 'newsletter'
  | 'partner'
  | 'unknown'

export interface LtvForecastInput {
  /** Tier de l'abonnement à la signup */
  initial_tier: PlanTier
  /** Engagement annuel choisi à la signup ? (-15% prix, +12 mois lock-in) */
  annual_commitment: boolean
  /** Onboarding complété pendant les 7 premiers jours ? */
  onboarding_completed_d7: boolean
  /** Activation D7 réussie ? (≥ 3 missions complétées) */
  activated_d7: boolean
  /** Nombre d'addons souscrits à la signup */
  initial_addons_count: number
  /** Source d'acquisition principale */
  source: AcquisitionSource
  /** A parrainé au moins 1 user dans les 30 premiers jours ? */
  referrer_d30: boolean
  /** SIRET vérifié (proxy fiabilité business) */
  siret_verified: boolean
}

export interface LtvSignal {
  code: string
  label: string
  multiplier: number
  detail: string
}

export interface LtvForecastResult {
  /** LTV prédit en centimes d'euros sur 24 mois */
  ltv_cents: number
  /** LTV formaté en euros entier (UI helper) */
  ltv_eur: number
  /** Baseline avant multipliers (pour debug) */
  base_ltv_cents: number
  /** CAC max autorisé en centimes (cible LTV/CAC ≥ 3,3) */
  max_cac_cents: number
  /** CAC max formaté en euros entier */
  max_cac_eur: number
  /** Segment LTV : low / mid / high / vip */
  segment: 'low' | 'mid' | 'high' | 'vip'
  /** Détail multipliers appliqués */
  signals: ReadonlyArray<LtvSignal>
  /** Phrase humaine prête à afficher */
  human_message: string
}

/**
 * Baseline LTV par tier (cents, 24 mois).
 *
 * Calcul : prix mensuel HT × 24 × rétention_moyenne_cohort.
 * Hypothèses rétention M24 par tier :
 *   - solo : 35% (volume bas, friction élevée)
 *   - pro : 50% (sweet spot)
 *   - cabinet : 60% (lock-in équipe)
 *   - cabinet_plus : 70% (lock-in fort + intégrations)
 *   - enterprise : 80% (contrats négociés)
 *
 * Pricing V5 mensuel HT :
 *   - solo : 29€
 *   - pro : 79€
 *   - cabinet : 199€
 *   - cabinet_plus : 499€
 *   - enterprise : ~1500€ moyen négocié
 */
const BASE_LTV_CENTS: Record<PlanTier, number> = {
  solo: 29 * 100 * 24 * 0.35, // 24 360 cts = ~244€
  pro: 79 * 100 * 24 * 0.5, // 94 800 cts = ~948€
  cabinet: 199 * 100 * 24 * 0.6, // 286 560 cts = ~2866€
  cabinet_plus: 499 * 100 * 24 * 0.7, // 837 360 cts = ~8374€
  enterprise: 1500 * 100 * 24 * 0.8, // 2 880 000 cts = ~28800€
}

/**
 * Multipliers (composables) :
 *
 * - annual_commitment       : ×1.15  (engagement = -churn)
 * - onboarding_completed_d7 : ×1.20  (corrélé activation)
 * - activated_d7            : ×1.50  (signal le plus fort selon Drift, Hubspot)
 * - initial_addons > 0      : ×1.30 par addon, capé à ×1.60
 * - source=referral         : ×1.40  (LTV/CAC référence = 5×)
 * - source=organic_search   : ×1.20  (intent élevé)
 * - source=linkedin         : ×1.10  (qualifié)
 * - source=paid_ads         : ×0.85  (CAC plus élevé, churn early plus haut)
 * - referrer_d30            : ×1.25  (promoteur = sticky)
 * - siret_verified          : ×1.10  (fiabilité business)
 *
 * Multiplier total composé = produit de tous les multipliers actifs.
 */

function multiplierForAnnual(annual: boolean): { mult: number; detail: string } {
  if (annual) return { mult: 1.15, detail: 'Engagement annuel (+15%)' }
  return { mult: 1.0, detail: 'Mensuel sans engagement' }
}

function multiplierForOnboarding(completed: boolean): {
  mult: number
  detail: string
} {
  if (completed) return { mult: 1.2, detail: 'Onboarding D7 complété (+20%)' }
  return { mult: 1.0, detail: 'Onboarding D7 incomplet (LTV baseline)' }
}

function multiplierForActivation(activated: boolean): { mult: number; detail: string } {
  if (activated) return { mult: 1.5, detail: 'Activation D7 (+50%) — signal LTV majeur' }
  return { mult: 1.0, detail: "Pas d'activation D7 (LTV baseline)" }
}

function multiplierForAddons(count: number): { mult: number; detail: string } {
  if (count === 0) return { mult: 1.0, detail: 'Aucun addon initial' }
  const multRaw = 1 + 0.3 * count
  const mult = Math.min(multRaw, 1.6) // cap à ×1.60
  return { mult, detail: `${count} addon(s) initial(s) (+${Math.round((mult - 1) * 100)}%)` }
}

function multiplierForSource(source: AcquisitionSource): {
  mult: number
  detail: string
} {
  switch (source) {
    case 'referral':
      return { mult: 1.4, detail: 'Référé (LTV/CAC × 5 cible) (+40%)' }
    case 'organic_search':
      return { mult: 1.2, detail: 'Recherche organique (intent élevé) (+20%)' }
    case 'linkedin':
      return { mult: 1.1, detail: 'LinkedIn (qualifié) (+10%)' }
    case 'newsletter':
      return { mult: 1.15, detail: 'Newsletter (warm) (+15%)' }
    case 'partner':
      return { mult: 1.3, detail: 'Partenaire (recommandation) (+30%)' }
    case 'press':
      return { mult: 1.15, detail: 'Presse (autorité) (+15%)' }
    case 'paid_ads':
      return { mult: 0.85, detail: 'Paid ads (churn early plus haut) (-15%)' }
    case 'direct':
      return { mult: 1.0, detail: 'Direct (LTV baseline)' }
    default:
      return { mult: 0.95, detail: 'Source inconnue (-5%)' }
  }
}

function multiplierForReferrer(isReferrer: boolean): { mult: number; detail: string } {
  if (isReferrer) return { mult: 1.25, detail: 'A parrainé sous 30j (+25%) — promoteur' }
  return { mult: 1.0, detail: 'Pas de parrainage D30' }
}

function multiplierForSiret(verified: boolean): { mult: number; detail: string } {
  if (verified) return { mult: 1.1, detail: 'SIRET vérifié (+10%)' }
  return { mult: 1.0, detail: 'SIRET non vérifié' }
}

function segmentForLtv(ltv_eur: number): 'low' | 'mid' | 'high' | 'vip' {
  if (ltv_eur >= 5000) return 'vip'
  if (ltv_eur >= 1500) return 'high'
  if (ltv_eur >= 500) return 'mid'
  return 'low'
}

function humanMessageFor(
  ltv_eur: number,
  max_cac_eur: number,
  segment: 'low' | 'mid' | 'high' | 'vip',
): string {
  const segLabel = {
    low: 'Low LTV',
    mid: 'Mid LTV',
    high: 'High LTV',
    vip: 'VIP LTV',
  }[segment]
  return `${segLabel} — LTV ${ltv_eur} € sur 24 mois. CAC max autorisé : ${max_cac_eur} € (LTV/CAC ≥ 3,3).`
}

/**
 * Algorithme principal — prédit LTV à la signup.
 *
 * @example
 * ```ts
 * const result = forecastLtv({
 *   initial_tier: 'pro',
 *   annual_commitment: true,
 *   onboarding_completed_d7: true,
 *   activated_d7: true,
 *   initial_addons_count: 1,
 *   source: 'referral',
 *   referrer_d30: false,
 *   siret_verified: true,
 * })
 * // LTV ~3000 €, CAC autorisé ~900 €, segment 'high'
 * ```
 */
export function forecastLtv(input: LtvForecastInput): LtvForecastResult {
  const base = BASE_LTV_CENTS[input.initial_tier]

  const annualSig = multiplierForAnnual(input.annual_commitment)
  const obSig = multiplierForOnboarding(input.onboarding_completed_d7)
  const actSig = multiplierForActivation(input.activated_d7)
  const addonSig = multiplierForAddons(input.initial_addons_count)
  const sourceSig = multiplierForSource(input.source)
  const refSig = multiplierForReferrer(input.referrer_d30)
  const siretSig = multiplierForSiret(input.siret_verified)

  const signals: LtvSignal[] = [
    {
      code: 'annual',
      label: 'Engagement annuel',
      multiplier: annualSig.mult,
      detail: annualSig.detail,
    },
    {
      code: 'onboarding_d7',
      label: 'Onboarding D7',
      multiplier: obSig.mult,
      detail: obSig.detail,
    },
    {
      code: 'activation_d7',
      label: 'Activation D7',
      multiplier: actSig.mult,
      detail: actSig.detail,
    },
    {
      code: 'addons',
      label: 'Addons initiaux',
      multiplier: addonSig.mult,
      detail: addonSig.detail,
    },
    {
      code: 'source',
      label: 'Source acquisition',
      multiplier: sourceSig.mult,
      detail: sourceSig.detail,
    },
    {
      code: 'referrer_d30',
      label: 'Parrain D30',
      multiplier: refSig.mult,
      detail: refSig.detail,
    },
    {
      code: 'siret',
      label: 'SIRET vérifié',
      multiplier: siretSig.mult,
      detail: siretSig.detail,
    },
  ]

  // Multiplier composé
  const totalMultiplier = signals.reduce((acc, s) => acc * s.multiplier, 1)
  const ltv_cents = Math.round(base * totalMultiplier)
  const ltv_eur = Math.round(ltv_cents / 100)

  // CAC autorisé : LTV / 3.3 (cible LTV/CAC ≥ 3,3 — SaaS B2B standard)
  const max_cac_cents = Math.round(ltv_cents / 3.3)
  const max_cac_eur = Math.round(max_cac_cents / 100)

  const segment = segmentForLtv(ltv_eur)
  const human_message = humanMessageFor(ltv_eur, max_cac_eur, segment)

  return {
    ltv_cents,
    ltv_eur,
    base_ltv_cents: Math.round(base),
    max_cac_cents,
    max_cac_eur,
    segment,
    signals,
    human_message,
  }
}
