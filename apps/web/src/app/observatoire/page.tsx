import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { REGIONS } from '@/lib/observatoire/regions-data'
import {
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
 * ISR 1h : `revalidate = 3600` car les stats mockées V1 sont stables (et V2
 * branchera des RPC Supabase rafraîchies par cron mensuel — pas besoin de SSR
 * sur chaque requête).
 *
 * JSON-LD Schema.org `Dataset` : signale à Google Dataset Search la nature
 * jeu de données (visibilité accrue pour journalistes / chercheurs).
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
  const [stats, priceMatrix, renovationData, topCities] = await Promise.all([
    getObservatoireStats(),
    getPriceMatrix(),
    getRenovationTrend(),
    getTopCities(),
  ])

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
    <div className="min-h-dvh flex flex-col bg-sage text-ink font-sans">
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
        <section className="bg-paper border-b border-rule/40">
          <div className="max-w-[1200px] mx-auto px-6 pt-16 sm:pt-24 pb-16">
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 font-medium">
                Observatoire public
              </span>
              <span className="font-mono text-[11px] text-ink-mute">·</span>
              <span className="inline-flex items-center gap-2 rounded-pill bg-chartreuse-soft px-3 py-1 font-mono text-[11px] text-ink">
                <span className="size-1.5 rounded-full bg-chartreuse-deep" aria-hidden />
                {stats.isLive
                  ? `Mis à jour : ${stats.lastUpdatedLabel}`
                  : 'Données en cours de mise à jour'}
              </span>
              {!stats.isLive && (
                <span className="font-mono text-[11px] text-ink/55">
                  · Source temporaire référentiel ADEME 2024 — refresh DB en attente
                </span>
              )}
            </div>
            <h1 className="font-sans font-semibold text-[44px] sm:text-[64px] md:text-[80px] leading-[1.02] tracking-[-0.03em] mb-8 max-w-[1000px]">
              L’observatoire <span className="text-display-serif text-chartreuse-deep">KOVAS</span>{' '}
              du diagnostic immobilier.
            </h1>
            <p className="text-[17px] sm:text-[19px] text-ink/72 max-w-[760px] leading-relaxed">
              Toutes les data publiques du diagnostic immobilier en France métropolitaine, mises à
              jour chaque mois. Prix médians, distribution énergétique régionale, évolution de la
              rénovation et classement des villes en transition. Sources ADEME, Géorisques, INSEE et
              missions KOVAS anonymisées.
            </p>
          </div>
        </section>

        {/* ============ 3 KPI HERO ============ */}
        <section className="border-b border-rule/40">
          <div className="max-w-[1200px] mx-auto px-6 py-20 sm:py-28">
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
        <section className="border-b border-rule/40">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="mb-12 max-w-[760px]">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 font-medium mb-3">
                Section 2 · Prix
              </p>
              <h2 className="font-sans font-semibold text-[32px] sm:text-[44px] leading-[1.05] tracking-[-0.02em] mb-4">
                Prix médian par <span className="text-display-serif">diagnostic</span> et par
                région.
              </h2>
              <p className="text-[15px] sm:text-[17px] text-ink/72 leading-relaxed">
                Tarifs médians TTC observés sur douze mois glissants, pour les huit diagnostics
                réglementaires en vigueur. Les écarts régionaux reflètent le coût du foncier, la
                densité du tissu professionnel et les contraintes d’accès terrain.
              </p>
            </div>
            <PriceSection matrix={priceMatrix} regions={REGIONS} />
          </div>
        </section>

        {/* ============ SECTION 3 — DISTRIBUTION ÉNERGÉTIQUE ============ */}
        <section className="border-b border-rule/40">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="mb-12 max-w-[760px]">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 font-medium mb-3">
                Section 3 · Distribution énergétique
              </p>
              <h2 className="font-sans font-semibold text-[32px] sm:text-[44px] leading-[1.05] tracking-[-0.02em] mb-4">
                Classes énergétiques A-G par <span className="text-display-serif">région</span>.
              </h2>
              <p className="text-[15px] sm:text-[17px] text-ink/72 leading-relaxed">
                Distribution en pourcentage du parc diagnostiqué sur douze mois. Les régions
                septentrionales présentent les parts F-G les plus élevées, reflet d’un parc ancien
                plus exposé à la déperdition thermique.
              </p>
            </div>
            <EnergyDistribution regions={REGIONS} />
          </div>
        </section>

        {/* ============ SECTION 4 — ÉVOLUTION RÉNOVATION ============ */}
        <section className="border-b border-rule/40">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="mb-12 max-w-[760px]">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 font-medium mb-3">
                Section 4 · Évolution
              </p>
              <h2 className="font-sans font-semibold text-[32px] sm:text-[44px] leading-[1.05] tracking-[-0.02em] mb-4">
                Évolution de la <span className="text-display-serif">rénovation</span> énergétique.
              </h2>
              <p className="text-[15px] sm:text-[17px] text-ink/72 leading-relaxed">
                Nombre de rénovations énergétiques engagées chaque mois sur l’ensemble du territoire
                métropolitain, lissé en moyenne mobile trois mois pour neutraliser la saisonnalité.
              </p>
            </div>
            <RenovationTrend data={renovationData} />
          </div>
        </section>

        {/* ============ SECTION 5 — TOP 10 VILLES ============ */}
        <section className="border-b border-rule/40">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="mb-12 max-w-[760px]">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 font-medium mb-3">
                Section 5 · Classement
              </p>
              <h2 className="font-sans font-semibold text-[32px] sm:text-[44px] leading-[1.05] tracking-[-0.02em] mb-4">
                Top 10 des villes en <span className="text-display-serif">transition</span>{' '}
                énergétique.
              </h2>
              <p className="text-[15px] sm:text-[17px] text-ink/72 leading-relaxed">
                Score composite (0-100) calculé à partir du ratio rénovations / 1000 habitants, de
                la variation annuelle de la part F-G et du taux de bénéficiaires MaPrimeRénov.
              </p>
            </div>
            <TopCities cities={topCities} />
          </div>
        </section>

        {/* ============ SECTION 6 — PRESSE ============ */}
        <section className="border-b border-rule/40 bg-paper/40">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 font-medium mb-3 text-center">
              Section 6 · Presse
            </p>
            <h2 className="font-sans font-semibold text-[28px] sm:text-[36px] leading-[1.1] tracking-[-0.02em] mb-12 text-center max-w-[760px] mx-auto">
              Des données reprises par la <span className="text-display-serif">presse</span>{' '}
              nationale.
            </h2>
            <PressMentions />
          </div>
        </section>

        {/* ============ SECTION 7 — LEAD MAGNET PDF ============ */}
        <section>
          <div className="max-w-[1200px] mx-auto px-6 py-20 sm:py-28">
            <LeadMagnet editionLabel={stats.lastUpdatedLabel} />
          </div>
        </section>

        {/* ============ MÉTHODOLOGIE — glossaire express ============ */}
        <section className="border-t border-rule/40 bg-paper">
          <div className="max-w-[1200px] mx-auto px-6 py-14">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 font-medium mb-3">
              Méthodologie
            </p>
            <p className="text-[14px] text-ink/72 max-w-[860px] leading-relaxed">
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
