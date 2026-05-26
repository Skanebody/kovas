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

/**
 * Renvoie l'évolution mensuelle du nombre de rénovations énergétiques (24 mois
 * glissants). Tendance + ~5%/mois avec saisonnalité légère (creux estival).
 *
 * V2 (post-cron live) : interpolation entre snapshots `observatoire_live_stats`
 * disponibles + extrapolation pour les mois manquants. V1 : référentiel
 * déterministe inchangé (utilisé en fallback).
 */
export async function getRenovationTrend(): Promise<
  readonly { month: string; year: number; count: number; label: string }[]
> {
  const monthsFr = [
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
  const result: { month: string; year: number; count: number; label: string }[] = []
  const now = new Date()
  const baseline = 22_000 // rénovations / mois il y a 24 mois

  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthIdx = d.getMonth()
    // Saisonnalité : creux Juillet/Août, pic Mars-Mai et Sept-Oct
    const seasonal =
      monthIdx === 6 || monthIdx === 7
        ? 0.82
        : monthIdx === 2 || monthIdx === 3 || monthIdx === 4
          ? 1.08
          : monthIdx === 8 || monthIdx === 9
            ? 1.05
            : 1.0
    const growth = 1 + (23 - i) * 0.018 // +1,8% / mois cumulés
    const count = Math.round(baseline * growth * seasonal)
    result.push({
      month: monthsFr[monthIdx] ?? '',
      year: d.getFullYear(),
      count,
      label: `${monthsFr[monthIdx] ?? ''} ${String(d.getFullYear()).slice(2)}`,
    })
  }
  return result
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
 * Live : surcharge le prix DPE par la valeur DB si disponible.
 * Fallback : prix mockés depuis regions-data.ts.
 */
export interface PriceMatrixRow {
  region: string
  regionCode: string
  diagnosticsCount: number
  prices: Readonly<Record<DiagnosticType, number>>
  /** True si le prix DPE provient de la DB pour cette région */
  dpeIsLive: boolean
}

export async function getPriceMatrix(): Promise<readonly PriceMatrixRow[]> {
  const snapshot = await getLiveSnapshotOnce()

  return REGIONS.map((r) => {
    const live = snapshot?.regions.get(r.code)
    const livePrice = live?.medianPriceEur ?? null
    const liveCount = live?.diagnosticsCount ?? null

    // Si on a un prix DPE live, on l'écrase ; les autres diagnostics restent
    // sur le référentiel (le live ne calcule pas encore les 7 autres types).
    const prices = livePrice !== null ? { ...r.prices, dpe: Math.round(livePrice) } : r.prices

    return {
      region: r.name,
      regionCode: r.code,
      diagnosticsCount: liveCount && liveCount > 0 ? liveCount * 12 : r.diagnosticsCount,
      prices,
      dpeIsLive: livePrice !== null,
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
