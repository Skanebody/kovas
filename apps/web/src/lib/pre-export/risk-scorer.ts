/**
 * KOVAS — Pré-export · Risk scorer.
 *
 * Agrège les 6 sous-scores en un score global pondéré 0-100 :
 *   - 40 pts : conformité ADEME (axis_scores.conformity * 40)
 *   - 20 pts : cohérence interne (axis_scores.coherence * 20)
 *   - 20 pts : cohérence statistique (axis_scores.statistical * 20)
 *   - 10 pts : qualité photos & observations (axis_scores.quality * 10)
 *   - 10 pts : exhaustivité optionnelle (axis_scores.exhaustivity * 10)
 *
 * Interprétation textuelle déterminée par `interpretScore` (lib/pre-export/types).
 */

import {
  type Finding,
  type PreExportAnalysisResult,
  interpretScore,
  SCORE_WEIGHTS,
} from './types'

export interface SubScores {
  conformity: number // 0-1
  coherence: number // 0-1
  statistical: number // 0-1
  quality: number // 0-1
  exhaustivity: number // 0-1
}

export function computeGlobalScore(
  subScores: SubScores,
  findings: Finding[],
  durationMs: number,
): PreExportAnalysisResult {
  const conformity_score = Math.round(subScores.conformity * SCORE_WEIGHTS.conformity)
  const coherence_score = Math.round(subScores.coherence * SCORE_WEIGHTS.coherence)
  const statistical_score = Math.round(subScores.statistical * SCORE_WEIGHTS.statistical)
  const quality_score = Math.round(subScores.quality * SCORE_WEIGHTS.quality)
  const exhaustivity_score = Math.round(subScores.exhaustivity * SCORE_WEIGHTS.exhaustivity)

  const global_score = Math.max(
    0,
    Math.min(
      100,
      conformity_score +
        coherence_score +
        statistical_score +
        quality_score +
        exhaustivity_score,
    ),
  )

  const counters = findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1
      return acc
    },
    { critical: 0, warning: 0, suggestion: 0, info: 0 } as PreExportAnalysisResult['counters'],
  )

  return {
    global_score,
    conformity_score,
    coherence_score,
    statistical_score,
    quality_score,
    exhaustivity_score,
    findings,
    interpretation: interpretScore(global_score),
    counters,
    analyzed_at: new Date().toISOString(),
    duration_ms: durationMs,
  }
}
