/**
 * KOVAS — Système 5 : Upsell engine — triggers métier.
 *
 * Pure functions qui détectent une opportunité d'upsell à partir des stats
 * d'un user (quota, F/G DPE, missions moyennes, reviews négatives, clients en
 * base, etc.). Chaque détecteur retourne soit `null` si les conditions ne sont
 * pas remplies, soit un `UpsellOpportunity` avec une raison humaine montrable
 * + une estimation MRR additionnel.
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §8 (Upsell engine).
 * S'articule avec :
 *   - Algo 22 `upsell-timing.ts` (scoring temporel)
 *   - `opportunity-scorer.ts` (scoring composite prob × revenue)
 *   - `offer-selector.ts` (sélection finale + cooldown)
 *
 * Avatar SOBRE PROFESSIONNEL — tutoiement, zéro emoji.
 * Déterministe, testable, zéro IO.
 */

export type UpsellType = 'tier_upgrade' | 'addon' | 'annual_commitment'

export type PlanTier = 'solo' | 'pro' | 'cabinet' | 'cabinet_plus' | 'enterprise'

export type AddonKey =
  | 'pipeline_maprimerenov'
  | 'premium_reports'
  | 'auto_review_response'
  | 'newsletter_clients'
  | 'factur_x_premium'
  | 'signature_eidas'

export interface UserUpsellContext {
  user_id: string
  current_tier: PlanTier
  active_addons: ReadonlyArray<AddonKey>
  /** % du quota mois courant (null = plan illimité ou non mesuré) */
  quota_usage_pct: number | null
  quota_usage_trend_30d: 'increasing' | 'stable' | 'decreasing'
  /** DPE F/G détectés sur 30j */
  fg_dpe_count_last_30d: number
  /** Missions moyennes/mois sur 3 derniers mois */
  monthly_missions_avg: number
  /** Reviews ≤ 3 étoiles reçues sur 30j */
  negative_reviews_last_30d: number
  /** Clients distincts en base */
  client_count: number
  /** Engagement annuel déjà actif ? */
  on_annual: boolean
  tenure_months: number
}

export interface UpsellOpportunity {
  /** Code identifiant le trigger (ex : 'quota_80', 'addon_pipeline_mpr') */
  trigger_code: string
  type: UpsellType
  /** Renseigné pour tier_upgrade */
  from_tier?: PlanTier
  /** Renseigné pour tier_upgrade */
  to_tier?: PlanTier
  /** Renseigné pour addon */
  addon?: AddonKey
  /** Phrase humaine montrable au user (tutoiement, sobre) */
  reason: string
  /** Estimation MRR additionnel /mois (€) */
  base_revenue_potential_eur: number
}

// ---------------------------------------------------------------------------
// Mapping tier → tier suivant + prix Pricing V5
// ---------------------------------------------------------------------------

interface TierConfig {
  price_eur: number
  quota: number
  next: PlanTier | null
}

const TIER_CONFIG: Record<PlanTier, TierConfig> = {
  solo: { price_eur: 29, quota: 40, next: 'pro' },
  pro: { price_eur: 79, quota: 100, next: 'cabinet' },
  cabinet: { price_eur: 199, quota: 300, next: 'cabinet_plus' },
  cabinet_plus: { price_eur: 499, quota: 1000, next: 'enterprise' },
  enterprise: { price_eur: 0, quota: Number.POSITIVE_INFINITY, next: null },
}

const TIER_LABEL: Record<PlanTier, string> = {
  solo: 'Solo',
  pro: 'Pro',
  cabinet: 'Cabinet',
  cabinet_plus: 'Cabinet+',
  enterprise: 'Enterprise',
}

// ---------------------------------------------------------------------------
// Mapping addon → prix mensuel estimé (€/mo)
// ---------------------------------------------------------------------------

const ADDON_PRICE_EUR: Record<AddonKey, number> = {
  pipeline_maprimerenov: 19,
  premium_reports: 14,
  auto_review_response: 9,
  newsletter_clients: 19,
  factur_x_premium: 12,
  signature_eidas: 15,
}

// ---------------------------------------------------------------------------
// Trigger 1 : quota upgrade
// ---------------------------------------------------------------------------

/**
 * Détecte un upsell de type "tier upgrade" si le user sature son quota
 * mensuel ET que sa tendance n'est pas en baisse.
 *
 * Conditions :
 *   - quota_usage_pct >= 80%
 *   - current_tier != 'enterprise'
 *   - trend != 'decreasing'
 *
 * Mapping next tier :
 *   solo → pro (+50€/mo)
 *   pro → cabinet (+120€/mo)
 *   cabinet → cabinet_plus (+300€/mo)
 *   cabinet_plus → enterprise (sur devis, revenue estimé 500€)
 */
export function detectQuotaUpgradeOpportunity(ctx: UserUpsellContext): UpsellOpportunity | null {
  if (ctx.current_tier === 'enterprise') return null
  if (ctx.quota_usage_pct == null) return null
  if (ctx.quota_usage_pct < 80) return null
  if (ctx.quota_usage_trend_30d === 'decreasing') return null

  const current = TIER_CONFIG[ctx.current_tier]
  const next = current.next
  if (next == null) return null
  const nextConfig = TIER_CONFIG[next]

  // Cas cabinet_plus → enterprise : revenue estimé à 500€ (négocié)
  const revenue = next === 'enterprise' ? 500 : nextConfig.price_eur - current.price_eur

  const quotaLabel = next === 'enterprise' ? 'illimité' : `${nextConfig.quota} missions/mois`

  return {
    trigger_code: 'quota_80',
    type: 'tier_upgrade',
    from_tier: ctx.current_tier,
    to_tier: next,
    reason: `Tu es à ${ctx.quota_usage_pct}% de ton quota mensuel. Passer en ${TIER_LABEL[next]} débloque ${quotaLabel}.`,
    base_revenue_potential_eur: revenue,
  }
}

// ---------------------------------------------------------------------------
// Trigger 2 : pipeline MaPrimeRénov'
// ---------------------------------------------------------------------------

/**
 * Détecte un upsell addon Pipeline MaPrimeRénov' si le user a fait beaucoup
 * de DPE F/G ce mois (clients potentiels pour relance MPR).
 *
 * Conditions :
 *   - fg_dpe_count_last_30d >= 5
 *   - addon pas déjà actif
 */
export function detectPipelineMprOpportunity(ctx: UserUpsellContext): UpsellOpportunity | null {
  if (ctx.fg_dpe_count_last_30d < 5) return null
  if (ctx.active_addons.includes('pipeline_maprimerenov')) return null

  return {
    trigger_code: 'addon_pipeline_mpr',
    type: 'addon',
    addon: 'pipeline_maprimerenov',
    reason: `Tu as fait ${ctx.fg_dpe_count_last_30d} DPE F/G ce mois. Pipeline MaPrimeRénov' relance ces clients automatiquement.`,
    base_revenue_potential_eur: ADDON_PRICE_EUR.pipeline_maprimerenov,
  }
}

// ---------------------------------------------------------------------------
// Trigger 3 : premium reports
// ---------------------------------------------------------------------------

/**
 * Détecte un upsell addon Premium Reports si le user envoie beaucoup de
 * rapports + a un peu de tenure (cohérence usage).
 *
 * Conditions :
 *   - monthly_missions_avg >= 10
 *   - addon pas déjà actif
 *   - tenure_months >= 2
 */
export function detectPremiumReportsOpportunity(ctx: UserUpsellContext): UpsellOpportunity | null {
  if (ctx.monthly_missions_avg < 10) return null
  if (ctx.active_addons.includes('premium_reports')) return null
  if (ctx.tenure_months < 2) return null

  const missions = Math.round(ctx.monthly_missions_avg)
  return {
    trigger_code: 'addon_premium_reports',
    type: 'addon',
    addon: 'premium_reports',
    reason: `Tu envoies ${missions} rapports/mois. Premium Reports ajoutent contenu personnalisé qui booste ta réputation.`,
    base_revenue_potential_eur: ADDON_PRICE_EUR.premium_reports,
  }
}

// ---------------------------------------------------------------------------
// Trigger 4 : auto-review response
// ---------------------------------------------------------------------------

/**
 * Détecte un upsell addon Auto-Réponse Avis si le user a reçu ≥ 1 review
 * négative récemment.
 *
 * Conditions :
 *   - negative_reviews_last_30d >= 1
 *   - addon pas déjà actif
 */
export function detectAutoReviewResponseOpportunity(
  ctx: UserUpsellContext,
): UpsellOpportunity | null {
  if (ctx.negative_reviews_last_30d < 1) return null
  if (ctx.active_addons.includes('auto_review_response')) return null

  return {
    trigger_code: 'addon_auto_review_response',
    type: 'addon',
    addon: 'auto_review_response',
    reason: `Tu as reçu ${ctx.negative_reviews_last_30d} review(s) négative(s). Auto-Réponse Avis génère des réponses pro qui boost ton classement.`,
    base_revenue_potential_eur: ADDON_PRICE_EUR.auto_review_response,
  }
}

// ---------------------------------------------------------------------------
// Trigger 5 : newsletter clients
// ---------------------------------------------------------------------------

/**
 * Détecte un upsell addon Newsletter Clients si le user a une base
 * client suffisante + tenure suffisante.
 *
 * Conditions :
 *   - client_count >= 100
 *   - addon pas déjà actif
 *   - tenure_months >= 3
 */
export function detectNewsletterClientsOpportunity(
  ctx: UserUpsellContext,
): UpsellOpportunity | null {
  if (ctx.client_count < 100) return null
  if (ctx.active_addons.includes('newsletter_clients')) return null
  if (ctx.tenure_months < 3) return null

  return {
    trigger_code: 'addon_newsletter_clients',
    type: 'addon',
    addon: 'newsletter_clients',
    reason: `Tu as ${ctx.client_count} clients en base. Newsletter Clients les relance auto pour missions récurrentes.`,
    base_revenue_potential_eur: ADDON_PRICE_EUR.newsletter_clients,
  }
}

// ---------------------------------------------------------------------------
// Trigger 6 : annual commitment
// ---------------------------------------------------------------------------

/**
 * Détecte un upsell engagement annuel si le user a démontré une certaine
 * persistance et n'est pas déjà en annuel.
 *
 * Conditions :
 *   - on_annual = false
 *   - tenure_months >= 4
 *   - current_tier != 'enterprise'
 *
 * Économie calculée : current_monthly_price × 12 × 0.15 (−15% Pricing V5).
 */
export function detectAnnualCommitmentOpportunity(
  ctx: UserUpsellContext,
): UpsellOpportunity | null {
  if (ctx.on_annual) return null
  if (ctx.tenure_months < 4) return null
  if (ctx.current_tier === 'enterprise') return null

  const monthly = TIER_CONFIG[ctx.current_tier].price_eur
  const savingsPerYear = Math.round(monthly * 12 * 0.15)
  // base_revenue_potential = MRR additionnel /mois — pour l'annuel, c'est la
  // sécurisation du MRR sur 12 mois. On l'estime à 50% du MRR actuel (LTV
  // booster) pour comparer avec les autres triggers MRR-additionnel.
  const revenue = Math.round(monthly * 0.5)

  return {
    trigger_code: 'annual_commitment',
    type: 'annual_commitment',
    from_tier: ctx.current_tier,
    reason: `Tu utilises KOVAS depuis ${ctx.tenure_months} mois. Engagement annuel = -15% (économie ${savingsPerYear} €/an).`,
    base_revenue_potential_eur: revenue,
  }
}

// ---------------------------------------------------------------------------
// Aggregate : detect all opportunities
// ---------------------------------------------------------------------------

type Detector = (ctx: UserUpsellContext) => UpsellOpportunity | null

const ALL_DETECTORS: ReadonlyArray<Detector> = [
  detectQuotaUpgradeOpportunity,
  detectPipelineMprOpportunity,
  detectPremiumReportsOpportunity,
  detectAutoReviewResponseOpportunity,
  detectNewsletterClientsOpportunity,
  detectAnnualCommitmentOpportunity,
]

/**
 * Appelle les 6 détecteurs et retourne les opportunités détectées, triées
 * par `base_revenue_potential_eur` descendant.
 *
 * @example
 * ```ts
 * const ops = detectAllOpportunities({ ... })
 * // → [{ trigger_code: 'quota_80', base_revenue_potential_eur: 50 }, ...]
 * ```
 */
export function detectAllOpportunities(ctx: UserUpsellContext): UpsellOpportunity[] {
  const opportunities: UpsellOpportunity[] = []
  for (const detect of ALL_DETECTORS) {
    const op = detect(ctx)
    if (op !== null) opportunities.push(op)
  }
  opportunities.sort((a, b) => b.base_revenue_potential_eur - a.base_revenue_potential_eur)
  return opportunities
}
