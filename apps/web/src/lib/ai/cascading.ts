/**
 * KOVAS — Model cascading Haiku → Sonnet dynamique (Lot B47).
 *
 * Pattern documenté dans `docs/refonte-2026-05/AI_ECONOMICS.md` § Technique 3.
 *
 * Principe :
 *   1. Pass 1 — Haiku 4.5 ($1/$5 par Mtoken) avec system prompt cached
 *   2. Si `result.confidence >= threshold` (default 0.85) → on garde Haiku
 *   3. Sinon → escalation Sonnet 4.6 ($3/$15) avec le même payload
 *
 * Économie attendue sur 1000 analyses :
 *   - Sans cascading (Sonnet direct) : 1000 × 0.015€ = 15€
 *   - Avec cascading (70% Haiku résolus + 30% escalation Sonnet) :
 *     700 × 0.003€ + 300 × 0.015€ = 2.1 + 4.5 = 6.6€ → **−56% de coût**
 *
 * Tracker `escalation_rate` dans `analytics.ai_cost_metrics` pour surveiller
 * la qualité de Haiku. Si le taux dépasse 50%, le système n'est plus optimal
 * (le coût total devient comparable à Sonnet direct car deux appels).
 *
 * IMPORTANT : ce module fournit la décision pure (escalate ? oui/non) + un
 * helper qui orchestre les 2 appels via un client injecté. Le couplage avec
 * la SDK Anthropic reste côté appelant (lazy import) pour rester testable.
 */

import {
  ANTHROPIC_MODELS,
  type AnthropicTier,
  PRICING_USD_PER_MTOK,
  computeAnthropicCostEur,
  usdToEur,
} from './anthropic-config'

/** Seuil par défaut de confiance Haiku au-dessus duquel on n'escalade PAS. */
export const DEFAULT_CASCADING_CONFIDENCE_THRESHOLD = 0.85

export interface CascadingDecision {
  /** Si true, on conserve la réponse Haiku. Sinon, on escalade vers Sonnet. */
  keep: boolean
  /** Tier retenu (haiku si keep=true, sonnet si keep=false). */
  tier: AnthropicTier
  /** Raison textuelle (logs + debug). */
  reason: string
}

/**
 * Décision pure : faut-il garder Haiku ou escalader Sonnet ?
 *
 * - confidence null/undefined → escalation (le modèle n'a pas pu se prononcer)
 * - confidence < 0 ou > 1 (anomalie) → escalation (signal défensif)
 * - confidence >= threshold → keep Haiku
 * - sinon → escalation Sonnet
 */
export function decideCascading(
  confidence: number | null | undefined,
  threshold: number = DEFAULT_CASCADING_CONFIDENCE_THRESHOLD,
): CascadingDecision {
  if (confidence === null || confidence === undefined) {
    return {
      keep: false,
      tier: 'sonnet',
      reason: 'confidence absente du retour Haiku — escalation par sécurité',
    }
  }
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return {
      keep: false,
      tier: 'sonnet',
      reason: `confidence anormale (${confidence}) — escalation défensive`,
    }
  }
  if (confidence >= threshold) {
    return {
      keep: true,
      tier: 'haiku',
      reason: `confidence ${confidence.toFixed(2)} >= seuil ${threshold.toFixed(2)}`,
    }
  }
  return {
    keep: false,
    tier: 'sonnet',
    reason: `confidence ${confidence.toFixed(2)} < seuil ${threshold.toFixed(2)} — escalation Sonnet`,
  }
}

export interface CascadingMetrics {
  /** Coût total EUR de l'opération (somme des passes effectuées). */
  total_cost_eur: number
  /** Modèle final qui a fourni la réponse retenue. */
  final_model: string
  /** True si une escalation Sonnet a eu lieu (= 2 appels au lieu d'1). */
  escalated: boolean
  /** Pour audit : coût Haiku seul (toujours payé même si escalation). */
  haiku_cost_eur: number
  /** Coût Sonnet (0 si pas d'escalation). */
  sonnet_cost_eur: number
}

interface CascadingTokenUsage {
  input: number
  output: number
  cached?: number
  cacheWrite?: number
}

/**
 * Calcule les métriques de coût d'une opération cascading.
 * Pure-fn — utilisée par l'orchestrator côté Edge Function / route handler.
 */
export function computeCascadingMetrics(input: {
  haikuUsage: CascadingTokenUsage
  sonnetUsage: CascadingTokenUsage | null
}): CascadingMetrics {
  const haikuCost = computeAnthropicCostEur(ANTHROPIC_MODELS.haiku, input.haikuUsage)
  const sonnetCost = input.sonnetUsage
    ? computeAnthropicCostEur(ANTHROPIC_MODELS.sonnet, input.sonnetUsage)
    : 0
  return {
    total_cost_eur: Math.round((haikuCost + sonnetCost) * 1_000_000) / 1_000_000,
    final_model: input.sonnetUsage ? ANTHROPIC_MODELS.sonnet : ANTHROPIC_MODELS.haiku,
    escalated: input.sonnetUsage !== null,
    haiku_cost_eur: haikuCost,
    sonnet_cost_eur: sonnetCost,
  }
}

/**
 * Estime l'économie réalisée par cascading sur N analyses, en supposant un
 * taux d'escalation donné. Utilisé par le dashboard `/admin/sante-tech`
 * section AI pour projeter les économies face à un "Sonnet direct partout".
 *
 * Hypothèse simplificatrice : on prend un payload moyen (1500 tok input,
 * 500 tok output) pour le calcul comparatif.
 */
export function estimateCascadingSavings(input: {
  totalAnalyses: number
  escalationRate: number // 0-1, ex 0.3 = 30% d'escalation
  avgInputTokens?: number
  avgOutputTokens?: number
}): {
  baseline_cost_eur: number
  cascading_cost_eur: number
  saved_eur: number
  saved_pct: number
} {
  const inTok = input.avgInputTokens ?? 1500
  const outTok = input.avgOutputTokens ?? 500
  const escRate = Math.max(0, Math.min(1, input.escalationRate))

  const haikuP = PRICING_USD_PER_MTOK['claude-haiku-4-5']
  const sonnetP = PRICING_USD_PER_MTOK['claude-sonnet-4-6']
  if (!haikuP || !sonnetP) {
    return { baseline_cost_eur: 0, cascading_cost_eur: 0, saved_eur: 0, saved_pct: 0 }
  }

  // Coût unitaire EUR par appel
  const eurRate = usdToEur()
  const haikuPerCall =
    ((inTok / 1_000_000) * haikuP.input + (outTok / 1_000_000) * haikuP.output) * eurRate
  const sonnetPerCall =
    ((inTok / 1_000_000) * sonnetP.input + (outTok / 1_000_000) * sonnetP.output) * eurRate

  // Baseline : 100% Sonnet
  const baseline = input.totalAnalyses * sonnetPerCall
  // Cascading : 100% Haiku + (escalation rate × Sonnet en plus)
  const cascading =
    input.totalAnalyses * haikuPerCall + input.totalAnalyses * escRate * sonnetPerCall

  const saved = Math.max(0, baseline - cascading)
  return {
    baseline_cost_eur: Math.round(baseline * 1_000_000) / 1_000_000,
    cascading_cost_eur: Math.round(cascading * 1_000_000) / 1_000_000,
    saved_eur: Math.round(saved * 1_000_000) / 1_000_000,
    saved_pct: baseline > 0 ? Math.round((saved / baseline) * 1000) / 10 : 0,
  }
}
