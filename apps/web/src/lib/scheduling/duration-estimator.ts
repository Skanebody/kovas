/**
 * KOVAS — Estimation durée totale mission (Phase A scheduling).
 *
 * Algorithme :
 *   1. Trier diagnostics par durée_base décroissante (le plus long en premier)
 *   2. Pour chaque diagnostic, appliquer en cascade :
 *      base × surface_coef × property_coef × (copro_coef si COPRO_AFFECTED) × mutualization
 *   3. Sommer + bonus dépendances + coef personnel (si enabled)
 *   4. Ajouter buffer transition (depuis user_preferences ou 25min par défaut)
 *   5. Arrondi prudent :
 *        - total < 90 min → arrondi demi-heure inférieure (compression)
 *        - total ≥ 90 min → arrondi demi-heure supérieure (prudence)
 *
 * Confidence : high si > 30 missions historiques, medium > 10, low sinon.
 *
 * Authority : briefing scheduling 2026-05-20 + CLAUDE.md §3 (8 diagnostics MVP).
 */

import type { DiagnosticType } from '@/lib/mission/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  COPRO_AFFECTED,
  COPRO_COEFFICIENTS,
  DEFAULT_BUFFER_MINUTES,
  DEPENDENCY_BONUS,
  DURATION_BASE,
  MUTUALIZATION_COEFFICIENTS,
  PROPERTY_TYPE_COEFFICIENTS,
  type SchedulingOwnership,
  type SchedulingPropertyType,
  getSurfaceCoefficient,
} from './duration-schemas'

export interface MissionParameters {
  diagnostics: DiagnosticType[]
  surface: number
  propertyType: SchedulingPropertyType
  ownership: SchedulingOwnership
  hasGarage?: boolean
  hasSousSol?: boolean
  hasComblesAmenagees?: boolean
  userId: string
}

export interface DiagnosticBreakdown {
  diagnostic: DiagnosticType
  baseMinutes: number
  afterSurfaceCoef: number
  afterPropertyCoef: number
  afterCoproCoef: number
  afterMutualization: number
  finalMinutes: number
}

export interface DurationEstimate {
  /** Total brut avant arrondi (utile pour debug / explication). */
  totalMinutes: number
  /** Total arrondi à la demi-heure (downward si < 90, upward si ≥ 90). */
  totalRounded: number
  breakdown: DiagnosticBreakdown[]
  bufferMinutes: number
  personalAdjustment?: { factor: number; reason: string }
  confidence: 'high' | 'medium' | 'low'
}

interface UserPreferencesRow {
  scheduling_buffer_minutes: number | null
  personal_coefficient_enabled: boolean | null
}

interface UserPreferencesBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      maybeSingle: () => Promise<{
        data: UserPreferencesRow | null
        error: { message: string } | null
      }>
    }
  }
}

interface UserDurationCoefRow {
  global_coefficient: number | null
  enabled: boolean | null
  sample_size_total: number | null
}

interface UserDurationCoefBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      maybeSingle: () => Promise<{
        data: UserDurationCoefRow | null
        error: { message: string } | null
      }>
    }
  }
}

interface CountResult {
  count: number | null
  error: { message: string } | null
}

interface DurationHistoryBuilder {
  select: (
    cols: string,
    opts: { count: 'exact'; head: true },
  ) => {
    eq: (
      col: string,
      val: string,
    ) => {
      not: (col: string, op: string, val: null) => Promise<CountResult>
    }
  }
}

/**
 * Arrondi prudent à la demi-heure :
 * - < 90 min → arrondi inférieur (les estimations courtes ont moins de marge d'erreur)
 * - ≥ 90 min → arrondi supérieur (les longues missions tendent à déborder)
 */
function roundToHalfHour(totalMinutes: number): number {
  if (totalMinutes < 90) {
    return Math.floor(totalMinutes / 30) * 30
  }
  return Math.ceil(totalMinutes / 30) * 30
}

/**
 * Détermine le coefficient mutualisation pour un index donné (0 = first, 1 = second, etc.).
 */
function getMutualizationCoef(index: number): number {
  if (index === 0) return MUTUALIZATION_COEFFICIENTS.first
  if (index === 1) return MUTUALIZATION_COEFFICIENTS.second
  return MUTUALIZATION_COEFFICIENTS.thirdAndMore
}

/**
 * Calcule la confidence selon le nombre de missions historiques de l'utilisateur.
 */
function computeConfidence(historyCount: number): 'high' | 'medium' | 'low' {
  if (historyCount > 30) return 'high'
  if (historyCount > 10) return 'medium'
  return 'low'
}

export async function estimateDuration(
  params: MissionParameters,
  supabase: SupabaseClient,
): Promise<DurationEstimate> {
  const surfaceCoef = getSurfaceCoefficient(params.surface)
  const propertyCoef = PROPERTY_TYPE_COEFFICIENTS[params.propertyType]
  const coproCoef = COPRO_COEFFICIENTS[params.ownership]

  // 1. Lecture user_preferences (buffer + personal_coefficient_enabled)
  const prefsTable = supabase.from('user_preferences') as unknown as UserPreferencesBuilder
  const { data: prefs } = await prefsTable
    .select('scheduling_buffer_minutes, personal_coefficient_enabled')
    .eq('user_id', params.userId)
    .maybeSingle()

  const bufferMinutes =
    typeof prefs?.scheduling_buffer_minutes === 'number'
      ? prefs.scheduling_buffer_minutes
      : DEFAULT_BUFFER_MINUTES

  const personalCoefEnabledPref = prefs?.personal_coefficient_enabled === true

  // 2. Lecture user_duration_coefficients (si enabled)
  let personalFactor = 1
  let personalAdjustment: { factor: number; reason: string } | undefined
  if (personalCoefEnabledPref) {
    const coefTable = supabase.from(
      'user_duration_coefficients',
    ) as unknown as UserDurationCoefBuilder
    const { data: coefRow } = await coefTable
      .select('global_coefficient, enabled, sample_size_total')
      .eq('user_id', params.userId)
      .maybeSingle()

    if (coefRow?.enabled === true && typeof coefRow.global_coefficient === 'number') {
      personalFactor = Number(coefRow.global_coefficient)
      personalAdjustment = {
        factor: personalFactor,
        reason: `Coefficient personnel (${coefRow.sample_size_total ?? 0} missions analysées)`,
      }
    }
  }

  // 3. Tri diagnostics par durée_base décroissante
  const sortedDiags = [...params.diagnostics].sort((a, b) => DURATION_BASE[b] - DURATION_BASE[a])

  // 4. Cascade de coefficients par diagnostic
  const breakdown: DiagnosticBreakdown[] = sortedDiags.map((diag, index) => {
    const base = DURATION_BASE[diag]
    const afterSurface = base * surfaceCoef
    const afterProperty = afterSurface * propertyCoef
    const isCoproAffected = COPRO_AFFECTED.includes(diag)
    const afterCopro = isCoproAffected ? afterProperty * coproCoef : afterProperty
    const mutuCoef = getMutualizationCoef(index)
    const afterMutu = afterCopro * mutuCoef
    return {
      diagnostic: diag,
      baseMinutes: base,
      afterSurfaceCoef: round1(afterSurface),
      afterPropertyCoef: round1(afterProperty),
      afterCoproCoef: round1(afterCopro),
      afterMutualization: round1(afterMutu),
      finalMinutes: round1(afterMutu),
    }
  })

  // 5. Somme + bonus dépendances + coef personnel
  const sumDiagnostics = breakdown.reduce((acc, b) => acc + b.finalMinutes, 0)

  let dependencyBonus = 0
  if (params.hasGarage) dependencyBonus += DEPENDENCY_BONUS.garage
  if (params.hasSousSol) dependencyBonus += DEPENDENCY_BONUS.sous_sol
  if (params.hasComblesAmenagees) dependencyBonus += DEPENDENCY_BONUS.combles_amenagees

  const beforePersonal = sumDiagnostics + dependencyBonus + bufferMinutes
  const totalMinutes = beforePersonal * personalFactor

  // 6. Arrondi prudent
  const totalRounded = roundToHalfHour(totalMinutes)

  // 7. Confidence
  const historyTable = supabase.from(
    'mission_duration_history',
  ) as unknown as DurationHistoryBuilder
  const { count } = await historyTable
    .select('id', { count: 'exact', head: true })
    .eq('user_id', params.userId)
    .not('actual_duration_min', 'is', null)
  const historyCount = count ?? 0

  return {
    totalMinutes: Math.round(totalMinutes),
    totalRounded,
    breakdown,
    bufferMinutes,
    personalAdjustment,
    confidence: computeConfidence(historyCount),
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
