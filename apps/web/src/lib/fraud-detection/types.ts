/**
 * Types partagés détection fraude DPE.
 *
 * Chaque pattern produit un FraudSignal (severity 0-1 + détails).
 * L'orchestrator agrège les signaux en un overallScore + flag global.
 */

export type FraudPattern =
  | 'class_anomaly'
  | 'processing_velocity'
  | 'geolocation_inconsistency'
  | 'signature_similarity'

export type DpeClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export interface FraudSignal {
  pattern: FraudPattern
  /** Score 0-1. 1 = certitude de fraude, 0 = aucun indice. */
  severity: number
  /** Vrai si severity ≥ 0.5 (seuil de signalement individuel). */
  flagged: boolean
  /** Justification humaine + métriques techniques. */
  reason: string
  /** Données structurées pour l'audit (jsonb persistance). */
  details: Record<string, unknown>
}

export interface FraudDetectionResult {
  overallScore: number
  /** Vrai si overallScore ≥ 0.7 (seuil d'alerte admin). */
  flagged: boolean
  signals: FraudSignal[]
}

export interface ReviewedFraudSignalRow {
  id: string
  mission_id: string | null
  diagnostic_scan_id: string | null
  pattern: FraudPattern
  severity: number
  details: Record<string, unknown>
  detected_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  review_outcome: 'confirmed_fraud' | 'false_positive' | 'inconclusive' | null
  review_notes: string | null
}
