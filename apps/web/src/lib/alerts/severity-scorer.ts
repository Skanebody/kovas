/**
 * Severity scoring — applique la philosophie KOVAS de tolérance large.
 *
 * Principe : on remonte le seuil critical pour qu'il soit RARE (max 1
 * sur 100 missions). La grande majorité des findings sont info ou warning.
 */

import type { AlertSeverity, Finding } from './types'

export interface ScoringContext {
  /** Sensibilité réglée par l'utilisateur — affecte la barre critique. */
  sensitivity?: 'normal' | 'low' | 'very_low'
  /** Mode pré-export — permissive abaisse encore les seuils. */
  strictness?: 'standard' | 'permissive'
}

/**
 * Re-score un finding selon la tolérance KOVAS.
 * En mode permissive ou sensibilité very_low :
 *  - critical → warning
 *  - warning → info
 *
 * En sensibilité low :
 *  - critical reste critical seulement si priorityScore >= 80
 *
 * En sensibilité normal (défaut) :
 *  - critical exige priorityScore >= 60
 */
export function scoreSeverity(
  finding: Pick<Finding, 'severity' | 'priorityScore'>,
  ctx: ScoringContext = {},
): AlertSeverity {
  const { sensitivity = 'normal', strictness = 'standard' } = ctx
  const score = finding.priorityScore ?? severityToScore(finding.severity)

  if (strictness === 'permissive' || sensitivity === 'very_low') {
    if (finding.severity === 'critical') return 'warning'
    if (finding.severity === 'warning') return 'info'
    return 'info'
  }

  if (sensitivity === 'low') {
    if (finding.severity === 'critical' && score < 80) return 'warning'
    return finding.severity
  }

  // normal — relève la barre critical
  if (finding.severity === 'critical' && score < 60) {
    return 'warning'
  }
  return finding.severity
}

function severityToScore(s: AlertSeverity): number {
  switch (s) {
    case 'critical':
      return 70
    case 'warning':
      return 40
    case 'info':
      return 20
  }
}
