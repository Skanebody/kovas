import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { REGIONS } from '@/lib/observatoire/regions-data'
import {
  getEnergyDistribution,
  getObservatoireStats,
  getPriceMatrix,
  getRenovationTrend,
  getTopCities,
} from '@/lib/observatoire/stats-aggregator'
import type { Metadata } from 'next'
import { EnergyDistribution } from './energy-distribution'
import { HeroStats } from './hero-stats'
import { LeadMagnet } from './lead-magnet'
import { PressMentions } from './press-mentions'
import { PriceSection } from './price-section'
import { RenovationTrend } from './renovation-trend'
import { TopCities } from './top-cities'

/**
 * /observatoire — Page d'autorité publique data du diagnostic immobilier FR.
 *
 * Objectif business : positionner KOVAS comme la référence data du marché.
 * Cible : journalistes, presse, politiques, agents immobiliers, particuliers,
 * autres pros. Génère du backlink naturel + référencement Google Dataset Search.
 *
 * ISR 1h : `revalidate = 3600` car la table `observatoire_live_stats` est
 * rafraîchie mensuellement par une Edge Function — pas besoin de SSR sur
 * chaque requête.
 *
 * JSON-LD Schema.org `Dataset` : signale à Google Dataset Search la nature
 * jeu de données (visibilité accrue pour journalistes / chercheurs).
 *
 * Padding et tailles (révision 2026-05-26) :
 *   - Sections compactes `py-12 sm:py-16` (vs ancien `py-20 sm:py-28` trop aéré
 *     pour une page data dense)
 *   - Titres H2 `clamp(28px, 3.5vw, 44px)` (vs ancien 32-56px)
 *   - Container 1240px sur les blocs data, 800px sur les blocs texte
 *   - KPI hero `clamp(54px, 8vw, 92px)` (vs 60-120px)
 *
 * Chaque graphique embarque un `ChartCaption` avec :
 *   - Note pédagogique « Comment lire ce graphique »
 *   - Axes X / Y explicites
 *   - Source précise (ADEME, INSEE, ANAH, missions KOVAS)
 *   - Statut data « live » vs « extrapolée » signalé honnêtement
 */

export const revalidate = 3600 // ISR 1h

const KOVAS_BASE_URL = 'https://kovas.fr'

export const metadata: Metadata = {
  title: 'Observatoire KOVAS · Data publique du diagnostic immobilier en France 2026',
  description:
    'Prix médians DPE, distribution F-G par région, évolution rénovation, top villes en transition énergétique. Mise à jour mensuelle. Source officielle KOVAS.',
  keywords: [
    'diagnostic immobilier',
    'DPE',
    'performance énergétique',
    'observatoire immobilier France',
    'rénovation énergétique',
    'prix DPE',
    'classes énergétiques',
    'données ouvertes',
  ],
  alternates: { canonical: `${KOVAS_BASE_URL}/observatoire` },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: `${KOVAS_BASE_URL}/observatoire`,
    siteName: 'KOVAS',
    title: 'Observatoire KOVAS · Data publique du diagnostic immobilier en France',
    description:
      'Prix médians, distribution énergétique régionale, top villes en transition. Rapport mensuel téléchargeable.',
    images: [
      {
        url: `${KOVAS_BASE_URL}/og/observatoire.png`,
        width: 1200,
        height: 630,
        alt: 'Observatoire KOVAS du Diagnostic Immobilier — Édition courante',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Observatoire KOVAS du Diagnostic Immobilier',
    description: 'Toutes les data publiques du marché français, mises à jour chaque mois.',
  },
}

export default async function ObservatoirePage() {
  const [stats, priceMatrix, energyRows, renovationData, topCitiesResult] = await Promise.all([
    getObservatoireStats(),
    getPriceMatrix(),
    getEnergyDistribution(),
    getRenovationTrend(),
    getTopCities(),
  ])
  const periodLabel = stats.lastUpdatedLabel

  // ============ JSON-LD Schema.org Dataset ============
  // Signale à Google Dataset Search la nature jeu de données.
  // https://developers.google.com/search/docs/appearance/structured-data/dataset
  const datasetSchema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    '@id': `${KOVAS_BASE_URL}/observatoire#dataset`,
    name: 'Observatoire KOVAS du Diagnostic Immobilier',
    description:
      'Jeu de données mensuel sur le marché du diagnostic immobilier en France métropolitaine : prix médians par région et par type de diagnostic (DPE, amiante, plomb, gaz, électricité, termites, Carrez/Boutin, ERP), distribution des classes énergétiques A à G, évolution de la rénovation énergétique sur 24 mois et classement des villes en transition. Source : agrégation ADEME, Géorisques, INSEE et missions KOVAS anonymisées.',
    keywords: [
      'diagnostic immobilier',
      'DPE',
      'performance énergétique France',
      'amiante',
      'plomb',
      'gaz',
      'électricité',
      'termites',
      'Loi Carrez',
      'ERP',
      'rénovation énergétique',
      'classes énergétiques',
      'MaPrimeRénov',
      'France',
    ],
    creator: {
      '@type': 'Organization',
      name: 'KOVAS',
      url: KOVAS_BASE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'KOVAS',
      url: KOVAS_BASE_URL,
    },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    isAccessibleForFree: true,
    inLanguage: 'fr-FR',
    temporalCoverage: '2026/..',
    spatialCoverage: {
      '@type': 'Place',
      name: 'France métropolitaine',
      geo: {
        '@type': 'GeoShape',
        addressCountry: 'FR',
      },
    },
    dateModified: stats.lastUpdated,
    datePublished: '2026-05-22',
    url: `${KOVAS_BASE_URL}/observatoire`,
    distribution: [
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/pdf',
        contentUrl: `${KOVAS_BASE_URL}/observatoire`,
        name: 'Rapport mensuel PDF',
      },
      {
        '@type': 'DataDownload',
        encodingFormat: 'text/csv',
        contentUrl: `${KOVAS_BASE_URL}/observatoire/data.csv`,
        name: 'Export CSV (à venir V2)',
      },
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: `${KOVAS_BASE_URL}/observatoire/data.json`,
        name: 'Export JSON (à venir V2)',
      },
    ],
    variableMeasured: [
      'Prix médian DPE par région (€ TTC)',
      'Prix médian Amiante par région (€ TTC)',
      'Prix médian Plomb par région (€ TTC)',
      'Prix médian Gaz par région (€ TTC)',
      'Prix médian Électricité par région (€ TTC)',
      'Prix médian Termites par région (€ TTC)',
      'Prix médian Carrez / Boutin par région (€ TTC)',
      'Prix médian ERP par région (€ TTC)',
      'Distribution des classes énergétiques A-G par région (%)',
      'Volume mensuel de rénovations énergétiques (24 mois)',
      'Score composite de transition énergétique des villes (0-100)',
      'Part de logements F ou G vendus (%)',
      'Délai médian commande → livraison rapport (jours)',
    ],
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Accueil',
        item: `${KOVAS_BASE_URL}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Observatoire',
        item: `${KOVAS_BASE_URL}/observatoire`,
      },
    ],
  }

  return (
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      {/* JSON-LD — un seul <script> par schéma, en clair pour Googlebot */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD inline standard pratique
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(datasetSchema).replace(/</g, '\\u003c'),
        }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD inline standard pratique
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema).replace(/</g, '\\u003c'),
        }}
      />

      <PublicHeader />

      <main className="flex-1">
        {/* ============ HERO ============ */}
        <section className="px-5 sm:px-12 pt-12 sm:pt-20 pb-10 sm:pb-14 animate-fade-in motion-reduce:animate-none">
          <div className="max-w-[1240px] mx-auto">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Observatoire public
              </span>
              <span className="font-mono text-[11px] text-[#0F1419]/55">·</span>
              <span className="inline-flex items-center gap-2 rounded-pill bg-chartreuse-soft px-3 py-1 font-mono text-[11px] text-[#0F1419]">
                <span className="size-1.5 rounded-full bg-chartreuse-deep" aria-hidden />
                {stats.isLive
                  ? `Données live · ${stats.lastUpdatedLabel}`
                  : 'Données en cours de mise à jour'}
              </span>
              {!stats.isLive && (
                <span className="font-mono text-[11px] text-[#0F1419]/55">
                  · Référentiel ADEME 2024 temporairement — refresh DB en attente
                </span>
              )}
            </div>
            <h1
              className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.04] max-w-[1000px]"
              style={{ fontSize: 'clamp(36px, 5.5vw, 80px)' }}
            >
              L’<span className="font-serif italic font-normal">observatoire</span> du diagnostic
              immobilier.
            </h1>
            <p className="mt-6 max-w-[640px] text-[16px] sm:text-[18px] text-[#0F1419]/72 leading-relaxed">
              Toutes les data publiques du diagnostic immobilier en France métropolitaine, mises à
              jour chaque mois. Prix médians, distribution énergétique régionale, évolution de la
              rénovation et classement des villes en transition. Sources ADEME, Géorisques, INSEE et
              missions KOVAS anonymisées.
            </p>
          </div>
        </section>

        {/* ============ 3 KPI HERO ============ */}
        <section className="px-5 sm:px-12 py-12 sm:py-16 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
          <div className="max-w-[1240px] mx-auto">
            <HeroStats
              stats={[
                {
                  value: stats.fGRate,
                  suffix: ' %',
                  decimals: 1,
                  label: 'des biens vendus en 2026 classés F ou G en France',
                },
                {
                  value: stats.dpeMedianPrice,
                  suffix: ' €',
                  label: 'prix médian d’un DPE en France métropolitaine',
                },
                {
                  value: stats.medianDelivery,
                  suffix: ' jours',
                  label: 'délai médian entre la demande et la signature du rapport',
                },
              ]}
            />
          </div>
        </section>

        {/* ============ SECTION 2 — PRIX PAR RÉGION ============ */}
        <section className="px-5 sm:px-12 py-12 sm:py-16 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto">
            <div className="mb-8 max-w-[720px] space-y-2.5">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Section 2 · Prix
              </p>
              <h2
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.06]"
                style={{ fontSize: 'clamp(28px, 3.5vw, 44px)' }}
              >
                Prix médian par <span className="font-serif italic font-normal">diagnostic</span> et
                par région.
              </h2>
              <p className="text-[15px] text-[#0F1419]/72 leading-relaxed">
                Tarifs médians TTC observés sur douze mois glissants, pour les huit diagnostics
                réglementaires. Les écarts régionaux reflètent le coût du foncier et la densité du
                tissu professionnel.
              </p>
            </div>
            <PriceSection matrix={priceMatrix} regions={REGIONS} periodLabel={periodLabel} />
          </div>
        </section>

        {/* ============ SECTION 3 — DISTRIBUTION ÉNERGÉTIQUE ============ */}
        <section className="px-5 sm:px-12 py-12 sm:py-16 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
          <div className="max-w-[1240px] mx-auto">
            <div className="mb-8 max-w-[720px] space-y-2.5">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Section 3 · Distribution énergétique
              </p>
              <h2
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.06]"
                style={{ fontSize: 'clamp(28px, 3.5vw, 44px)' }}
              >
                Classes énergétiques A-G par{' '}
                <span className="font-serif italic font-normal">région</span>.
              </h2>
              <p className="text-[15px] text-[#0F1419]/72 leading-relaxed">
                Distribution en pourcentage du parc diagnostiqué sur douze mois. Les régions
                septentrionales présentent les parts F-G les plus élevées, reflet d’un parc ancien
                plus exposé à la déperdition thermique.
              </p>
            </div>
            <EnergyDistribution rows={energyRows} periodLabel={periodLabel} />
          </div>
        </section>

        {/* ============ SECTION 4 — ÉVOLUTION RÉNOVATION ============ */}
        <section className="px-5 sm:px-12 py-12 sm:py-16 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto">
            <div className="mb-8 max-w-[720px] space-y-2.5">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Section 4 · Évolution
              </p>
              <h2
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.06]"
                style={{ fontSize: 'clamp(28px, 3.5vw, 44px)' }}
              >
                Évolution de la <span className="font-serif italic font-normal">rénovation</span>{' '}
                énergétique.
              </h2>
              <p className="text-[15px] text-[#0F1419]/72 leading-relaxed">
                Nombre de rénovations énergétiques engagées chaque mois sur l’ensemble du territoire
                métropolitain, lissé en moyenne mobile trois mois pour neutraliser la saisonnalité.
              </p>
            </div>
            <RenovationTrend
              data={renovationData.data}
              periodLabel={periodLabel}
              isLive={renovationData.isLive}
              isFullyLive={renovationData.isFullyLive}
              isMixed={renovationData.isMixed}
            />
          </div>
        </section>

        {/* ============ SECTION 5 — TOP 10 VILLES ============ */}
        <section className="px-5 sm:px-12 py-12 sm:py-16 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
          <div className="max-w-[1240px] mx-auto">
            <div className="mb-8 max-w-[720px] space-y-2.5">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Section 5 · Classement
              </p>
              <h2
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.06]"
                style={{ fontSize: 'clamp(28px, 3.5vw, 44px)' }}
              >
                Top 10 des villes en{' '}
                <span className="font-serif italic font-normal">transition</span> énergétique.
              </h2>
              <p className="text-[15px] text-[#0F1419]/72 leading-relaxed">
                Score composite (0-100) calculé à partir du ratio rénovations / 1000 habitants, de
                la variation annuelle de la part F-G et du taux de bénéficiaires MaPrimeRénov.
              </p>
            </div>
            <TopCities
              cities={topCitiesResult.cities}
              isLive={topCitiesResult.isLive}
              periodLabel={periodLabel}
            />
          </div>
        </section>

        {/* ============ SECTION 6 — PRESSE ============ */}
        <section className="px-5 sm:px-12 py-12 sm:py-16 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto">
            <div className="mb-8 max-w-[640px] space-y-2.5 mx-auto text-center">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Section 6 · Presse
              </p>
              <h2
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.06]"
                style={{ fontSize: 'clamp(28px, 3.5vw, 44px)' }}
              >
                Des données reprises par la{' '}
                <span className="font-serif italic font-normal">presse</span> nationale.
              </h2>
            </div>
            <PressMentions />
          </div>
        </section>

        {/* ============ SECTION 7 — LEAD MAGNET PDF ============ */}
        <section className="px-5 sm:px-12 py-12 sm:py-16 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
          <div className="max-w-[1240px] mx-auto">
            <LeadMagnet editionLabel={stats.lastUpdatedLabel} />
          </div>
        </section>

        {/* ============ MÉTHODOLOGIE — glossaire express ============ */}
        <section className="px-5 sm:px-12 py-10 sm:py-14 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto space-y-3">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
              Méthodologie
            </p>
            <p className="text-[13px] text-[#0F1419]/72 max-w-[800px] leading-relaxed">
              Données agrégées à partir des bases publiques ADEME (
              <GlossaryTerm term="DPE" /> · <GlossaryTerm term="3CL-2021">3CL-2021</GlossaryTerm>),
              Géorisques (<GlossaryTerm term="ERP" />
              ), INSEE et missions diagnostiquées sur KOVAS (anonymisées et accréditées{' '}
              <GlossaryTerm term="COFRAC" />
              ). Le calendrier des{' '}
              <GlossaryTerm term="passoire-thermique">passoires thermiques</GlossaryTerm> applique
              le décret 2022-510. L&apos;
              <GlossaryTerm term="audit-energetique">audit énergétique</GlossaryTerm> réglementaire
              est obligatoire à la vente des classes F, G depuis avril 2023 et E depuis janvier
              2025.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
