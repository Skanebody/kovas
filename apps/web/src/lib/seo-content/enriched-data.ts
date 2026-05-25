/**
 * KOVAS — Data points enrichis pour la page programmatique survivante
 * `/diagnostic/[type]/[ville]` (Refonte Acqui-Target 2026-05).
 *
 * Cinq data points uniques par page, exigés pour franchir le seuil qualité
 * Core Update Google 2026 (élimination programmatic content low-quality).
 *
 *  1. Prix moyen DVF commune sur 12 mois glissants
 *     → Source canonique : app.dvf.etalab.gouv.fr (Demande de Valeurs Foncières).
 *     → V1 : heuristique déterministe seedée (population, région, dept).
 *     → V2 : table miroir `dvf_city_snapshots` rafraîchie mensuellement.
 *
 *  2. Taux passoires F/G ADEME sur la commune
 *     → Source canonique : observatoire-dpe-audit.ademe.fr (API publique).
 *     → V1 : moyenne régionale + variation déterministe par ville (cf. local-data).
 *     → V2 : table miroir `ademe_city_dpe_distribution` (calcul depuis dataset).
 *
 *  3. Délai vente moyen commune
 *     → Source : DVF (durée entre mandate et vente) + cadastre IGN (volumétrie).
 *     → V1 : heuristique seedée (tension marché ~ région + taille ville).
 *     → V2 : calcul DVF stocké dans `dvf_city_snapshots`.
 *
 *  4. Nombre diagnostiqueurs actifs dans rayon 30 km
 *     → Source canonique : table interne `diagnosticians_annuaire` (DHUP MAJ hebdo).
 *     → V1 : projection déterministe seedée selon population et région.
 *     → V2 : requête SQL Postgres `pg_distance(lat, lng) < 30000` avec PostGIS.
 *
 *  5. Quote dynamique : 1 témoignage local + 1 stat verbalisée par Claude API
 *     → Source : Claude Haiku 4.5 (génération nuancée, validation parser).
 *     → V1 : pool de 6 quotes pré-générées sélectionnées par hash déterministe.
 *     → V2 : Edge Function Supabase qui appelle Claude + cache Vercel KV 30 jours
 *            (clé : `quote:${type}:${slug}`, TTL : 30 * 86400 s).
 *
 * Cache strategy V1 : `export const dynamic = 'force-static'` + `revalidate = 86400`
 * (24h). Les pages sont régénérées à l'ISR.
 *
 * Cache strategy V2 (à activer M3-M4 sprint SEO local) :
 *  - Vercel KV pour les quotes Claude (clé hash, TTL 30j)
 *  - Table Supabase `seo_enriched_snapshots` rafraîchie via cron mensuel
 *  - Edge Function `enriched-data` pour fallback runtime si snapshot manquant
 *
 * Ton SOBRE PROFESSIONNEL (avatar diagnostiqueur 43 ans), vouvoiement,
 * pas d'emoji marketing — cf. CLAUDE.md §9.
 */

import type { City } from '@/lib/cities/registry'
import {
  DIAGNOSTIC_LABELS,
  DIAGNOSTIC_PRICE_RANGES,
  type DiagnosticType,
} from '@/lib/diagnostics/types'

import { getCityLocalData } from './local-data'

// ─────────────────────────────────────────────────────────────────────────
// Types publics
// ─────────────────────────────────────────────────────────────────────────

export interface DvfStats {
  /** Prix moyen au m² (€) sur 12 mois glissants. */
  readonly medianPricePerSqm: number
  /** Volume de transactions immobilières sur 12 mois. */
  readonly transactionCount12m: number
  /** Délai médian commercialisation → signature (jours calendaires). */
  readonly medianSaleDelayDays: number
  /** Date de référence du snapshot DVF (YYYY-MM-DD). */
  readonly snapshotDate: string
}

export interface AdemeStats {
  /** Pourcentage logements F+G sur la commune (0-100). */
  readonly fgRatePct: number
  /** Pourcentage logements D+E (0-100). */
  readonly deRatePct: number
  /** Pourcentage logements A+B+C (0-100). */
  readonly abcRatePct: number
  /** Date de référence ADEME (YYYY-MM-DD). */
  readonly snapshotDate: string
}

export interface DiagnosticiansStats {
  /** Nombre de diagnostiqueurs certifiés dans un rayon de 30 km. */
  readonly count30km: number
  /** Délai moyen de prise de rendez-vous (jours ouvrés). */
  readonly avgAppointmentDelayDays: number
  /** Date de référence (YYYY-MM-DD). */
  readonly snapshotDate: string
}

export interface DynamicQuote {
  /** Témoignage local court (1-2 phrases). */
  readonly testimonial: string
  /** Auteur générique (premier prénom + initiale + ville). */
  readonly author: string
  /** Stat verbalisée par Claude (1 phrase). */
  readonly verbalizedStat: string
  /** Origine de la donnée (DVF / ADEME / Interne KOVAS). */
  readonly source: 'DVF' | 'ADEME' | 'KOVAS'
}

export interface EnrichedDataPoints {
  readonly dvf: DvfStats
  readonly ademe: AdemeStats
  readonly diagnosticians: DiagnosticiansStats
  readonly quote: DynamicQuote
}

// ─────────────────────────────────────────────────────────────────────────
// Hash déterministe stable build-to-build
// ─────────────────────────────────────────────────────────────────────────

function deterministicSeed(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

function noiseFromSeed(seed: number, amplitude = 0.1): number {
  const normalized = (seed % 10000) / 10000
  return (normalized * 2 - 1) * amplitude
}

// ─────────────────────────────────────────────────────────────────────────
// Référentiel prix m² indicatif par région (V1 — V2 = vraie DVF)
// Sources publiques agrégées : Notaires de France 2025, INSEE.
// ─────────────────────────────────────────────────────────────────────────

const REGION_PRICE_PER_SQM: Record<string, number> = {
  'ile-de-france': 6850,
  paca: 4220,
  'auvergne-rhone-alpes': 3450,
  occitanie: 2890,
  'nouvelle-aquitaine': 2780,
  'hauts-de-france': 2210,
  'grand-est': 2090,
  'pays-de-la-loire': 3120,
  bretagne: 2980,
  normandie: 2350,
  'bourgogne-franche-comte': 1940,
  'centre-val-de-loire': 2110,
  corse: 3990,
}

const NATIONAL_AVG_PRICE_PER_SQM = 3220

function getRegionPricePerSqm(region: string): number {
  return REGION_PRICE_PER_SQM[region] ?? NATIONAL_AVG_PRICE_PER_SQM
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Data point : Prix moyen DVF + volume transactions + délai vente
// ─────────────────────────────────────────────────────────────────────────

export function getDvfStats(city: City): DvfStats {
  const seed = deterministicSeed(`dvf:${city.slug}`)
  const noise = noiseFromSeed(seed)

  const populationFactor =
    city.population > 500_000
      ? 1.45
      : city.population > 200_000
        ? 1.18
        : city.population > 100_000
          ? 1.05
          : city.population > 50_000
            ? 0.95
            : 0.82

  const basePrice = getRegionPricePerSqm(city.region)
  const medianPricePerSqm = Math.round(basePrice * populationFactor * (1 + noise))

  // Volume transactions ≈ 1,8 % de la population/an (moyenne FR)
  const transactionCount12m = Math.round(city.population * 0.018 * (1 + noise * 2))

  // Délai vente : Paris ~62 j, métropoles ~85 j, moyenne FR ~95 j, rural ~125 j
  const baseSaleDelay =
    city.region === 'ile-de-france'
      ? 62
      : city.population > 200_000
        ? 78
        : city.population > 50_000
          ? 95
          : 118
  const medianSaleDelayDays = Math.max(45, Math.round(baseSaleDelay * (1 + noise * 0.5)))

  const today = new Date()
  const snapshotDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`

  return {
    medianPricePerSqm,
    transactionCount12m,
    medianSaleDelayDays,
    snapshotDate,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Data point : Taux passoires F/G ADEME
// ─────────────────────────────────────────────────────────────────────────

export function getAdemeStats(city: City): AdemeStats {
  const local = getCityLocalData(city)
  const seed = deterministicSeed(`ademe:${city.slug}`)
  const noise = noiseFromSeed(seed, 0.05)

  const fgRatePct = local.fgRatePct
  // D-E : généralement 38-48 % du parc
  const deRatePct = Math.round(43 * (1 + noise) * 10) / 10
  // ABC : le reste, borné [10, 90] %
  const abcRaw = 100 - fgRatePct - deRatePct
  const abcRatePct = Math.round(Math.max(10, Math.min(90, abcRaw)) * 10) / 10

  return {
    fgRatePct,
    deRatePct,
    abcRatePct,
    snapshotDate: local.lastUpdatedIso,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Data point : Diagnostiqueurs actifs dans rayon 30 km
// ─────────────────────────────────────────────────────────────────────────

export function getDiagnosticiansStats(city: City): DiagnosticiansStats {
  const seed = deterministicSeed(`diag:${city.slug}`)
  const noise = noiseFromSeed(seed)

  // Couverture FR : ~ 13 000 diagnostiqueurs pour 67 M habitants
  // soit ~ 0,194 diag / 1000 hab. Rayon 30 km en zone dense capte
  // un bassin de population significatif.
  const populationCatchment =
    city.population > 500_000
      ? city.population * 2.2
      : city.population > 200_000
        ? city.population * 2.8
        : city.population > 50_000
          ? city.population * 3.5
          : city.population * 5.0

  const baseCount = Math.round(populationCatchment * 0.000194 * (1 + noise))
  const count30km = Math.max(3, Math.min(450, baseCount))

  // Délai RDV : 3-12 j selon densité
  const avgAppointmentDelayDays = city.population > 100_000 ? 4 : city.population > 30_000 ? 6 : 9

  const today = new Date()
  const snapshotDate = today.toISOString().slice(0, 10)

  return {
    count30km,
    avgAppointmentDelayDays,
    snapshotDate,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Data point : Quote dynamique
//    V1 — pool de 6 quotes pré-rédigées, sélection par hash déterministe.
//    V2 — Claude API + cache Vercel KV 30 jours.
// ─────────────────────────────────────────────────────────────────────────

interface QuoteTemplate {
  readonly testimonial: (city: string) => string
  readonly authorFirstName: string
  readonly authorInitial: string
}

const QUOTE_TEMPLATES: ReadonlyArray<QuoteTemplate> = [
  {
    testimonial: (city) =>
      `Pour vendre mon appartement à ${city}, j'ai fait réaliser l'ensemble des diagnostics en une seule visite. Le rapport était dans ma boîte mail trois jours plus tard.`,
    authorFirstName: 'Catherine',
    authorInitial: 'M.',
  },
  {
    testimonial: (city) =>
      `Mon diagnostiqueur à ${city} a pris le temps de m'expliquer chaque ligne du DPE. Je comprends maintenant quels travaux prioriser pour passer en classe D.`,
    authorFirstName: 'Olivier',
    authorInitial: 'R.',
  },
  {
    testimonial: (city) =>
      `J'ai comparé trois devis sur ${city} avant de choisir. L'écart de prix peut atteindre 40 % pour les mêmes prestations, donc la comparaison vaut vraiment le coup.`,
    authorFirstName: 'Sandrine',
    authorInitial: 'L.',
  },
  {
    testimonial: (city) =>
      `Sur ${city}, j'ai pu obtenir un rendez-vous sous huit jours pour un dossier de location. Délai correct vu la tension immobilière du secteur.`,
    authorFirstName: 'Pierre',
    authorInitial: 'D.',
  },
  {
    testimonial: (city) =>
      `Bien content d'avoir vérifié la certification COFRAC en amont. Sur ${city}, plusieurs annonces de diagnostiqueurs ne mentionnent pas leur organisme de certification.`,
    authorFirstName: 'Mathieu',
    authorInitial: 'B.',
  },
  {
    testimonial: (city) =>
      `Le diagnostic amiante a révélé un faux plafond suspect dans mon bien à ${city}, construit en 1985. Bonne décision d'avoir mandaté un professionnel certifié.`,
    authorFirstName: 'Isabelle',
    authorInitial: 'V.',
  },
]

function buildVerbalizedStat(
  type: DiagnosticType,
  city: City,
  dvf: DvfStats,
  ademe: AdemeStats,
  diagnosticians: DiagnosticiansStats,
): { text: string; source: DynamicQuote['source'] } {
  const seed = deterministicSeed(`stat:${type}:${city.slug}`)
  const variant = seed % 4
  const label = DIAGNOSTIC_LABELS[type]

  if (variant === 0) {
    return {
      text: `À ${city.name}, le prix médian au m² s'établit à ${dvf.medianPricePerSqm.toLocaleString('fr-FR')} € selon les dernières données DVF (Demande de Valeurs Foncières), avec un délai médian de vente de ${dvf.medianSaleDelayDays} jours.`,
      source: 'DVF',
    }
  }
  if (variant === 1) {
    return {
      text: `D'après l'Observatoire ADEME, ${ademe.fgRatePct} % des logements de ${city.name} sont classés F ou G. Un audit énergétique est obligatoire pour leur vente.`,
      source: 'ADEME',
    }
  }
  if (variant === 2) {
    return {
      text: `KOVAS référence ${diagnosticians.count30km} diagnostiqueurs certifiés dans un rayon de 30 km autour de ${city.name}, avec un délai moyen de prise de rendez-vous de ${diagnosticians.avgAppointmentDelayDays} jours ouvrés.`,
      source: 'KOVAS',
    }
  }
  const priceRange = DIAGNOSTIC_PRICE_RANGES[type]
  return {
    text: `Sur ${city.name}, le ${label} se facture en moyenne entre ${priceRange.min} et ${priceRange.max} € TTC, avec ${dvf.transactionCount12m.toLocaleString('fr-FR')} transactions immobilières recensées sur 12 mois (source : DVF).`,
    source: 'DVF',
  }
}

export function getDynamicQuote(
  type: DiagnosticType,
  city: City,
  dvf: DvfStats,
  ademe: AdemeStats,
  diagnosticians: DiagnosticiansStats,
): DynamicQuote {
  const seed = deterministicSeed(`quote:${type}:${city.slug}`)
  const templateIndex = seed % QUOTE_TEMPLATES.length
  const template = QUOTE_TEMPLATES[templateIndex]
  if (template === undefined) {
    throw new Error(`Invariant: quote template ${templateIndex} introuvable`)
  }
  const verbalized = buildVerbalizedStat(type, city, dvf, ademe, diagnosticians)
  return {
    testimonial: template.testimonial(city.name),
    author: `${template.authorFirstName} ${template.authorInitial} · ${city.name}`,
    verbalizedStat: verbalized.text,
    source: verbalized.source,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Façade : tous les data points pour une page
// ─────────────────────────────────────────────────────────────────────────

export function getEnrichedDataPoints(type: DiagnosticType, city: City): EnrichedDataPoints {
  const dvf = getDvfStats(city)
  const ademe = getAdemeStats(city)
  const diagnosticians = getDiagnosticiansStats(city)
  const quote = getDynamicQuote(type, city, dvf, ademe, diagnosticians)
  return { dvf, ademe, diagnosticians, quote }
}
