/**
 * KOVAS — Module 9 — Calcul des benchmarks anonymisés inter-cabinets.
 *
 * Aggregation de `business_analytics_snapshots` du mois précédent en
 * percentiles (P25 / P50 / P75) par combinaison
 * (region, cabinet_size, metric_name).
 *
 * Règles d'anonymisation (cf. CLAUDE.md §10 + RGPD) :
 *   - k-anonymity ≥ 5 cabinets : sinon on skip la combinaison
 *   - anti-déduction : si > 80% des snapshots proviennent du même
 *     prescripteur (heuristique simple sur top_client_share_pct
 *     moyen), on skip la combinaison aussi (sinon une org dominante
 *     est dé-anonymisable).
 *   - aucune donnée nominative en sortie.
 *
 * Régions FR métro (13) déterminées via postal_code → INSEE → région.
 * Cabinet sizes : solo (1) / small (2-3) / medium (4-10) / large (10+).
 */

// ============================================================
// 13 régions FR métropolitaines (INSEE 2016).
// ============================================================

export const FR_REGIONS_2016: Record<string, string> = {
  '11': 'Île-de-France',
  '24': 'Centre-Val de Loire',
  '27': 'Bourgogne-Franche-Comté',
  '28': 'Normandie',
  '32': 'Hauts-de-France',
  '44': 'Grand Est',
  '52': 'Pays de la Loire',
  '53': 'Bretagne',
  '75': 'Nouvelle-Aquitaine',
  '76': 'Occitanie',
  '84': 'Auvergne-Rhône-Alpes',
  '93': "Provence-Alpes-Côte d'Azur",
  '94': 'Corse',
}

/**
 * Mapping département (2 chiffres) → code région INSEE 2016.
 *
 * Source : INSEE, "Régions et départements 2016".
 * https://www.insee.fr/fr/information/2114819
 */
export const DEPT_TO_REGION: Record<string, string> = {
  '01': '84',
  '03': '84',
  '07': '84',
  '15': '84',
  '26': '84',
  '38': '84',
  '42': '84',
  '43': '84',
  '63': '84',
  '69': '84',
  '73': '84',
  '74': '84',
  '21': '27',
  '25': '27',
  '39': '27',
  '58': '27',
  '70': '27',
  '71': '27',
  '89': '27',
  '90': '27',
  '22': '53',
  '29': '53',
  '35': '53',
  '56': '53',
  '18': '24',
  '28': '24',
  '36': '24',
  '37': '24',
  '41': '24',
  '45': '24',
  '2A': '94',
  '2B': '94',
  '08': '44',
  '10': '44',
  '51': '44',
  '52': '44',
  '54': '44',
  '55': '44',
  '57': '44',
  '67': '44',
  '68': '44',
  '88': '44',
  '02': '32',
  '59': '32',
  '60': '32',
  '62': '32',
  '80': '32',
  '75': '11',
  '77': '11',
  '78': '11',
  '91': '11',
  '92': '11',
  '93': '11',
  '94': '11',
  '95': '11',
  '14': '28',
  '27': '28',
  '50': '28',
  '61': '28',
  '76': '28',
  '16': '75',
  '17': '75',
  '19': '75',
  '23': '75',
  '24': '75',
  '33': '75',
  '40': '75',
  '47': '75',
  '64': '75',
  '79': '75',
  '86': '75',
  '87': '75',
  '09': '76',
  '11': '76',
  '12': '76',
  '30': '76',
  '31': '76',
  '32': '76',
  '34': '76',
  '46': '76',
  '48': '76',
  '65': '76',
  '66': '76',
  '81': '76',
  '82': '76',
  '44': '52',
  '49': '52',
  '53': '52',
  '72': '52',
  '85': '52',
  '04': '93',
  '05': '93',
  '06': '93',
  '13': '93',
  '83': '93',
  '84': '93',
}

export function postalCodeToRegion(postalCode: string | null): string | null {
  if (!postalCode || postalCode.length < 2) return null
  let dept: string
  // Corse : 2A 2B encodés en codes postaux 20xxx (200xx = Corse-du-Sud, 201xx/202xx = Haute-Corse)
  if (postalCode.startsWith('20')) {
    const n = Number.parseInt(postalCode.slice(2, 5), 10)
    dept = n < 200 ? '2A' : '2B'
  } else {
    dept = postalCode.slice(0, 2)
  }
  return DEPT_TO_REGION[dept] ?? null
}

// ============================================================
// Cabinet size classification.
// ============================================================

export type CabinetSize = 'solo' | 'small' | 'medium' | 'large'

export function cabinetSizeFromUserCount(userCount: number): CabinetSize {
  if (userCount <= 1) return 'solo'
  if (userCount <= 3) return 'small'
  if (userCount <= 10) return 'medium'
  return 'large'
}

// ============================================================
// Statistiques (P25, P50, P75) sur un array numérique.
// ============================================================

export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  if (sorted.length === 1) return sorted[0] ?? null
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo] ?? null
  const w = idx - lo
  const v1 = sorted[lo]
  const v2 = sorted[hi]
  if (v1 === undefined || v2 === undefined) return null
  return v1 * (1 - w) + v2 * w
}

export interface PercentileTriple {
  p25: number
  p50: number
  p75: number
}

export function percentileTriple(values: number[]): PercentileTriple | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const p25 = percentile(sorted, 0.25)
  const p50 = percentile(sorted, 0.5)
  const p75 = percentile(sorted, 0.75)
  if (p25 === null || p50 === null || p75 === null) return null
  return { p25, p50, p75 }
}

// ============================================================
// Input / output types.
// ============================================================

/**
 * Snapshot enrichi avec les attributs nécessaires au regroupement bench.
 */
export interface SnapshotForBenchmark {
  organization_id: string
  region_code: string | null
  cabinet_size: CabinetSize
  revenue_ht_cents: number
  missions_completed: number
  conversion_rate: number | null
  repeat_client_rate: number | null
  health_score: number | null
  avg_mission_value_cents: number
  diagnostic_mix: Record<string, number>
  /** Part du top client en % (anti-déduction). */
  top_client_share_pct: number | null
}

export interface BenchmarkRow {
  snapshot_period: string
  period_type: 'month'
  scope: 'national' | 'region'
  scope_code: string | null
  cabinet_segment: CabinetSize | 'all'
  diagnostic_kind: string | null
  cabinets_count: int_t
  missions_count: int_t
  median_missions_per_cabinet: number
  p25_missions_per_cabinet: number
  p75_missions_per_cabinet: number
  median_mission_value_cents: number
  p25_mission_value_cents: number
  p75_mission_value_cents: number
  median_conversion_rate: number | null
  median_repeat_client_rate: number | null
  median_health_score: number | null
  median_revenue_monthly_cents: number
  metadata: Record<string, unknown>
}

type int_t = number

// ============================================================
// Anti-déduction : skip si > 80% snapshots viennent d'un seul prescripteur.
// On utilise top_client_share_pct moyen comme proxy heuristique.
// ============================================================

const ANTI_DEDUCTION_THRESHOLD = 0.8
const MIN_CABINETS = 5

function passesAntiDeduction(snapshots: SnapshotForBenchmark[]): boolean {
  const ratios = snapshots.map((s) => s.top_client_share_pct).filter((v): v is number => v !== null)
  if (ratios.length === 0) return true
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length
  // top_client_share_pct stocké en pourcentage (0-100), on normalise.
  return avg / 100 <= ANTI_DEDUCTION_THRESHOLD
}

// ============================================================
// Agrégat principal.
// ============================================================

export interface BenchmarkComputationInput {
  period: string
  snapshots: SnapshotForBenchmark[]
}

export function computeBenchmarks(input: BenchmarkComputationInput): BenchmarkRow[] {
  const rows: BenchmarkRow[] = []
  const groups = new Map<string, SnapshotForBenchmark[]>()

  // Toutes combinaisons (region, cabinet_size) + agrégats nationaux par cabinet_size
  // + "all" cabinet_size sur national.
  for (const s of input.snapshots) {
    if (s.region_code) {
      pushGroup(groups, `region|${s.region_code}|${s.cabinet_size}`, s)
      pushGroup(groups, `region|${s.region_code}|all`, s)
    }
    pushGroup(groups, `national|all|${s.cabinet_size}`, s)
    pushGroup(groups, `national|all|all`, s)
  }

  for (const [key, snaps] of groups) {
    if (snaps.length < MIN_CABINETS) continue
    if (!passesAntiDeduction(snaps)) continue
    const parts = key.split('|')
    const scope = parts[0] as 'region' | 'national'
    const scopeCode = parts[1] === 'all' ? null : (parts[1] ?? null)
    const segmentRaw = parts[2] ?? 'all'
    const segment = (segmentRaw === 'all' ? 'all' : (segmentRaw as CabinetSize)) as
      | CabinetSize
      | 'all'

    const missionsArr = snaps.map((s) => s.missions_completed)
    const revenueArr = snaps.map((s) => s.revenue_ht_cents)
    const valueArr = snaps.map((s) => s.avg_mission_value_cents)
    const conversionArr = snaps.map((s) => s.conversion_rate).filter((v): v is number => v !== null)
    const repeatArr = snaps.map((s) => s.repeat_client_rate).filter((v): v is number => v !== null)
    const healthArr = snaps.map((s) => s.health_score).filter((v): v is number => v !== null)

    const missionsTriple = percentileTriple(missionsArr)
    const valueTriple = percentileTriple(valueArr)
    if (!missionsTriple || !valueTriple) continue

    const conversionMedian =
      conversionArr.length > 0
        ? (percentile(
            [...conversionArr].sort((a, b) => a - b),
            0.5,
          ) ?? null)
        : null
    const repeatMedian =
      repeatArr.length > 0
        ? (percentile(
            [...repeatArr].sort((a, b) => a - b),
            0.5,
          ) ?? null)
        : null
    const healthMedian =
      healthArr.length > 0
        ? (percentile(
            [...healthArr].sort((a, b) => a - b),
            0.5,
          ) ?? null)
        : null
    const revenueMedian =
      percentile(
        [...revenueArr].sort((a, b) => a - b),
        0.5,
      ) ?? 0

    rows.push({
      snapshot_period: input.period,
      period_type: 'month',
      scope: scope === 'region' ? 'region' : 'national',
      scope_code: scopeCode,
      cabinet_segment: segment,
      diagnostic_kind: null,
      cabinets_count: snaps.length,
      missions_count: snaps.reduce((acc, s) => acc + s.missions_completed, 0),
      median_missions_per_cabinet: Number(missionsTriple.p50.toFixed(2)),
      p25_missions_per_cabinet: Number(missionsTriple.p25.toFixed(2)),
      p75_missions_per_cabinet: Number(missionsTriple.p75.toFixed(2)),
      median_mission_value_cents: Math.round(valueTriple.p50),
      p25_mission_value_cents: Math.round(valueTriple.p25),
      p75_mission_value_cents: Math.round(valueTriple.p75),
      median_conversion_rate:
        conversionMedian !== null ? Number(conversionMedian.toFixed(4)) : null,
      median_repeat_client_rate: repeatMedian !== null ? Number(repeatMedian.toFixed(4)) : null,
      median_health_score: healthMedian !== null ? Number(healthMedian.toFixed(2)) : null,
      median_revenue_monthly_cents: Math.round(revenueMedian),
      metadata: {
        anti_deduction_pass: true,
        k_anonymity: snaps.length,
        computed_at: new Date().toISOString(),
      },
    })
  }
  return rows
}

function pushGroup(
  groups: Map<string, SnapshotForBenchmark[]>,
  key: string,
  s: SnapshotForBenchmark,
): void {
  const arr = groups.get(key)
  if (arr) arr.push(s)
  else groups.set(key, [s])
}
