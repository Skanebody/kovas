/**
 * Agrégateur de statistiques publiques pour /observatoire.
 *
 * Architecture (2026-05) :
 *   1. Tente de lire le snapshot live depuis `observatoire_live_stats`
 *      (mis à jour mensuellement par l'Edge Function
 *      `observatoire-stats-refresh` + cron pg_cron).
 *   2. Si la table est vide / migration pas pushée prod → fallback gracieux
 *      sur le référentiel mocké (`regions-data.ts`).
 *
 * Toutes les fonctions sont signées en `async` pour permettre la lecture DB.
 */

import { createClient } from '@/lib/supabase/server'
import { type LiveStatsSnapshot, formatPeriodLabel, loadLiveStatsSnapshot } from './live-stats'
import { type DiagnosticType, REGIONS, getFGRateFrance, getMedianPriceFrance } from './regions-data'

export interface ObservatoireStats {
  /** Pourcentage de logements vendus classés F ou G (passoires énergétiques) */
  fGRate: number
  /** Prix médian DPE France métropolitaine (€ TTC) */
  dpeMedianPrice: number
  /** Délai médian commande → livraison rapport (jours) */
  medianDelivery: number
  /** Timestamp ISO de la dernière mise à jour des données */
  lastUpdated: string
  /** Mois courant en français pour pill UI (« Mai 2026 ») */
  lastUpdatedLabel: string
  /** Nombre total de diagnostics réalisés sur 12 mois (France) */
  totalDiagnosticsYear: number
  /** True si on a pu lire des stats DB live, false si fallback référentiel mocké */
  isLive: boolean
  /** Période couverte par la dernière publication (année + mois) */
  periodYear: number
  periodMonth: number
  /** Variations mois précédent (en %) — null si non calculables */
  fGRateChangePct: number | null
  dpeMedianPriceChangePct: number | null
}

// Cache module-level (un seul fetch par requête server)
let liveSnapshotCache: Promise<LiveStatsSnapshot | null> | null = null

async function getLiveSnapshotOnce(): Promise<LiveStatsSnapshot | null> {
  if (!liveSnapshotCache) {
    liveSnapshotCache = loadLiveStatsSnapshot().catch(() => null)
  }
  return liveSnapshotCache
}

/**
 * Permet de forcer un re-fetch (utile pour les tests et après revalidation).
 */
export function resetLiveSnapshotCache(): void {
  liveSnapshotCache = null
}

function variationPct(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

/**
 * Renvoie les 3 KPI hero de l'observatoire.
 * Lit la DB en priorité, sinon retombe sur le référentiel mocké.
 */
export async function getObservatoireStats(): Promise<ObservatoireStats> {
  const snapshot = await getLiveSnapshotOnce()
  const now = new Date()

  if (snapshot?.national) {
    const nat = snapshot.national
    const prev = snapshot.previousNational
    const fg = nat.fgRatePct ?? getFGRateFrance()
    const price = nat.medianPriceEur ?? getMedianPriceFrance('dpe')

    return {
      fGRate: fg,
      dpeMedianPrice: Math.round(price),
      medianDelivery: nat.medianDeliveryDays ?? 12,
      lastUpdated: snapshot.latestGeneratedAt,
      lastUpdatedLabel: formatPeriodLabel(snapshot.latestPeriodYear, snapshot.latestPeriodMonth),
      totalDiagnosticsYear:
        nat.diagnosticsCount * 12 || REGIONS.reduce((s, r) => s + r.diagnosticsCount, 0),
      isLive: true,
      periodYear: snapshot.latestPeriodYear,
      periodMonth: snapshot.latestPeriodMonth,
      fGRateChangePct: variationPct(fg, prev?.fgRatePct ?? null),
      dpeMedianPriceChangePct: variationPct(price, prev?.medianPriceEur ?? null),
    }
  }

  // Fallback gracieux sur le référentiel mocké
  const totalDiagnostics = REGIONS.reduce((sum, r) => sum + r.diagnosticsCount, 0)
  return {
    fGRate: getFGRateFrance(),
    dpeMedianPrice: getMedianPriceFrance('dpe'),
    medianDelivery: 12,
    lastUpdated: now.toISOString(),
    lastUpdatedLabel: formatFrenchMonthYear(now),
    totalDiagnosticsYear: totalDiagnostics,
    isLive: false,
    periodYear: now.getFullYear(),
    periodMonth: now.getMonth() + 1,
    fGRateChangePct: null,
    dpeMedianPriceChangePct: null,
  }
}

export interface RenovationDataPoint {
  readonly month: string
  readonly year: number
  readonly count: number
  readonly label: string
}

export interface RenovationTrendResult {
  readonly data: readonly RenovationDataPoint[]
  /** True si au moins un mois provient de la table live ADEME. */
  readonly isLive: boolean
  /** True si tous les mois disponibles sont issus de l'ingestion ADEME réelle. */
  readonly isFullyLive: boolean
  /** True si le jeu de données contient un mix réel + extrapolé. */
  readonly isMixed: boolean
}

const MONTHS_FR: readonly string[] = [
  'Janv',
  'Févr',
  'Mars',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sept',
  'Oct',
  'Nov',
  'Déc',
]

interface RenovationRowRaw {
  period_year: number
  period_month: number
  renovations_count: number
  source: string
}

function buildSyntheticPoint(_year: number, monthIndex: number, baseGrowthIdx: number): number {
  const baseline = 22_000
  const seasonal =
    monthIndex === 6 || monthIndex === 7
      ? 0.82
      : monthIndex === 2 || monthIndex === 3 || monthIndex === 4
        ? 1.08
        : monthIndex === 8 || monthIndex === 9
          ? 1.05
          : 1.0
  const growth = 1 + baseGrowthIdx * 0.018
  return Math.round(baseline * growth * seasonal)
}

function formatLabel(monthIndex: number, year: number): { month: string; label: string } {
  const month = MONTHS_FR[monthIndex] ?? ''
  return { month, label: `${month} ${String(year).slice(2)}` }
}

/**
 * Charge les 24 derniers mois de la table `observatoire_renovations_monthly`
 * pour la ligne nationale (region_code IS NULL). Retourne null en cas
 * d'erreur DB / table absente pour permettre un fallback gracieux.
 */
async function loadRenovationRows(): Promise<readonly RenovationRowRaw[] | null> {
  try {
    const supabase = await createClient()
    // biome-ignore lint/suspicious/noExplicitAny: table pas dans Database.types
    const { data, error } = await (supabase as any)
      .from('observatoire_renovations_monthly')
      .select('period_year, period_month, renovations_count, source')
      .is('region_code', null)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(24)
    if (error) return null
    if (!Array.isArray(data) || data.length === 0) return null
    return data as RenovationRowRaw[]
  } catch {
    return null
  }
}

/**
 * Renvoie l'évolution mensuelle du nombre de rénovations énergétiques (24 mois
 * glissants).
 *
 * Stratégie de lecture :
 *   1. Lit la table `observatoire_renovations_monthly` (national,
 *      `region_code IS NULL`) sur les 24 derniers mois.
 *   2. Si la table est vide ou en erreur, retombe sur un référentiel
 *      synthétique déterministe (baseline 22k + saisonnalité + croissance).
 *   3. Si la table contient moins de 24 mois, comble les mois manquants
 *      avec le référentiel synthétique (mode "mixed").
 *
 * Le flag `isLive` indique si AU MOINS un mois provient de la DB réelle.
 * Le flag `isFullyLive` indique si TOUS les mois proviennent de la source
 * `ademe` (donnée réelle ADEME, pas synthetic_seed).
 */
export async function getRenovationTrend(): Promise<RenovationTrendResult> {
  const rows = await loadRenovationRows()
  const now = new Date()

  // Map (year-month) → { count, source } pour lookup rapide
  const liveMap = new Map<string, { count: number; source: string }>()
  if (rows) {
    for (const row of rows) {
      const key = `${row.period_year}-${row.period_month}`
      liveMap.set(key, { count: row.renovations_count, source: row.source })
    }
  }

  const result: RenovationDataPoint[] = []
  let ademeRealCount = 0

  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const monthIdx = d.getMonth() // 0-indexed
    const monthHuman = monthIdx + 1
    const key = `${year}-${monthHuman}`

    const live = liveMap.get(key)
    const baseGrowthIdx = 23 - i
    const count = live ? live.count : buildSyntheticPoint(year, monthIdx, baseGrowthIdx)

    if (live && live.source === 'ademe') {
      ademeRealCount += 1
    }

    const { month, label } = formatLabel(monthIdx, year)
    result.push({ month, year, count, label })
  }

  const isLive = ademeRealCount > 0
  const isFullyLive = ademeRealCount === 24
  const isMixed = isLive && !isFullyLive

  return { data: result, isLive, isFullyLive, isMixed }
}

export interface TopCity {
  rank: number
  name: string
  department: string
  slug: string
  /** Score composite 0-100 */
  score: number
  /** % rénovations / 1000 habitants */
  renovRatio: number
  /** Variation YoY part F-G (négatif = amélioration) */
  fgYoy: number
  /** % bénéficiaires MaPrimeRénov */
  primeRenov: number
}

const FALLBACK_TOP_CITIES: readonly TopCity[] = [
  {
    rank: 1,
    name: 'Grenoble',
    department: '38',
    slug: 'grenoble',
    score: 92,
    renovRatio: 18.4,
    fgYoy: -3.8,
    primeRenov: 14.2,
  },
  {
    rank: 2,
    name: 'Nantes',
    department: '44',
    slug: 'nantes',
    score: 88,
    renovRatio: 16.9,
    fgYoy: -3.2,
    primeRenov: 12.8,
  },
  {
    rank: 3,
    name: 'Strasbourg',
    department: '67',
    slug: 'strasbourg',
    score: 86,
    renovRatio: 16.1,
    fgYoy: -3.5,
    primeRenov: 13.4,
  },
  {
    rank: 4,
    name: 'Rennes',
    department: '35',
    slug: 'rennes',
    score: 84,
    renovRatio: 15.7,
    fgYoy: -2.9,
    primeRenov: 11.9,
  },
  {
    rank: 5,
    name: 'Lyon',
    department: '69',
    slug: 'lyon',
    score: 82,
    renovRatio: 15.2,
    fgYoy: -2.6,
    primeRenov: 11.3,
  },
  {
    rank: 6,
    name: 'Bordeaux',
    department: '33',
    slug: 'bordeaux',
    score: 80,
    renovRatio: 14.8,
    fgYoy: -2.4,
    primeRenov: 10.9,
  },
  {
    rank: 7,
    name: 'Lille',
    department: '59',
    slug: 'lille',
    score: 78,
    renovRatio: 14.3,
    fgYoy: -2.8,
    primeRenov: 12.6,
  },
  {
    rank: 8,
    name: 'Angers',
    department: '49',
    slug: 'angers',
    score: 77,
    renovRatio: 14.0,
    fgYoy: -2.5,
    primeRenov: 11.4,
  },
  {
    rank: 9,
    name: 'Montpellier',
    department: '34',
    slug: 'montpellier',
    score: 75,
    renovRatio: 13.7,
    fgYoy: -2.1,
    primeRenov: 10.5,
  },
  {
    rank: 10,
    name: 'Toulouse',
    department: '31',
    slug: 'toulouse',
    score: 74,
    renovRatio: 13.4,
    fgYoy: -2.0,
    primeRenov: 10.2,
  },
]

export interface TopCitiesResult {
  cities: readonly TopCity[]
  isLive: boolean
}

/**
 * Top 10 villes en transition énergétique.
 * Lit la DB en priorité (national row → top_transition_cities jsonb), fallback
 * sur le référentiel statique sinon. Renvoie `isLive` pour permettre à l'UI
 * d'afficher honnêtement l'origine de la donnée.
 */
export async function getTopCities(): Promise<TopCitiesResult> {
  const snapshot = await getLiveSnapshotOnce()
  const dbList = snapshot?.national?.topTransitionCities ?? []

  if (dbList.length > 0) {
    return {
      cities: dbList.map((c) => ({
        rank: c.rank,
        name: c.name,
        department: c.department,
        slug: c.slug,
        score: c.score,
        renovRatio: c.renov_ratio,
        fgYoy: c.fg_yoy,
        primeRenov: c.prime_renov,
      })),
      isLive: true,
    }
  }

  return { cities: FALLBACK_TOP_CITIES, isLive: false }
}

/**
 * Renvoie le tableau prix médian × région × diagnostic (matrice complète).
 *
 * Live : surcharge chaque prix de la matrice par sa valeur DB si disponible
 * (via `prices_by_type` jsonb). Fallback gracieux par cellule sur le
 * référentiel `regions-data.ts` quand la valeur live est absente.
 *
 * Pour la compat ascendante, si `prices_by_type` est NULL mais
 * `median_price_eur` est présent (rows antérieures à la migration
 * 20260626100000), on n'écrase plus que la cellule DPE — comme avant.
 */
export interface PriceMatrixRow {
  region: string
  regionCode: string
  diagnosticsCount: number
  prices: Readonly<Record<DiagnosticType, number>>
  /** True si le prix DPE provient de la DB pour cette région (compat ascendante) */
  dpeIsLive: boolean
  /** Pour chaque diagnostic : true si la valeur provient de la DB live, false si fallback */
  isLiveByDiag: Readonly<Record<DiagnosticType, boolean>>
  /** Nombre de cellules live sur 8 — utile pour stats agrégées en footer UI */
  liveCellCount: number
}

const DIAG_CODES: readonly DiagnosticType[] = [
  'dpe',
  'amiante',
  'plomb',
  'gaz',
  'electricite',
  'termites',
  'carrez',
  'erp',
] as const

export async function getPriceMatrix(): Promise<readonly PriceMatrixRow[]> {
  const snapshot = await getLiveSnapshotOnce()

  return REGIONS.map((r) => {
    const live = snapshot?.regions.get(r.code)
    const livePrice = live?.medianPriceEur ?? null
    const livePrices = live?.pricesByType ?? null
    const liveCount = live?.diagnosticsCount ?? null

    // Construction cellule par cellule : on préfère prices_by_type[diag],
    // sinon on garde la valeur mockée. Pour le DPE seulement, on tolère
    // l'ancien format (`median_price_eur` sans prices_by_type) en
    // compatibilité ascendante.
    const prices: Record<DiagnosticType, number> = { ...r.prices }
    const isLiveByDiag: Record<DiagnosticType, boolean> = {
      dpe: false,
      amiante: false,
      plomb: false,
      gaz: false,
      electricite: false,
      termites: false,
      carrez: false,
      erp: false,
    }

    for (const diag of DIAG_CODES) {
      const liveValue = livePrices?.[diag]
      if (typeof liveValue === 'number' && Number.isFinite(liveValue)) {
        prices[diag] = Math.round(liveValue)
        isLiveByDiag[diag] = true
      }
    }

    // Compat ascendante : DPE peut être live via median_price_eur même sans
    // prices_by_type (rows seedées avant migration 20260626).
    if (!isLiveByDiag.dpe && livePrice !== null) {
      prices.dpe = Math.round(livePrice)
      isLiveByDiag.dpe = true
    }

    const liveCellCount = DIAG_CODES.reduce((s, d) => s + (isLiveByDiag[d] ? 1 : 0), 0)

    return {
      region: r.name,
      regionCode: r.code,
      diagnosticsCount: liveCount && liveCount > 0 ? liveCount * 12 : r.diagnosticsCount,
      prices,
      dpeIsLive: isLiveByDiag.dpe,
      isLiveByDiag,
      liveCellCount,
    }
  })
}

export interface EnergyDistributionRow {
  regionCode: string
  regionName: string
  distribution: Readonly<{
    a: number
    b: number
    c: number
    d: number
    e: number
    f: number
    g: number
  }>
  /** True si cette région a sa distribution lue depuis la DB */
  isLive: boolean
}

/**
 * Renvoie la distribution énergétique A-G par région.
 * Lit la DB en priorité (`dpe_distribution` jsonb), fallback sur le mock pour
 * les régions absentes du snapshot live.
 */
export async function getEnergyDistribution(): Promise<readonly EnergyDistributionRow[]> {
  const snapshot = await getLiveSnapshotOnce()

  return REGIONS.map((r) => {
    const live = snapshot?.regions.get(r.code)
    const liveDist = live?.dpeDistribution ?? null

    if (liveDist) {
      return {
        regionCode: r.code,
        regionName: r.name,
        distribution: liveDist,
        isLive: true,
      }
    }
    return {
      regionCode: r.code,
      regionName: r.name,
      distribution: r.energyDistribution,
      isLive: false,
    }
  })
}

// ============================================
// Helpers internes
// ============================================

function formatFrenchMonthYear(d: Date): string {
  const months = [
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
  ]
  return `${months[d.getMonth()] ?? ''} ${d.getFullYear()}`
}
