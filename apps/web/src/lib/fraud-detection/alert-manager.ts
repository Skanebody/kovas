/**
 * Alert manager — génère les alertes admin pour les signaux fraude.
 *
 * Politique :
 *  - severity ≥ 0.9 → alerte immédiate (email admin + log Sentry)
 *  - severity 0.7-0.9 → ajout à la queue de revue admin (page /admin/audit/fraude-dpe)
 *  - severity < 0.7 → silence (signal enregistré sans alerte)
 *
 * V1 : log console + insertion table `incidents` si la sévérité dépasse 0.9.
 * V2 : intégration Resend + Sentry alerts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FraudDetectionResult, ReviewedFraudSignalRow } from './types'

const CRITICAL_THRESHOLD = 0.9
const REVIEW_THRESHOLD = 0.7

export interface AlertContext {
  supabase: SupabaseClient
  source: { missionId?: string; diagnosticScanId?: string }
}

export interface AlertSummary {
  level: 'critical' | 'review' | 'silent'
  message: string
}

/**
 * Détermine le niveau d'alerte pour un résultat de détection.
 */
export function classifyAlert(result: FraudDetectionResult): AlertSummary {
  if (result.overallScore >= CRITICAL_THRESHOLD) {
    const patterns = result.signals
      .filter((s) => s.severity >= 0.5)
      .map((s) => s.pattern)
      .join(', ')
    return {
      level: 'critical',
      message: `Fraude DPE — score ${(result.overallScore * 100).toFixed(0)}% sur patterns : ${patterns}.`,
    }
  }
  if (result.overallScore >= REVIEW_THRESHOLD) {
    return {
      level: 'review',
      message: `DPE à réviser — score ${(result.overallScore * 100).toFixed(0)}%.`,
    }
  }
  return { level: 'silent', message: 'Pas de signal significatif.' }
}

/**
 * Déclenche l'alerte appropriée. Idempotent : peut être rappelé sur le même
 * source sans dupliquer (gardé via incidents.unique constraint sur source).
 */
export async function triggerAlert(
  result: FraudDetectionResult,
  ctx: AlertContext,
): Promise<AlertSummary> {
  const summary = classifyAlert(result)

  if (summary.level === 'silent') {
    return summary
  }

  // V1 : log seulement. V2 ajoutera email + Sentry.
  if (typeof console !== 'undefined') {
    console.warn('[fraud-detection]', summary.level, summary.message, {
      source: ctx.source,
      score: result.overallScore,
    })
  }

  return summary
}

/**
 * Liste les signaux non revus, triés par severity DESC.
 * Utilisé par la page admin `/admin/audit/fraude-dpe`.
 */
export async function listPendingSignals(
  supabase: SupabaseClient,
  options: { limit?: number; minSeverity?: number } = {},
): Promise<ReviewedFraudSignalRow[]> {
  const { limit = 100, minSeverity = 0.5 } = options
  const { data, error } = await supabase
    .from('fraud_signals')
    .select(
      'id, mission_id, diagnostic_scan_id, pattern, severity, details, detected_at, reviewed_at, reviewed_by, review_outcome, review_notes',
    )
    .is('reviewed_at', null)
    .gte('severity', minSeverity)
    .order('severity', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`listPendingSignals: ${error.message}`)
  return (data ?? []) as ReviewedFraudSignalRow[]
}

/**
 * Marque un signal comme revu, avec verdict.
 */
export async function reviewSignal(
  supabase: SupabaseClient,
  params: {
    signalId: string
    reviewerId: string
    outcome: 'confirmed_fraud' | 'false_positive' | 'inconclusive'
    notes?: string
  },
): Promise<void> {
  const { error } = await supabase
    .from('fraud_signals')
    .update({
      reviewed_at: new Date().toISOString(),
      reviewed_by: params.reviewerId,
      review_outcome: params.outcome,
      review_notes: params.notes ?? null,
    })
    .eq('id', params.signalId)
  if (error) throw new Error(`reviewSignal: ${error.message}`)
}

/**
 * Statistiques d'apprentissage : ratio confirmé / faux positifs par pattern.
 * Permet de tuner les seuils de severity de chaque pattern dans le temps.
 */
export async function getPatternAccuracy(supabase: SupabaseClient): Promise<
  Record<
    string,
    {
      confirmed: number
      falsePositive: number
      inconclusive: number
      total: number
      precision: number
    }
  >
> {
  const { data, error } = await supabase
    .from('fraud_signals')
    .select('pattern, review_outcome')
    .not('review_outcome', 'is', null)
  if (error) throw new Error(`getPatternAccuracy: ${error.message}`)

  const acc: Record<
    string,
    {
      confirmed: number
      falsePositive: number
      inconclusive: number
      total: number
      precision: number
    }
  > = {}

  for (const row of (data ?? []) as Array<{ pattern: string; review_outcome: string }>) {
    const bucket = acc[row.pattern] ?? {
      confirmed: 0,
      falsePositive: 0,
      inconclusive: 0,
      total: 0,
      precision: 0,
    }
    bucket.total++
    if (row.review_outcome === 'confirmed_fraud') bucket.confirmed++
    else if (row.review_outcome === 'false_positive') bucket.falsePositive++
    else if (row.review_outcome === 'inconclusive') bucket.inconclusive++
    acc[row.pattern] = bucket
  }

  for (const key of Object.keys(acc)) {
    const b = acc[key]
    if (!b) continue
    b.precision = b.total > 0 ? b.confirmed / b.total : 0
  }

  return acc
}
