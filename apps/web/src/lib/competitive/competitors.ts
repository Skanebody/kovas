/**
 * KOVAS — Système 14 : Competitive intelligence — registry concurrents.
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §17 + CLAUDE.md §1 (concurrence).
 *
 * Registry statique des 5 concurrents principaux du marché diagnostic
 * immobilier FR à surveiller en daily scraping. Chaque concurrent expose
 * son URL homepage + (si dispo) URL pricing/features/blog.
 *
 * Liciel est l'acteur dominant (40-52% PdM, racheté Enersweet/Pictet AM).
 * Les autres sont des éditeurs secondaires + maisons-mères réseaux.
 *
 * Pure data, zéro IO. Le caller (Edge Function scraping) utilise ce registry
 * pour piloter les fetches quotidiens.
 */

export type CompetitorSlug = 'liciel' | 'obbc' | 'analysimmo' | 'bc2e' | 'mhdiag'

export interface Competitor {
  /** Identifiant stable (utilisé en DB + clé de cache) */
  slug: CompetitorSlug
  /** Nom commercial */
  name: string
  /** URL principale à scraper en priorité */
  homepage_url: string
  /** Page pricing (null si pas dispo publiquement) */
  pricing_url: string | null
  /** Page features/produit (null si pas dispo) */
  features_url: string | null
  /** Blog / actu (null si pas dispo) */
  blog_url: string | null
  /** Part de marché estimée en % (null si non documenté) */
  market_share_pct: number | null
  /** Menace stratégique majeure (Liciel + secondaires bien établis) */
  is_major_threat: boolean
  /** Notes contexte concurrentiel */
  notes: string
}

export const COMPETITORS: ReadonlyArray<Competitor> = [
  {
    slug: 'liciel',
    name: 'Liciel',
    homepage_url: 'https://www.liciel.com',
    pricing_url: 'https://www.liciel.com/tarifs',
    features_url: 'https://www.liciel.com/logiciel-diagnostic-immobilier',
    blog_url: 'https://www.liciel.com/actualites',
    market_share_pct: 46,
    is_major_threat: true,
    notes:
      'Acteur dominant (40-52% PdM), racheté par Enersweet / Pictet Asset Management. ' +
      'Logiciel desktop Windows historique + cloud. Cible principale du positionnement KOVAS ' +
      '(alternative moderne mobile-first). Surveillance prioritaire sur pricing + features.',
  },
  {
    slug: 'obbc',
    name: 'OBBC',
    homepage_url: 'https://www.obbc.fr',
    pricing_url: null,
    features_url: 'https://www.obbc.fr/logiciel-diagnostic-immobilier',
    blog_url: 'https://www.obbc.fr/actualites',
    market_share_pct: 12,
    is_major_threat: true,
    notes:
      'Éditeur historique français, fort dans les cabinets indépendants. Logiciel desktop ' +
      'Windows + offre cloud émergente. Concurrent direct sur le segment solopreneur.',
  },
  {
    slug: 'analysimmo',
    name: 'AnalysImmo',
    homepage_url: 'https://www.analysimmo.com',
    pricing_url: 'https://www.analysimmo.com/tarifs',
    features_url: 'https://www.analysimmo.com/fonctionnalites',
    blog_url: null,
    market_share_pct: 6,
    is_major_threat: false,
    notes:
      'Éditeur secondaire, positionné cabinet milieu de gamme. Surveillance des évolutions ' +
      "pricing et de l'ouverture API.",
  },
  {
    slug: 'bc2e',
    name: 'BC2E',
    homepage_url: 'https://www.bc2e.fr',
    pricing_url: null,
    features_url: 'https://www.bc2e.fr/nos-services',
    blog_url: null,
    market_share_pct: null,
    is_major_threat: false,
    notes:
      'Réseau / maison-mère franchisée plutôt que pur éditeur logiciel. Concurrence indirecte ' +
      "via leur process d'équipement de leur réseau d'agences.",
  },
  {
    slug: 'mhdiag',
    name: 'MH Diagnostics',
    homepage_url: 'https://www.mh-diag.com',
    pricing_url: null,
    features_url: null,
    blog_url: 'https://www.mh-diag.com/actualites',
    market_share_pct: null,
    is_major_threat: false,
    notes:
      'Cabinet / réseau de diagnostiqueurs, présence digitale en croissance. Surveillance ' +
      "stratégie d'acquisition + outils internes éventuellement commercialisés.",
  },
]

/**
 * Récupère un concurrent par son slug.
 *
 * @example
 * ```ts
 * const liciel = getCompetitor('liciel')
 * // → { slug: 'liciel', name: 'Liciel', market_share_pct: 46, ... }
 * ```
 */
export function getCompetitor(slug: CompetitorSlug): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug)
}
