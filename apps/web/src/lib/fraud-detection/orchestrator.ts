/**
 * Orchestrator détection fraude DPE.
 * Lance les 4 patterns en parallèle, agrège les scores, persiste les signaux
 * dans `fraud_signals`. Déclenché soit en hook DB (Edge Function sur INSERT
 * diagnostic_scans), soit manuellement depuis l'admin.
 *
 * Score global :
 *  - overallScore = max(severity_i) — politique conservatrice
 *    (un seul pattern à 0.9 suffit pour flagger ; pas de dilution par moyenne)
 *  - flagged = overallScore ≥ 0.7
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { type ClassAnomalyInput, detectClassAnomaly } from './patterns/class-anomaly'
import {
  type GeolocationInput,
  detectGeolocationInconsistency,
} from './patterns/geolocation-inconsistency'
import { type VelocityInput, detectProcessingVelocity } from './patterns/processing-velocity'
import {
  type SignatureSimilarityInput,
  detectSignatureSimilarity,
} from './patterns/signature-similarity'
import type { FraudDetectionResult, FraudSignal } from './types'

export interface FraudDetectionInputs {
  classAnomaly?: ClassAnomalyInput
  processingVelocity?: VelocityInput
  geolocation?: GeolocationInput
  signatureSimilarity?: SignatureSimilarityInput
}

const FLAG_THRESHOLD = 0.7

/**
 * Lance les patterns activés (input non-undefined) et retourne le résultat agrégé.
 * Pas d'I/O — pure function utilisable hors Supabase (tests, dry-run admin).
 */
export function runFraudPatterns(inputs: FraudDetectionInputs): FraudDetectionResult {
  const signals: FraudSignal[] = []

  if (inputs.classAnomaly) {
    signals.push(detectClassAnomaly(inputs.classAnomaly))
  }
  if (inputs.processingVelocity) {
    signals.push(detectProcessingVelocity(inputs.processingVelocity))
  }
  if (inputs.geolocation) {
    signals.push(detectGeolocationInconsistency(inputs.geolocation))
  }
  if (inputs.signatureSimilarity) {
    signals.push(detectSignatureSimilarity(inputs.signatureSimilarity))
  }

  const overallScore = signals.reduce((max, s) => Math.max(max, s.severity), 0)
  const flagged = overallScore >= FLAG_THRESHOLD

  return { overallScore, flagged, signals }
}

export interface PersistOptions {
  supabase: SupabaseClient
  missionId?: string
  diagnosticScanId?: string
  /** N'enregistre que les signaux dont la severity dépasse ce seuil. Défaut 0.3. */
  persistThreshold?: number
}

/**
 * Persiste les signaux en base. Ne persiste que les signaux dont la severity
 * dépasse `persistThreshold` (évite de polluer la table avec des "clean" runs).
 */
export async function persistFraudSignals(
  result: FraudDetectionResult,
  options: PersistOptions,
): Promise<{ inserted: number }> {
  const { supabase, missionId, diagnosticScanId, persistThreshold = 0.3 } = options

  if (!missionId && !diagnosticScanId) {
    throw new Error('persistFraudSignals: missionId or diagnosticScanId is required')
  }
  if (missionId && diagnosticScanId) {
    throw new Error('persistFraudSignals: only one of missionId / diagnosticScanId allowed')
  }

  const rowsToInsert = result.signals
    .filter((s) => s.severity >= persistThreshold)
    .map((s) => ({
      mission_id: missionId ?? null,
      diagnostic_scan_id: diagnosticScanId ?? null,
      pattern: s.pattern,
      severity: s.severity,
      details: { ...s.details, reason: s.reason },
    }))

  if (rowsToInsert.length === 0) {
    return { inserted: 0 }
  }

  const { error } = await supabase.from('fraud_signals').insert(rowsToInsert)
  if (error) {
    throw new Error(`persistFraudSignals: ${error.message}`)
  }
  return { inserted: rowsToInsert.length }
}

/**
 * Pipeline complète : run + persist.
 */
export async function detectFraud(params: {
  supabase: SupabaseClient
  missionId?: string
  diagnosticScanId?: string
  inputs: FraudDetectionInputs
  persistThreshold?: number
}): Promise<FraudDetectionResult & { inserted: number }> {
  const result = runFraudPatterns(params.inputs)
  const { inserted } = await persistFraudSignals(result, {
    supabase: params.supabase,
    ...(params.missionId !== undefined ? { missionId: params.missionId } : {}),
    ...(params.diagnosticScanId !== undefined ? { diagnosticScanId: params.diagnosticScanId } : {}),
    ...(params.persistThreshold !== undefined ? { persistThreshold: params.persistThreshold } : {}),
  })
  return { ...result, inserted }
}
