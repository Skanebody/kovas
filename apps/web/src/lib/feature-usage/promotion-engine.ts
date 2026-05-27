/**
 * KOVAS — Système 10 : Feature usage learner — promotion engine.
 *
 * Pure function qui, pour un user donné, décide quelle feature lui promouvoir
 * cette semaine en croisant :
 *   - les analyses d'adoption produites par `analyzer.ts`
 *   - les uplifts de rétention produits par `retention-uplift.ts`
 *   - le profil du user (cluster comportemental, tenure, tier Stripe)
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §13 (Feature usage learner)
 * + Système 5 (Upsell engine) pour le scoring contextuel.
 *
 * Stratégie :
 *   1. Filtre features candidates : non utilisée par le user + tier compatible
 *      + recommended_action='promote' (analyzer) + retention reco='consider_promote'
 *      ou 'high_priority_promote' (retention-uplift, optionnel).
 *   2. Score chaque candidate avec priority_score 0-100 (+ bonus retention,
 *      cluster fit, tenure idéal − pénalité churning).
 *   3. Retient la candidate avec le top score (ou null si aucune).
 *   4. Mappe vers email_template_suggestion via FEATURE_TO_TEMPLATE_MAP.
 *
 * Déterministe, testable, zéro IO. Le caller (Edge Function cron hebdo)
 * boucle sur les users actifs, appelle `decidePromotionForUser` pour chacun,
 * puis `rankPromotionDecisions` pour limiter le volume hebdo total.
 *
 * Avatar SOBRE PROFESSIONNEL — vouvoiement dans `reason`.
 */

import type { FeatureAnalysis, RecommendedAction } from './analyzer'
import {
  FEATURES_CATALOG,
  type FeatureDefinition,
  type FeatureId,
  type FeatureTier,
  tierGte,
} from './features-catalog'
import type { RetentionUpliftResult, UpliftRecommendation } from './retention-uplift'

export type UserCluster =
  | 'power_user'
  | 'cabinet_team'
  | 'occasional_solo'
  | 'new_user'
  | 'churning'

export type UserTier = FeatureTier | 'enterprise'

export interface PromotionTarget {
  user_id: string
  cluster: UserCluster
  /** Ancienneté du user en mois */
  tenure_months: number
  /** Tier Stripe courant */
  current_tier: UserTier
  /** Features utilisées sur les 30 derniers jours (déduit du tracking PostHog) */
  features_used_30d: ReadonlyArray<FeatureId>
}

export interface PromotionDecision {
  user_id: string
  /** null si aucune promo à envoyer cette semaine */
  feature_to_promote: FeatureId | null
  /** Score 0-100 utilisé par `rankPromotionDecisions` pour limiter le volume */
  priority_score: number
  /** Raison humaine de la décision (vouvoiement, sobre) */
  reason: string
  /** Template id Resend/Brevo à utiliser */
  email_template_suggestion: string
}

// ---------------------------------------------------------------------------
// Mapping feature → email template (template id Resend/Brevo)
// ---------------------------------------------------------------------------

const FEATURE_TO_TEMPLATE_MAP: Record<FeatureId, string> = {
  voice_capture: 'feature_promo_voice_capture',
  photo_geolocation: 'feature_promo_photo_geolocation',
  cross_check_6_sources: 'feature_promo_cross_check_6_sources',
  liciel_export: 'feature_promo_liciel_export',
  devis: 'feature_promo_devis',
  factures: 'feature_promo_factures',
  annuaire: 'feature_promo_annuaire',
  parrainage: 'feature_promo_parrainage',
  analytics: 'feature_promo_analytics',
  baseline_minutes: 'feature_promo_baseline_minutes',
  integrations_pdp: 'feature_promo_integrations_pdp',
  mission_chat: 'feature_promo_mission_chat',
}

/** Template par défaut si pas de promo à envoyer (no-op côté caller). */
const NO_PROMO_TEMPLATE = 'no_promo_this_week'

// ---------------------------------------------------------------------------
// Cluster fit — quelles features pour quel cluster ?
// ---------------------------------------------------------------------------

/**
 * Cluster fit fort = la feature résonne particulièrement avec ce cluster.
 *
 *   - power_user        : analytics + annuaire + parrainage (advanced)
 *   - cabinet_team      : analytics + factures + devis (multi-users, KPIs)
 *   - occasional_solo   : voice_capture + photo_geolocation + cross_check
 *                         (core workflow features pour augmenter usage)
 *   - new_user          : voice_capture + photo_geolocation + baseline_minutes
 *                         (foundational, onboarding extension)
 *   - churning          : aucune (focus retention, jamais promotion)
 */
const CLUSTER_FIT: Record<UserCluster, ReadonlyArray<FeatureId>> = {
  power_user: ['analytics', 'annuaire', 'parrainage'],
  cabinet_team: ['analytics', 'factures', 'devis'],
  occasional_solo: ['voice_capture', 'photo_geolocation', 'cross_check_6_sources'],
  new_user: ['voice_capture', 'photo_geolocation', 'baseline_minutes'],
  churning: [],
}

// ---------------------------------------------------------------------------
// Tenure fit — fenêtre idéale pour promouvoir
// ---------------------------------------------------------------------------

/**
 * Features "core / foundational" : promouvoir tôt (M1-M3).
 * Features "advanced" (analytics, parrainage, integrations) : M3+.
 */
const CORE_FEATURES: ReadonlyArray<FeatureId> = [
  'voice_capture',
  'photo_geolocation',
  'cross_check_6_sources',
  'liciel_export',
  'baseline_minutes',
  'mission_chat',
]

function isTenureIdeal(feature_id: FeatureId, tenure_months: number): boolean {
  const isCore = CORE_FEATURES.includes(feature_id)
  if (isCore) {
    // Core : fenêtre M1-M3
    return tenure_months >= 1 && tenure_months <= 3
  }
  // Advanced : à partir de M3
  return tenure_months >= 3
}

// ---------------------------------------------------------------------------
// Score builders
// ---------------------------------------------------------------------------

interface ScoreBreakdown {
  retention_uplift_points: number
  cluster_fit_points: number
  tenure_fit_points: number
  churning_penalty: number
}

function uplitfPoints(rec: UpliftRecommendation | undefined): number {
  if (rec === 'high_priority_promote') return 50
  if (rec === 'consider_promote') return 20
  return 0
}

function clusterFitPoints(feature_id: FeatureId, cluster: UserCluster): number {
  return CLUSTER_FIT[cluster].includes(feature_id) ? 20 : 0
}

function tenureFitPoints(feature_id: FeatureId, tenure_months: number): number {
  return isTenureIdeal(feature_id, tenure_months) ? 10 : 0
}

function churningPenalty(cluster: UserCluster): number {
  return cluster === 'churning' ? -30 : 0
}

function clampScore(s: number): number {
  return Math.max(0, Math.min(100, s))
}

function sumBreakdown(b: ScoreBreakdown): number {
  return clampScore(
    b.retention_uplift_points + b.cluster_fit_points + b.tenure_fit_points + b.churning_penalty,
  )
}

// ---------------------------------------------------------------------------
// Reason builder
// ---------------------------------------------------------------------------

function buildReason(
  feature: FeatureDefinition,
  upliftRec: UpliftRecommendation | undefined,
  breakdown: ScoreBreakdown,
  cluster: UserCluster,
): string {
  const parts: string[] = []
  if (upliftRec === 'high_priority_promote') {
    parts.push('uplift rétention élevé')
  } else if (upliftRec === 'consider_promote') {
    parts.push('uplift rétention modéré')
  }
  if (breakdown.cluster_fit_points > 0) {
    parts.push(`fit cluster ${cluster}`)
  }
  if (breakdown.tenure_fit_points > 0) {
    parts.push('tenure idéal')
  }
  if (parts.length === 0) {
    return `Promotion ${feature.display_name} — feature sous-utilisée, candidat éligible.`
  }
  return `Promotion ${feature.display_name} — ${parts.join(' · ')}.`
}

// ---------------------------------------------------------------------------
// Main : decide
// ---------------------------------------------------------------------------

interface Candidate {
  feature: FeatureDefinition
  score: number
  breakdown: ScoreBreakdown
  upliftRec: UpliftRecommendation | undefined
}

/**
 * Décide quelle feature promouvoir à un user donné, ou aucune.
 *
 * Étapes :
 *   1. Filtre features candidates : non utilisée + tier compatible
 *      + analyzer recommended_action='promote'.
 *   2. Score chaque candidate avec retention + cluster + tenure.
 *   3. Retourne la candidate top score (ou null).
 *
 * @example
 * ```ts
 * const decision = decidePromotionForUser(
 *   { user_id: 'u1', cluster: 'occasional_solo', tenure_months: 2,
 *     current_tier: 'solo', features_used_30d: ['photo_geolocation'] },
 *   feature_analyses,
 *   retention_uplifts,
 * )
 * // → { feature_to_promote: 'voice_capture', priority_score: 80, ... }
 * ```
 */
export function decidePromotionForUser(
  user: PromotionTarget,
  feature_analyses: ReadonlyArray<FeatureAnalysis>,
  retention_uplifts: ReadonlyArray<RetentionUpliftResult>,
): PromotionDecision {
  // Index pour lookups O(1)
  const usedSet = new Set(user.features_used_30d)
  const analysisById = new Map<FeatureId, FeatureAnalysis>(
    feature_analyses.map((a) => [a.feature_id, a]),
  )
  const upliftById = new Map<FeatureId, RetentionUpliftResult>(
    retention_uplifts.map((u) => [u.feature_id, u]),
  )

  // Tier comparator : si user.current_tier = 'enterprise', il a accès à tout.
  // Sinon on compare via tierGte sur les 4 tiers Feature.
  const userFeatureTier: FeatureTier =
    user.current_tier === 'enterprise' ? 'cabinet_plus' : user.current_tier

  const candidates: Candidate[] = []
  for (const feature of FEATURES_CATALOG) {
    // 1. Pas déjà utilisée
    if (usedSet.has(feature.id)) continue

    // 2. Tier compatible (user.tier >= feature.available_from_tier)
    if (!tierGte(userFeatureTier, feature.available_from_tier)) continue

    // 3. Analyzer recommande 'promote'
    const analysis = analysisById.get(feature.id)
    const action: RecommendedAction | undefined = analysis?.recommended_action
    if (action !== 'promote') continue

    // 4. Retention uplift (optionnel, mais doit être au minimum 'consider_promote' si présent)
    const uplift = upliftById.get(feature.id)
    if (uplift && uplift.recommendation === 'no_action') continue

    // 5. Score
    const breakdown: ScoreBreakdown = {
      retention_uplift_points: uplitfPoints(uplift?.recommendation),
      cluster_fit_points: clusterFitPoints(feature.id, user.cluster),
      tenure_fit_points: tenureFitPoints(feature.id, user.tenure_months),
      churning_penalty: churningPenalty(user.cluster),
    }
    const score = sumBreakdown(breakdown)
    candidates.push({ feature, score, breakdown, upliftRec: uplift?.recommendation })
  }

  // Pas de candidate → no-op
  if (candidates.length === 0) {
    return {
      user_id: user.user_id,
      feature_to_promote: null,
      priority_score: 0,
      reason:
        user.cluster === 'churning'
          ? 'User en churning — focus retention, pas de promotion cette semaine.'
          : 'Aucune feature éligible à promouvoir cette semaine.',
      email_template_suggestion: NO_PROMO_TEMPLATE,
    }
  }

  // Tri desc par score, puis par tenure fit (déterministe en cas d'égalité)
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.breakdown.tenure_fit_points - a.breakdown.tenure_fit_points
  })

  const top = candidates[0]
  if (!top) {
    return {
      user_id: user.user_id,
      feature_to_promote: null,
      priority_score: 0,
      reason: 'Aucune feature éligible à promouvoir cette semaine.',
      email_template_suggestion: NO_PROMO_TEMPLATE,
    }
  }
  return {
    user_id: user.user_id,
    feature_to_promote: top.feature.id,
    priority_score: top.score,
    reason: buildReason(top.feature, top.upliftRec, top.breakdown, user.cluster),
    email_template_suggestion: FEATURE_TO_TEMPLATE_MAP[top.feature.id],
  }
}

/**
 * Trie les décisions par priority_score décroissant et garde les top N.
 *
 * Les décisions sans feature_to_promote (null) sont exclues du résultat —
 * le caller doit les conserver à part s'il a besoin de tracer le no-op.
 *
 * @example
 * ```ts
 * const top50 = rankPromotionDecisions(allDecisions, 50)
 * for (const d of top50) {
 *   await sendEmail(d.user_id, d.email_template_suggestion)
 * }
 * ```
 */
export function rankPromotionDecisions(
  decisions: ReadonlyArray<PromotionDecision>,
  max_count: number,
): PromotionDecision[] {
  if (max_count <= 0) return []
  return decisions
    .filter((d) => d.feature_to_promote !== null)
    .slice()
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, max_count)
}
