/**
 * Agrégateur de statistiques publiques pour /observatoire.
 *
 * V1 : data mockée — chiffres réalistes calibrés (ADEME 2024 + études marché).
 * V2 : remplacer chaque fonction par une RPC Supabase qui agrège les missions
 *      réelles KOVAS + sources publiques (Géorisques, ADEME, INSEE) cachées
 *      en table `observatoire_snapshots` rafraîchie via cron mensuel.
 *
 * Toutes les fonctions sont synchrones pour V1 mais signées en `async` afin
 * de ne pas exiger de refonte côté Server Components lors du branchement V2.
 */

import {
  type DiagnosticType,
  REGIONS,
  getFGRateFrance,
  getMedianPriceFrance,
} from './regions-data'

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
}

/**
 * Renvoie les 3 KPI hero de l'observatoire.
 *
 * Branchera plus tard `supabase.rpc('observatoire_stats')` ; pour V1, calcule
 * à partir du référentiel `regions-data.ts`.
 */
export async function getObservatoireStats(): Promise<ObservatoireStats> {
  const now = new Date()
  const totalDiagnostics = REGIONS.reduce((sum, r) => sum + r.diagnosticsCount, 0)

  return {
    fGRate: getFGRateFrance(),
    dpeMedianPrice: getMedianPriceFrance('dpe'),
    medianDelivery: 12,
    lastUpdated: now.toISOString(),
    lastUpdatedLabel: formatFrenchMonthYear(now),
    totalDiagnosticsYear: totalDiagnostics,
  }
}

/**
 * Renvoie l'évolution mensuelle du nombre de rénovations énergétiques (24 mois
 * glissants). Tendance + ~5%/mois avec saisonnalité légère (creux estival).
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
      month: monthsFr[monthIdx],
      year: d.getFullYear(),
      count,
      label: `${monthsFr[monthIdx]} ${String(d.getFullYear()).slice(2)}`,
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

/**
 * Top 10 villes en transition énergétique.
 * Données mockées V1 — villes existantes avec scores réalistes basés sur
 * politiques locales connues (Grenoble, Nantes, Strasbourg pionnières).
 */
export async function getTopCities(): Promise<readonly TopCity[]> {
  return [
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
}

/**
 * Renvoie le tableau prix médian × région × diagnostic (matrice complète).
 * Pour le tableau de la Section 2.
 */
export async function getPriceMatrix(): Promise<
  readonly {
    region: string
    regionCode: string
    diagnosticsCount: number
    prices: Readonly<Record<DiagnosticType, number>>
  }[]
> {
  return REGIONS.map((r) => ({
    region: r.name,
    regionCode: r.code,
    diagnosticsCount: r.diagnosticsCount,
    prices: r.prices,
  }))
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
  return `${months[d.getMonth()]} ${d.getFullYear()}`
}
