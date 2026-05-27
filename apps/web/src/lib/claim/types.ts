/**
 * Types partagés pour le claim flow Doctolib pattern (refonte 2026-05-27).
 *
 * Source de vérité côté DB : migration
 * `supabase/migrations/20260527150000_claim_kyc_doctolib_pattern.sql`.
 *
 * State machine v2 (Doctolib) :
 *   pending → siret_verified → phone_verified → identity_uploaded
 *   → review_pending → approved (=verified historique) | rejected
 *
 * Les statuts v1 (code_sent, verified) restent valides pour compat back ;
 * v2 ajoute siret_verified, phone_verified, identity_uploaded, review_pending,
 * approved.
 */

export type ClaimStatusV2 =
  | 'pending'
  | 'code_sent'
  | 'siret_verified'
  | 'phone_verified'
  | 'identity_uploaded'
  | 'review_pending'
  | 'verified' // compat v1
  | 'approved'
  | 'rejected'
  | 'expired'

export type ClaimFlowVersion = 'v1_parallel' | 'v2_doctolib'

/** Étape courante affichée dans le stepper UI. */
export type StepperStage = 'step1_siret' | 'step2_phone' | 'step3_identity' | 'submitted'

/**
 * Déduit l'étape à présenter selon le status DB.
 * - status pending/expired/code_sent  → step1_siret (recommencer)
 * - status siret_verified             → step2_phone
 * - status phone_verified             → step3_identity
 * - status identity_uploaded/review_pending/approved/rejected → submitted
 */
export function stepperStageFromStatus(status: ClaimStatusV2 | null | undefined): StepperStage {
  switch (status) {
    case 'siret_verified':
      return 'step2_phone'
    case 'phone_verified':
      return 'step3_identity'
    case 'identity_uploaded':
    case 'review_pending':
    case 'approved':
    case 'verified':
    case 'rejected':
      return 'submitted'
    default:
      return 'step1_siret'
  }
}

export interface ClaimSnapshot {
  claimId: string | null
  status: ClaimStatusV2 | null
  siretVerifiedAt: string | null
  phoneVerifiedAt: string | null
  identityUploadedAt: string | null
  kycScore: number | null
  kycDecision: 'approved' | 'rejected' | null
}

/** Snapshot vide initial. */
export const emptyClaimSnapshot: ClaimSnapshot = {
  claimId: null,
  status: null,
  siretVerifiedAt: null,
  phoneVerifiedAt: null,
  identityUploadedAt: null,
  kycScore: null,
  kycDecision: null,
}
