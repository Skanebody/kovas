/**
 * KOVAS — Helper data RÉELLES par ville (FIX-NN).
 *
 * Remplace les chiffres déterministes de `local-data.ts` par une lecture de
 * la table `city_real_stats` peuplée quotidiennement par la cron
 * `kovas-refresh-city-stats-daily` (ADEME + INSEE + DVF + Claude Haiku).
 *
 * Stratégie de fallback :
 *  1. Lecture DB : si row trouvée avec `refresh_status='success'` et
 *     `last_refreshed_at` < 60 jours → renvoie `source: 'real'`.
 *  2. Sinon → fallback déterministe legacy (l'ancien `getCityLocalData`)
 *     avec `source: 'estimation'`. La page affiche un bandeau transparence
 *     "Données détaillées en cours de mise à jour".
 *
 * Le helper legacy `getCityLocalData()` reste accessible pour la
 * rétro-compatibilité (sitemaps, helpers internes), mais les pages
 * publiques utilisent désormais `getCityStats()`.
 */

import type { City } from '@/lib/cities/registry'
import { createClient } from '@/lib/supabase/server'
import { type CityLocalData, type EnergyClass, getCityLocalData } from './local-data'

export type CityStatsSource = 'real' | 'estimation'

export interface CityStatsSourceUsed {
  readonly name: string
  readonly url: string
  readonly fetched_at: string
  readonly rows_count: number
}

export interface CityStatsContextParagraph {
  readonly heading: string
  readonly body: string
}

export interface CityStats extends CityLocalData {
  /** Provenance des chiffres : `real` = DB ADEME+INSEE / `estimation` = heuristique. */
  readonly source: CityStatsSource
  /** Total réel de DPE comptabilisés ADEME (uniquement si source='real'). */
  readonly totalDpeCount: number | null
  /** Distribution énergétique RÉELLE A-G (% du parc local). */
  readonly dpeDistribution: Readonly<Record<EnergyClass, number>> | null
  /** Date ISO de la dernière mise à jour de la donnée réelle. */
  readonly lastRefreshedAt: string | null
  /** Sources utilisées (ADEME, Claude, etc.) pour bandeau transparence. */
  readonly sourcesUsed: ReadonlyArray<CityStatsSourceUsed>
  /** Paragraphes contextuels IA-générés (sobres, sourcés). */
  readonly contextParagraphs: ReadonlyArray<CityStatsContextParagraph>
  /** Modèle IA utilisé pour les paragraphes contextuels. */
  readonly aiModel: string | null
}

interface CityRealStatsRow {
  city_slug: string
  city_name: string
  dept_code: string
  insee_code: string | null
  dpe_distribution: Record<string, number> | null
  total_dpe_count: number
  median_energy_class: string | null
  fg_rate_pct: number | null
  median_dpe_price_eur: number | null
  min_dpe_price_eur: number | null
  max_dpe_price_eur: number | null
  pre_1948_rate_pct: number | null
  pre_1997_rate_pct: number | null
  avg_construction_year: number | null
  median_delivery_days: number | null
  estimated_dpe_per_year: number | null
  context_paragraphs: CityStatsContextParagraph[] | null
  ai_model: string | null
  sources_used: CityStatsSourceUsed[] | null
  refresh_status: string
  last_refreshed_at: string | null
}

const FRESHNESS_MS = 60 * 24 * 3600 * 1000 // 60 jours

function isFresh(lastRefreshedAt: string | null | undefined): boolean {
  if (!lastRefreshedAt) return false
  const date = new Date(lastRefreshedAt).getTime()
  if (Number.isNaN(date)) return false
  return Date.now() - date < FRESHNESS_MS
}

function isValidEnergyClass(value: string | null | undefined): value is EnergyClass {
  return (
    value === 'A' ||
    value === 'B' ||
    value === 'C' ||
    value === 'D' ||
    value === 'E' ||
    value === 'F' ||
    value === 'G'
  )
}

function normalizeDistribution(
  raw: Record<string, number> | null,
): Readonly<Record<EnergyClass, number>> | null {
  if (!raw || typeof raw !== 'object') return null
  return {
    A: Number(raw.A ?? 0),
    B: Number(raw.B ?? 0),
    C: Number(raw.C ?? 0),
    D: Number(raw.D ?? 0),
    E: Number(raw.E ?? 0),
    F: Number(raw.F ?? 0),
    G: Number(raw.G ?? 0),
  }
}

/**
 * Charge les statistiques d'une ville en privilégiant les data RÉELLES en DB.
 * Fallback déterministe si refresh récent indisponible.
 */
export async function getCityStats(city: City): Promise<CityStats> {
  // Fallback de base (toujours utilisable)
  const fallback = getCityLocalData(city)

  try {
    const supabase = await createClient()
    // biome-ignore lint/suspicious/noExplicitAny: schema city_real_stats pas encore dans types Database
    const { data, error } = await (supabase as any)
      .from('city_real_stats')
      .select(
        'city_slug, city_name, dept_code, insee_code, dpe_distribution, total_dpe_count, ' +
          'median_energy_class, fg_rate_pct, median_dpe_price_eur, min_dpe_price_eur, ' +
          'max_dpe_price_eur, pre_1948_rate_pct, pre_1997_rate_pct, avg_construction_year, ' +
          'median_delivery_days, estimated_dpe_per_year, context_paragraphs, ai_model, ' +
          'sources_used, refresh_status, last_refreshed_at',
      )
      .eq('city_slug', city.slug)
      .maybeSingle()

    if (error || !data) {
      return toEstimation(fallback)
    }

    const row = data as CityRealStatsRow
    const isUsable =
      row.refresh_status === 'success' &&
      isFresh(row.last_refreshed_at) &&
      row.total_dpe_count >= 50 &&
      isValidEnergyClass(row.median_energy_class)

    if (!isUsable) {
      return toEstimation(fallback)
    }

    const medianClass = isValidEnergyClass(row.median_energy_class)
      ? row.median_energy_class
      : fallback.medianEnergyClass

    return {
      city,
      source: 'real',
      medianDpePrice: row.median_dpe_price_eur ?? fallback.medianDpePrice,
      minDpePrice: row.min_dpe_price_eur ?? fallback.minDpePrice,
      maxDpePrice: row.max_dpe_price_eur ?? fallback.maxDpePrice,
      medianEnergyClass: medianClass,
      fgRatePct: row.fg_rate_pct ?? fallback.fgRatePct,
      estimatedDpePerYear: row.estimated_dpe_per_year ?? fallback.estimatedDpePerYear,
      preWar2RatePct: row.pre_1948_rate_pct ?? fallback.preWar2RatePct,
      pre1997RatePct: row.pre_1997_rate_pct ?? fallback.pre1997RatePct,
      avgConstructionYear: row.avg_construction_year ?? fallback.avgConstructionYear,
      medianDeliveryDays: row.median_delivery_days ?? fallback.medianDeliveryDays,
      lastUpdatedIso: (row.last_refreshed_at ?? new Date().toISOString()).slice(0, 10),
      totalDpeCount: row.total_dpe_count,
      dpeDistribution: normalizeDistribution(row.dpe_distribution),
      lastRefreshedAt: row.last_refreshed_at,
      sourcesUsed: Array.isArray(row.sources_used) ? row.sources_used : [],
      contextParagraphs: Array.isArray(row.context_paragraphs) ? row.context_paragraphs : [],
      aiModel: row.ai_model,
    }
  } catch {
    return toEstimation(fallback)
  }
}

function toEstimation(fallback: CityLocalData): CityStats {
  return {
    ...fallback,
    source: 'estimation',
    totalDpeCount: null,
    dpeDistribution: null,
    lastRefreshedAt: null,
    sourcesUsed: [],
    contextParagraphs: [],
    aiModel: null,
  }
}
