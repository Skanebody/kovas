/**
 * KOVAS — Module Cockpit ADEME — Calcul des snapshots KPI quotidiens.
 *
 * Prend en entrée :
 *   - `orgId` : organisation (multi-tenant)
 *   - `dpeData` : ensemble des DPE rapatriés depuis l'API ADEME
 *     (sortie de `fetchDpeByCertificat` ou cache local)
 *   - `coherenceRules` : règles actives (lues une fois par run)
 *
 * Calcule en sortie :
 *   - Distribution étiquettes DPE A→G + GES A→G
 *   - Volumes (12m / 30j / 7j / today)
 *   - Ratios F/G + frontières D/E, F/G (proxy potentielle "tassement")
 *   - Distance moyenne / max entre DPE successifs (proxy "course-poursuite")
 *   - Incohérences détectées (re-évalue les règles de cohérence sur chaque DPE)
 *   - `risk_score_0_100` global + niveau (green/yellow/red)
 *
 * Format compatible insertion directe dans `ademe_kpi_snapshots`.
 *
 * Authority : CLAUDE.md §13 (résilience par diversification) + spec
 * Cockpit ADEME (anti-surveillance volumétrique / géographique / qualité).
 */

import type { AdemeDpe } from './ademe-api'
import { distanceBetweenDpe } from './ademe-api'
import { evaluateRule } from './rule-evaluator'
import type { CoherenceRule } from './rule-evaluator'

// ============================================================
// Types publics
// ============================================================

export interface SnapshotInput {
  orgId: string
  userId: string | null
  certificatNumber: string | null
  dpeData: AdemeDpe[]
  coherenceRules: CoherenceRule[]
  /** Date "today" UTC pour cut-off. Defaults to new Date(). */
  now?: Date
}

export interface KpiSnapshot {
  // Identité
  organization_id: string
  user_id: string | null
  certificat_number: string | null
  snapshot_date: string // YYYY-MM-DD
  period: 'daily'

  // Distribution étiquettes DPE A-G
  count_a: number
  count_b: number
  count_c: number
  count_d: number
  count_e: number
  count_f: number
  count_g: number

  // Distribution étiquettes GES A-G
  ges_count_a: number
  ges_count_b: number
  ges_count_c: number
  ges_count_d: number
  ges_count_e: number
  ges_count_f: number
  ges_count_g: number

  // Volumes
  total_dpe: number
  total_published: number
  total_anomalies: number
  total_corrections: number
  error_rate: number // 0-1 float

  // Mesures dérivées
  avg_surface_m2: number | null
  avg_energy_value: number | null
  avg_ges_value: number | null

  // Métadonnées (encapsule risque + volumétrie pour réutilisation aval)
  source: 'ademe_api' | 'internal' | 'hybrid'
  metadata: SnapshotMetadata
}

export interface SnapshotMetadata {
  /** Volumes glissants */
  dpe_count_12m: number
  dpe_count_30d: number
  dpe_count_7d: number
  dpe_count_today: number

  /** Ratios cibles surveillance ADEME */
  ratio_fg: number // % de F+G sur total
  ratio_de: number // % de D+E (frontière dans étiquette intermédiaire)
  ratio_a_to_c: number // % de A+B+C

  /** Géo */
  avg_distance_km: number | null
  max_distance_km: number | null

  /** Score global */
  risk_score_0_100: number
  risk_level: 'green' | 'yellow' | 'red'

  /** Incohérences détectées */
  coherence_violations: Array<{
    numero_dpe: string
    rule_code: string
    severity: CoherenceRule['severity']
  }>

  /** Audit */
  computed_at: string
  rules_evaluated: number
}

// ============================================================
// Constantes seuils
// ============================================================

// Seuils volumétriques annuels (cf. README ADEME / observation publique).
// TODO : valider ces seuils auprès du conseiller diag (Sprint 14j J3).
// Sources d'inspiration : observation Liciel + presse spécialisée. Pas de
// référence officielle publiée par l'ADEME — à ajuster post-bêta.
const VOLUME_CRITICAL_YEARLY = 950
const VOLUME_WARNING_YEARLY = 800
const VOLUME_WARNING_DAILY = 6

// Ratios statistiques (médiane nationale 2023, source ADEME open data).
// Référence : ~27% des DPE résidentiels sont F ou G (logements existants).
const NATIONAL_FG_RATIO = 0.27
const FG_RATIO_TOLERANCE = 0.15 // tolère ±15 pts vs médiane

// Pondérations score global (volume / coherence / distance / statistical).
const WEIGHTS = {
  volume: 0.3,
  coherence: 0.3,
  statistical: 0.2,
  geographic: 0.2,
} as const

// ============================================================
// Implémentation
// ============================================================

export function calculateKpiSnapshot(input: SnapshotInput): KpiSnapshot {
  const now = input.now ?? new Date()
  const today = isoDate(now)
  const twelveMonthsAgo = daysAgo(now, 365)
  const thirtyDaysAgo = daysAgo(now, 30)
  const sevenDaysAgo = daysAgo(now, 7)

  // ---- 1. Distribution étiquettes
  const distDpe = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 }
  const distGes = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 }
  let totalDpe = 0
  let totalPublished = 0
  let surfaceSum = 0
  let surfaceCount = 0
  let energySum = 0
  let energyCount = 0
  let gesSum = 0
  let gesCount = 0

  // ---- 2. Volumes par fenêtre
  let count12m = 0
  let count30d = 0
  let count7d = 0
  let countToday = 0

  // ---- 3. Géo (distances entre DPE consécutifs par date)
  const sortedByDate = [...input.dpeData]
    .filter((d) => d.Date_etablissement_DPE)
    .sort((a, b) =>
      (a.Date_etablissement_DPE ?? '').localeCompare(b.Date_etablissement_DPE ?? ''),
    )
  const distances: number[] = []
  for (let i = 1; i < sortedByDate.length; i += 1) {
    const prev = sortedByDate[i - 1]
    const curr = sortedByDate[i]
    if (!prev || !curr) continue
    const d = distanceBetweenDpe(prev, curr)
    if (d !== null) distances.push(d)
  }
  const avgDistance = distances.length > 0 ? mean(distances) : null
  const maxDistance = distances.length > 0 ? Math.max(...distances) : null

  // ---- 4. Cohérence (re-évalue chaque règle active sur chaque DPE)
  const coherenceViolations: SnapshotMetadata['coherence_violations'] = []

  for (const dpe of input.dpeData) {
    totalDpe += 1
    if (dpe.Numero_DPE) totalPublished += 1

    const label = dpe.Etiquette_DPE
    if (label && label in distDpe) {
      distDpe[label] += 1
    }
    const labelGes = dpe.Etiquette_GES
    if (labelGes && labelGes in distGes) {
      distGes[labelGes] += 1
    }

    if (typeof dpe.Surface_habitable_logement === 'number') {
      surfaceSum += dpe.Surface_habitable_logement
      surfaceCount += 1
    }
    if (typeof dpe.Conso_5_usages_par_m2_ep === 'number') {
      energySum += dpe.Conso_5_usages_par_m2_ep
      energyCount += 1
    }
    if (typeof dpe.Emission_GES_5_usages_par_m2 === 'number') {
      gesSum += dpe.Emission_GES_5_usages_par_m2
      gesCount += 1
    }

    // Volumes par fenêtre
    const dateStr = dpe.Date_etablissement_DPE
    if (dateStr) {
      if (dateStr >= twelveMonthsAgo) count12m += 1
      if (dateStr >= thirtyDaysAgo) count30d += 1
      if (dateStr >= sevenDaysAgo) count7d += 1
      if (dateStr === today) countToday += 1
    }

    // Évalue règles
    for (const rule of input.coherenceRules) {
      if (!rule.enabled) continue
      const violated = evaluateRule(rule.rule_logic, dpe)
      if (violated && dpe.Numero_DPE) {
        coherenceViolations.push({
          numero_dpe: dpe.Numero_DPE,
          rule_code: rule.rule_code,
          severity: rule.severity,
        })
      }
    }
  }

  // ---- 5. Ratios
  const totalLabeled =
    distDpe.A + distDpe.B + distDpe.C + distDpe.D + distDpe.E + distDpe.F + distDpe.G
  const ratioFg = totalLabeled > 0 ? (distDpe.F + distDpe.G) / totalLabeled : 0
  const ratioDe = totalLabeled > 0 ? (distDpe.D + distDpe.E) / totalLabeled : 0
  const ratioAtoC = totalLabeled > 0 ? (distDpe.A + distDpe.B + distDpe.C) / totalLabeled : 0

  // ---- 6. Sous-scores 0-100
  const volumeScore = scoreVolume({ yearly: count12m, daily: countToday })
  const coherenceScore = scoreCoherence(coherenceViolations, totalDpe)
  const statisticalScore = scoreStatistical(ratioFg)
  const geographicScore = scoreGeographic(maxDistance)

  const riskScore = Math.round(
    volumeScore * WEIGHTS.volume +
      coherenceScore * WEIGHTS.coherence +
      statisticalScore * WEIGHTS.statistical +
      geographicScore * WEIGHTS.geographic,
  )

  const riskLevel: 'green' | 'yellow' | 'red' =
    riskScore >= 70 ? 'red' : riskScore >= 40 ? 'yellow' : 'green'

  // ---- 7. Compte anomalies (sévérité error/blocking)
  const totalAnomalies = coherenceViolations.filter(
    (v) => v.severity === 'error' || v.severity === 'blocking',
  ).length

  const errorRate = totalDpe > 0 ? totalAnomalies / totalDpe : 0

  return {
    organization_id: input.orgId,
    user_id: input.userId,
    certificat_number: input.certificatNumber,
    snapshot_date: today,
    period: 'daily',

    count_a: distDpe.A,
    count_b: distDpe.B,
    count_c: distDpe.C,
    count_d: distDpe.D,
    count_e: distDpe.E,
    count_f: distDpe.F,
    count_g: distDpe.G,

    ges_count_a: distGes.A,
    ges_count_b: distGes.B,
    ges_count_c: distGes.C,
    ges_count_d: distGes.D,
    ges_count_e: distGes.E,
    ges_count_f: distGes.F,
    ges_count_g: distGes.G,

    total_dpe: totalDpe,
    total_published: totalPublished,
    total_anomalies: totalAnomalies,
    total_corrections: 0, // V1 : pas de tracking corrections (V2)
    error_rate: Number(errorRate.toFixed(4)),

    avg_surface_m2: surfaceCount > 0 ? Number((surfaceSum / surfaceCount).toFixed(2)) : null,
    avg_energy_value: energyCount > 0 ? Number((energySum / energyCount).toFixed(2)) : null,
    avg_ges_value: gesCount > 0 ? Number((gesSum / gesCount).toFixed(2)) : null,

    source: 'ademe_api',
    metadata: {
      dpe_count_12m: count12m,
      dpe_count_30d: count30d,
      dpe_count_7d: count7d,
      dpe_count_today: countToday,
      ratio_fg: Number(ratioFg.toFixed(4)),
      ratio_de: Number(ratioDe.toFixed(4)),
      ratio_a_to_c: Number(ratioAtoC.toFixed(4)),
      avg_distance_km: avgDistance !== null ? Number(avgDistance.toFixed(2)) : null,
      max_distance_km: maxDistance !== null ? Number(maxDistance.toFixed(2)) : null,
      risk_score_0_100: riskScore,
      risk_level: riskLevel,
      coherence_violations: coherenceViolations.slice(0, 100), // cap pour éviter JSONB obèse
      computed_at: now.toISOString(),
      rules_evaluated: input.coherenceRules.filter((r) => r.enabled).length,
    },
  }
}

// ============================================================
// Sous-scoring (0 = sain, 100 = critique)
// ============================================================

function scoreVolume(opts: { yearly: number; daily: number }): number {
  let score = 0
  if (opts.yearly >= VOLUME_CRITICAL_YEARLY) score = 100
  else if (opts.yearly >= VOLUME_WARNING_YEARLY) {
    // Interpolation linéaire 800 → 60, 950 → 100
    const ratio = (opts.yearly - VOLUME_WARNING_YEARLY) / (VOLUME_CRITICAL_YEARLY - VOLUME_WARNING_YEARLY)
    score = 60 + 40 * ratio
  } else if (opts.yearly > 0) {
    score = (opts.yearly / VOLUME_WARNING_YEARLY) * 50
  }

  if (opts.daily >= VOLUME_WARNING_DAILY) {
    score = Math.max(score, 40)
  }
  return Math.min(100, Math.round(score))
}

function scoreCoherence(
  violations: SnapshotMetadata['coherence_violations'],
  totalDpe: number,
): number {
  if (totalDpe === 0) return 0
  const errors = violations.filter((v) => v.severity === 'error' || v.severity === 'blocking').length
  const warnings = violations.filter((v) => v.severity === 'warning').length
  // 1 erreur sur 100 DPE = 10 points. 1 warning = 3 points.
  const score = (errors / totalDpe) * 1000 + (warnings / totalDpe) * 300
  return Math.min(100, Math.round(score))
}

function scoreStatistical(ratioFg: number): number {
  // Plus on s'éloigne (à la baisse) de NATIONAL_FG_RATIO, plus c'est suspect.
  // Hypothèse anti-surveillance ADEME : tassement vers D-E (F-G sous-déclarés).
  const delta = NATIONAL_FG_RATIO - ratioFg // si > 0 → tassement
  if (delta <= 0) return 0
  if (delta >= FG_RATIO_TOLERANCE) return 100
  return Math.round((delta / FG_RATIO_TOLERANCE) * 100)
}

function scoreGeographic(maxDistanceKm: number | null): number {
  if (maxDistanceKm === null) return 0
  if (maxDistanceKm >= 40) return 100
  if (maxDistanceKm >= 25) {
    return 50 + Math.round(((maxDistanceKm - 25) / 15) * 50)
  }
  return 0
}

// ============================================================
// Helpers date / math
// ============================================================

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(from: Date, days: number): string {
  const d = new Date(from.getTime())
  d.setUTCDate(d.getUTCDate() - days)
  return isoDate(d)
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  let sum = 0
  for (const v of values) sum += v
  return sum / values.length
}
