/**
 * Lecture des stats publiques live depuis Supabase pour /observatoire.
 *
 * Source : table `observatoire_live_stats` rafraîchie mensuellement par
 * l'Edge Function `observatoire-stats-refresh` (cron pg_cron).
 *
 * Fallback gracieux : si la table est vide / migration pas pushée prod,
 * retourne `null` pour permettre à la page de basculer sur le référentiel
 * mocké (`regions-data.ts`) sans crasher.
 */

import { createClient } from '@/lib/supabase/server'

export interface LiveDpeDistribution {
  readonly a: number
  readonly b: number
  readonly c: number
  readonly d: number
  readonly e: number
  readonly f: number
  readonly g: number
}

export interface LiveTopCity {
  readonly rank: number
  readonly name: string
  readonly department: string
  readonly slug: string
  readonly score: number
  readonly renov_ratio: number
  readonly fg_yoy: number
  readonly prime_renov: number
}

/**
 * Prix médians par type de diagnostic (€ TTC) — alimentés par l'Edge Function
 * `observatoire-stats-refresh`. Tous les champs sont optionnels pour rester
 * tolérant aux rows anciennes sans backfill.
 */
export interface LivePricesByType {
  readonly dpe?: number
  readonly amiante?: number
  readonly plomb?: number
  readonly gaz?: number
  readonly electricite?: number
  readonly termites?: number
  readonly carrez?: number
  readonly erp?: number
}

export interface LiveStatRow {
  readonly id: string
  readonly periodYear: number
  readonly periodMonth: number
  readonly regionCode: string | null
  readonly medianPriceEur: number | null
  readonly pricesByType: LivePricesByType | null
  readonly dpeDistribution: LiveDpeDistribution | null
  readonly topTransitionCities: readonly LiveTopCity[]
  readonly transactionsCount: number
  readonly diagnosticsCount: number
  readonly fgRatePct: number | null
  readonly medianDeliveryDays: number | null
  readonly generatedAt: string
}

export interface LiveStatsSnapshot {
  readonly latestPeriodYear: number
  readonly latestPeriodMonth: number
  readonly national: LiveStatRow | null
  readonly regions: ReadonlyMap<string, LiveStatRow>
  /** generated_at le plus récent (toutes lignes confondues) */
  readonly latestGeneratedAt: string
  /** Snapshot du mois M-1 pour calcul des variations YoM */
  readonly previousNational: LiveStatRow | null
}

interface RawPricesByType {
  dpe?: number | string | null
  amiante?: number | string | null
  plomb?: number | string | null
  gaz?: number | string | null
  electricite?: number | string | null
  termites?: number | string | null
  carrez?: number | string | null
  erp?: number | string | null
}

interface RawRow {
  id: string
  period_year: number
  period_month: number
  region_code: string | null
  median_price_eur: number | string | null
  prices_by_type: RawPricesByType | null
  dpe_distribution: LiveDpeDistribution | null
  top_transition_cities: LiveTopCity[] | null
  transactions_count: number
  diagnostics_count: number
  fg_rate_pct: number | string | null
  median_delivery_days: number | null
  generated_at: string
}

function parseNumeric(v: number | string | null | undefined): number | undefined {
  if (v === null || v === undefined) return undefined
  const n = typeof v === 'string' ? Number.parseFloat(v) : v
  return Number.isFinite(n) ? n : undefined
}

function mapPricesByType(raw: RawPricesByType | null): LivePricesByType | null {
  if (!raw || typeof raw !== 'object') return null
  const out: LivePricesByType = {
    dpe: parseNumeric(raw.dpe),
    amiante: parseNumeric(raw.amiante),
    plomb: parseNumeric(raw.plomb),
    gaz: parseNumeric(raw.gaz),
    electricite: parseNumeric(raw.electricite),
    termites: parseNumeric(raw.termites),
    carrez: parseNumeric(raw.carrez),
    erp: parseNumeric(raw.erp),
  }
  // Si tous les champs sont undefined → on retourne null pour signaler le fallback
  const hasAny = Object.values(out).some((v) => typeof v === 'number')
  return hasAny ? out : null
}

function mapRow(r: RawRow): LiveStatRow {
  return {
    id: r.id,
    periodYear: r.period_year,
    periodMonth: r.period_month,
    regionCode: r.region_code,
    medianPriceEur:
      r.median_price_eur === null
        ? null
        : typeof r.median_price_eur === 'string'
          ? Number.parseFloat(r.median_price_eur)
          : r.median_price_eur,
    pricesByType: mapPricesByType(r.prices_by_type),
    dpeDistribution: r.dpe_distribution,
    topTransitionCities: r.top_transition_cities ?? [],
    transactionsCount: r.transactions_count,
    diagnosticsCount: r.diagnostics_count,
    fgRatePct:
      r.fg_rate_pct === null
        ? null
        : typeof r.fg_rate_pct === 'string'
          ? Number.parseFloat(r.fg_rate_pct)
          : r.fg_rate_pct,
    medianDeliveryDays: r.median_delivery_days,
    generatedAt: r.generated_at,
  }
}

function previousMonth(year: number, month: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1, 1))
  d.setUTCMonth(d.getUTCMonth() - 1)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
}

/**
 * Charge le snapshot live le plus récent depuis la DB.
 * Retourne null si la table n'existe pas, est vide, ou en cas d'erreur.
 */
export async function loadLiveStatsSnapshot(): Promise<LiveStatsSnapshot | null> {
  try {
    const supabase = await createClient()

    // 1. Trouve la dernière période disponible
    // biome-ignore lint/suspicious/noExplicitAny: table pas dans Database.types
    const { data: latestPeriod, error: latestErr } = await (supabase as any)
      .from('observatoire_live_stats')
      .select('period_year, period_month')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestErr || !latestPeriod) return null

    const latestYear = latestPeriod.period_year as number
    const latestMonth = latestPeriod.period_month as number

    // 2. Charge toutes les lignes du mois courant
    // biome-ignore lint/suspicious/noExplicitAny: table pas dans Database.types
    const { data: rows, error: rowsErr } = await (supabase as any)
      .from('observatoire_live_stats')
      .select(
        'id, period_year, period_month, region_code, median_price_eur, prices_by_type, dpe_distribution, top_transition_cities, transactions_count, diagnostics_count, fg_rate_pct, median_delivery_days, generated_at',
      )
      .eq('period_year', latestYear)
      .eq('period_month', latestMonth)

    if (rowsErr) return null
    const typed = ((rows ?? []) as RawRow[]).map(mapRow)

    const national = typed.find((r) => r.regionCode === null) ?? null
    const regions = new Map<string, LiveStatRow>()
    for (const r of typed) {
      if (r.regionCode) regions.set(r.regionCode, r)
    }

    // 3. Mois M-1 pour comparatif (national uniquement)
    const prev = previousMonth(latestYear, latestMonth)
    // biome-ignore lint/suspicious/noExplicitAny: table pas dans Database.types
    const { data: prevRow } = await (supabase as any)
      .from('observatoire_live_stats')
      .select(
        'id, period_year, period_month, region_code, median_price_eur, prices_by_type, dpe_distribution, top_transition_cities, transactions_count, diagnostics_count, fg_rate_pct, median_delivery_days, generated_at',
      )
      .eq('period_year', prev.year)
      .eq('period_month', prev.month)
      .is('region_code', null)
      .maybeSingle()

    const previousNational = prevRow ? mapRow(prevRow as RawRow) : null

    const latestGeneratedAt =
      typed
        .map((r) => r.generatedAt)
        .sort()
        .reverse()[0] ?? new Date().toISOString()

    return {
      latestPeriodYear: latestYear,
      latestPeriodMonth: latestMonth,
      national,
      regions,
      latestGeneratedAt,
      previousNational,
    }
  } catch (err) {
    console.error('[observatoire/live-stats] loadLiveStatsSnapshot failed:', err)
    return null
  }
}

const MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const

export function formatPeriodLabel(year: number, month: number): string {
  return `${MONTHS_FR[month - 1] ?? '—'} ${year}`
}

export function formatGeneratedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

/**
 * Calcule la variation % entre deux périodes pour un KPI numérique.
 * Retourne null si l'une des valeurs est manquante.
 */
export function variationPct(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    previous === 0
  ) {
    return null
  }
  return Math.round(((current - previous) / previous) * 1000) / 10
}
