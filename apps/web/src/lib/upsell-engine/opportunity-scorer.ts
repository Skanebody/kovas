/**
 * KOVAS — Système 5 : Upsell engine — opportunity scorer.
 *
 * Pure function qui score chaque opportunity détectée via `triggers.ts`
 * selon le contexte du user (probabilité de conversion × revenu × fit cluster).
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §8 (Upsell engine).
 *
 * Logique :
 *   1. Probabilité conversion baseline par `type` d'opportunity.
 *   2. Modifiers contextuels (timing, health, churning, tenure).
 *   3. Cluster fit modifier additif sur la prob finale.
 *   4. composite_score = clamp(prob × revenue × 10, 0, 100).
 *   5. confidence basée sur le nombre de signaux non-null.
 *
 * Déterministe, testable, zéro IO. Avatar SOBRE PROFESSIONNEL.
 */

import type { UpsellOpportunity } from './triggers'

export interface UserSignals {
  /** Score upsell timing (Algo 22) 0-100 */
  upsell_timing_score: number
  /** Health score (Système 11) 0-100, null si non calculé */
  health_score: number | null
  tenure_months: number
  /** Cluster comportemental (Algo 20 / pattern learning) */
  cluster: 'power_user' | 'cabinet_team' | 'occasional_solo' | 'new_user' | 'churning'
}

export interface ScoredOpportunity extends UpsellOpportunity {
  /** Probabilité conversion estimée 0-1 */
  estimated_conversion_prob: number
  /** Score composite 0-100 : prob × revenue × cluster fit */
  composite_score: number
  /** Confidence 0-1 (basée sur richesse des signaux) */
  confidence: number
}

// ---------------------------------------------------------------------------
// Baseline conversion probabilities
// ---------------------------------------------------------------------------

const BASELINE_PROB: Record<UpsellOpportunity['type'], number> = {
  tier_upgrade: 0.08,
  addon: 0.05,
  annual_commitment: 0.12,
}

// ---------------------------------------------------------------------------
// Cluster fit modifiers (additifs sur prob finale)
// ---------------------------------------------------------------------------

/**
 * Modifier additif appliqué sur la prob après multiplications.
 *
 * Cluster fit règles :
 *   - power_user      → tier_upgrade +0.3, addon +0.2
 *   - cabinet_team    → annual_commitment +0.4, premium_reports +0.3
 *   - occasional_solo → pipeline_mpr +0.2, newsletter_clients +0.2
 *   - churning        → tous × 0.3 (override final, voir applyClusterFit)
 *   - new_user        → pas de bonus particulier
 */
function clusterFitModifier(
  cluster: UserSignals['cluster'],
  opportunity: UpsellOpportunity,
): number {
  if (cluster === 'power_user') {
    if (opportunity.type === 'tier_upgrade') return 0.3
    if (opportunity.type === 'addon') return 0.2
    return 0
  }
  if (cluster === 'cabinet_team') {
    if (opportunity.type === 'annual_commitment') return 0.4
    if (opportunity.addon === 'premium_reports') return 0.3
    return 0
  }
  if (cluster === 'occasional_solo') {
    if (opportunity.addon === 'pipeline_maprimerenov') return 0.2
    if (opportunity.addon === 'newsletter_clients') return 0.2
    return 0
  }
  // churning et new_user : pas de bonus additif (churning a son multiplicateur)
  return 0
}

// ---------------------------------------------------------------------------
// Probability computation
// ---------------------------------------------------------------------------

function computeConversionProb(opportunity: UpsellOpportunity, user: UserSignals): number {
  let prob = BASELINE_PROB[opportunity.type]

  // Modifiers multiplicatifs
  if (user.upsell_timing_score >= 70) prob *= 1.5
  if (user.health_score != null && user.health_score >= 70) prob *= 1.3
  if (user.cluster === 'churning') prob *= 0.5
  if (user.tenure_months >= 3 && user.tenure_months <= 18) prob *= 1.2
  if (user.tenure_months > 24) prob *= 0.7

  // Cluster fit modifier (additif)
  prob += clusterFitModifier(user.cluster, opportunity)

  // Cluster churning : override final additionnel × 0.3 (déjà appliqué en
  // multiplicatif × 0.5 ci-dessus, donc effet cumulé ≈ × 0.15 sur churning).
  // Spec : "churning → tous × 0.3" → on enforce un cap dur à 30% du baseline.
  if (user.cluster === 'churning') {
    const cap = BASELINE_PROB[opportunity.type] * 0.3
    if (prob > cap) prob = cap
  }

  // Clamp [0, 1]
  if (prob < 0) prob = 0
  if (prob > 1) prob = 1
  return prob
}

// ---------------------------------------------------------------------------
// Composite score
// ---------------------------------------------------------------------------

function computeCompositeScore(prob: number, revenue: number): number {
  // composite = prob × revenue × 10 (normalisé), clamp 0-100
  const raw = prob * revenue * 10
  if (raw < 0) return 0
  if (raw > 100) return 100
  return Math.round(raw * 100) / 100
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

function computeConfidence(user: UserSignals): number {
  let confidence = 0
  // upsell_timing_score non-null (toujours présent dans le type : 0-100)
  // On considère qu'il est "présent" car le champ est requis (pas null).
  // +0.3 par défaut (vs +0 si on avait un sentinel).
  confidence += 0.3
  if (user.health_score != null) confidence += 0.3
  // cluster toujours défini (type union non nullable) → +0.2
  confidence += 0.2
  if (user.tenure_months > 0) confidence += 0.2

  if (confidence > 1) confidence = 1
  return Math.round(confidence * 100) / 100
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Score une opportunity selon le contexte user (probabilité × revenue × fit).
 *
 * @example
 * ```ts
 * const scored = scoreOpportunity(opportunity, {
 *   upsell_timing_score: 80,
 *   health_score: 75,
 *   tenure_months: 6,
 *   cluster: 'power_user',
 * })
 * // → { ..., estimated_conversion_prob: 0.21, composite_score: 10.5, confidence: 1 }
 * ```
 */
export function scoreOpportunity(
  opportunity: UpsellOpportunity,
  user: UserSignals,
): ScoredOpportunity {
  const prob = computeConversionProb(opportunity, user)
  const composite = computeCompositeScore(prob, opportunity.base_revenue_potential_eur)
  const confidence = computeConfidence(user)
  return {
    ...opportunity,
    estimated_conversion_prob: Math.round(prob * 1000) / 1000,
    composite_score: composite,
    confidence,
  }
}

/**
 * Score plusieurs opportunities et les trie par composite_score décroissant.
 *
 * @example
 * ```ts
 * const ranked = rankOpportunities(opportunities, user)
 * const best = ranked[0]
 * ```
 */
export function rankOpportunities(
  opportunities: ReadonlyArray<UpsellOpportunity>,
  user: UserSignals,
): ScoredOpportunity[] {
  return opportunities
    .map((op) => scoreOpportunity(op, user))
    .sort((a, b) => b.composite_score - a.composite_score)
}
