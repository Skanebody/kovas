/**
 * KOVAS — Algo A1.3.8 : Annuaire sync DHUP + SIRENE + COFRAC + GMB.
 *
 * Pure function qui calcule l'activity_score (0-1) et les fraud_signals d'un
 * diagnostiqueur à partir des signaux croisés des 4 sources externes. La
 * fonction est consommée par :
 *   - Edge Function `verify-diagnosticians-daily` (cron quotidien 03 UTC,
 *     batch 500 LRU)
 *   - Endpoint admin `/admin/diagnostiqueurs/audit` (vérif manuelle)
 *
 * Logique extraite et codifiée à partir de l'Edge Function existante, pour
 * permettre des tests unitaires déterministes et une réutilisation
 * server-side dans Next.js (sans dépendance Deno).
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §A1.3.8 + Edge Function
 * `supabase/functions/verify-diagnosticians-daily/index.ts`.
 */

export type SireneState = 'active' | 'closed' | 'unknown' | null

export interface AnnuaireSyncInput {
  /** Dernier sync DHUP (ISO date ou Date), null si jamais synchronisé */
  dhup_last_synced_at: string | Date | null
  /** État administratif SIRENE */
  sirene_state: SireneState
  /** Note Google Maps Business 0-5 */
  gmb_rating: number | null
  /** Nombre d'avis GMB */
  gmb_review_count: number | null
  /** Nombre de certifications COFRAC valides (non expirées) */
  cofrac_valid_count: number
  /** Date de référence pour le calcul "DHUP actif < 60 jours" */
  reference_date?: Date
}

export type FraudSignalType =
  | 'sirene_closed'
  | 'dhup_stale'
  | 'no_cofrac_valid'
  | 'no_gmb_reputation'
  | 'low_activity'

export interface FraudSignal {
  type: FraudSignalType
  severity: 'info' | 'warning' | 'critical'
  reason: string
  detected_at: string
}

export interface AnnuaireSyncResult {
  /** Activity score 0-1 */
  activity_score: number
  /** Décomposition des points par source (audit) */
  score_breakdown: {
    dhup_active: { points: number; passed: boolean; detail: string }
    sirene_active: { points: number; passed: boolean; detail: string }
    gmb_present: { points: number; passed: boolean; detail: string }
    cofrac_valid: { points: number; passed: boolean; detail: string }
  }
  /** Signaux fraude détectés (peut être vide) */
  fraud_signals: ReadonlyArray<FraudSignal>
  /** Recommandation visibilité publique (consommée par RLS annuaire) */
  should_hide_from_public: boolean
  /** Recommandation pour le pipeline KOVAS */
  recommended_action: 'visible' | 'monitor' | 'hide_pending_review' | 'auto_suspend'
}

const POINTS_DHUP = 0.4
const POINTS_SIRENE = 0.3
const POINTS_GMB = 0.2
const POINTS_COFRAC = 0.1

const FRESHNESS_DHUP_DAYS = 60

function parseDate(v: string | Date | null): Date | null {
  if (v == null) return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function daysBetween(target: Date, reference: Date): number {
  const MS = 24 * 60 * 60 * 1000
  return Math.floor((reference.getTime() - target.getTime()) / MS)
}

export function syncAnnuaireDiagnostician(input: AnnuaireSyncInput): AnnuaireSyncResult {
  const ref = input.reference_date ?? new Date()
  const dhupSync = parseDate(input.dhup_last_synced_at)
  const daysSinceDhup = dhupSync ? daysBetween(dhupSync, ref) : Number.POSITIVE_INFINITY

  // 1. DHUP actif (sync < 60 jours)
  const dhupActive = daysSinceDhup < FRESHNESS_DHUP_DAYS
  const dhupBreakdown = {
    points: dhupActive ? POINTS_DHUP : 0,
    passed: dhupActive,
    detail: dhupActive
      ? `DHUP synchronisé il y a ${daysSinceDhup} jours`
      : dhupSync
        ? `DHUP non synchronisé depuis ${daysSinceDhup} jours (seuil ${FRESHNESS_DHUP_DAYS})`
        : 'Jamais synchronisé avec DHUP',
  }

  // 2. SIRENE actif
  const sireneActive = input.sirene_state === 'active'
  const sireneBreakdown = {
    points: sireneActive ? POINTS_SIRENE : 0,
    passed: sireneActive,
    detail:
      input.sirene_state === 'active'
        ? 'SIRET actif (INSEE Sirene)'
        : input.sirene_state === 'closed'
          ? 'SIRET clôturé (cessation détectée)'
          : 'SIRET non vérifié ou inconnu',
  }

  // 3. GMB présent (rating > 0 et au moins quelques avis)
  const gmbPresent = (input.gmb_rating ?? 0) > 0 && (input.gmb_review_count ?? 0) > 0
  const gmbBreakdown = {
    points: gmbPresent ? POINTS_GMB : 0,
    passed: gmbPresent,
    detail: gmbPresent
      ? `Google Maps : ${input.gmb_rating?.toFixed(1)}/5 (${input.gmb_review_count} avis)`
      : 'Aucune présence Google Maps Business',
  }

  // 4. Au moins une certification COFRAC valide
  const cofracValid = input.cofrac_valid_count > 0
  const cofracBreakdown = {
    points: cofracValid ? POINTS_COFRAC : 0,
    passed: cofracValid,
    detail: cofracValid
      ? `${input.cofrac_valid_count} certification(s) COFRAC valide(s)`
      : 'Aucune certification COFRAC valide',
  }

  const score =
    dhupBreakdown.points + sireneBreakdown.points + gmbBreakdown.points + cofracBreakdown.points
  const roundedScore = Math.round(score * 100) / 100

  // 5. Fraud signals
  const fraud: FraudSignal[] = []
  const nowIso = ref.toISOString()

  if (input.sirene_state === 'closed') {
    fraud.push({
      type: 'sirene_closed',
      severity: 'critical',
      reason: 'SIRET clôturé — activité cessée',
      detected_at: nowIso,
    })
  }
  if (!dhupActive) {
    fraud.push({
      type: 'dhup_stale',
      severity: dhupSync ? 'warning' : 'critical',
      reason: dhupSync ? `Sync DHUP périmée (${daysSinceDhup} j)` : 'Jamais synchronisé avec DHUP',
      detected_at: nowIso,
    })
  }
  if (!cofracValid) {
    fraud.push({
      type: 'no_cofrac_valid',
      severity: 'warning',
      reason: 'Aucune certification COFRAC valide trouvée',
      detected_at: nowIso,
    })
  }
  if (!gmbPresent) {
    fraud.push({
      type: 'no_gmb_reputation',
      severity: 'info',
      reason: 'Aucune présence Google Maps Business — réputation publique nulle',
      detected_at: nowIso,
    })
  }
  if (roundedScore < 0.5) {
    fraud.push({
      type: 'low_activity',
      severity: 'warning',
      reason: `Score d'activité ${roundedScore.toFixed(2)} sous le seuil 0.50`,
      detected_at: nowIso,
    })
  }

  // 6. Action recommandée
  const shouldHide = roundedScore < 0.5 || input.sirene_state === 'closed'
  const action: AnnuaireSyncResult['recommended_action'] =
    input.sirene_state === 'closed'
      ? 'auto_suspend'
      : roundedScore < 0.3
        ? 'hide_pending_review'
        : roundedScore < 0.5
          ? 'monitor'
          : 'visible'

  return {
    activity_score: roundedScore,
    score_breakdown: {
      dhup_active: dhupBreakdown,
      sirene_active: sireneBreakdown,
      gmb_present: gmbBreakdown,
      cofrac_valid: cofracBreakdown,
    },
    fraud_signals: fraud,
    should_hide_from_public: shouldHide,
    recommended_action: action,
  }
}
