import { FaqAnswer } from '@/components/faq-answer'
import { AuthorBio } from '@/components/public/AuthorBio'
import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CITIES } from '@/lib/cities/registry'
import { findCityAnywhere, getAllTop5000Slugs } from '@/lib/cities/top-5000'
import {
  DIAGNOSTIC_TYPES_INTERNAL_LINKS,
  buildCityContentAmandine,
} from '@/lib/seo-content/city-content-amandine'
import { buildCityContextAmandine } from '@/lib/seo-content/city-context-amandine'
import { getCityStats } from '@/lib/seo-content/city-stats'
import { buildLocalMarketParagraph, buildNeighborLinks } from '@/lib/seo-content/local-data'
import { createClient } from '@/lib/supabase/server'
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Flame,
  Info,
  MapPin,
  Phone,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Script from 'next/script'

/**
 * KOVAS — Page ville SEO (Mission FIX-GG — Core Update mai 2026)
 * Route : /trouver-un-diagnostiqueur/[dept]/[city]
 *
 * Stratégie Core Update mai 2026 (déployé 21/05/2026) :
 *  1. E-E-A-T : signature humaine Benjamin Bel + photo + LinkedIn + qualifications.
 *  2. Helpful content : 3 éléments uniques par page (statistiques exclusives KOVAS,
 *     contexte ville-spécifique 3-5 paragraphes, 3+ diagnostiqueurs réels).
 *  3. Anti-pogo-sticking : structure claire H1 → CTA → data locale → contexte
 *     → diagnostiqueurs → FAQ → linking interne → auteur.
 *  4. JSON-LD enrichi : LocalBusiness × N + BreadcrumbList + Article (author) +
 *     FAQPage + Dataset (stats locales).
 *
 * SSG + ISR : `generateStaticParams` pré-compile les villes du top-5000 ; les
 * autres sont générées on-demand avec revalidate 24h.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'

// Lookup table villes (registry + extras top-5000) pour internal linking voisins
const CITY_LOOKUP = new Map<
  string,
  { slug: string; name: string; postalCode: string; dept: string }
>(
  CITIES.map((c) => [
    c.slug,
    { slug: c.slug, name: c.name, postalCode: c.postalCode, dept: c.dept },
  ]),
)

// Liste canonique 8 diagnostics — importée depuis city-content-amandine.ts.
const DIAGNOSTIC_TYPES_FOR_INTERNAL_LINKS = DIAGNOSTIC_TYPES_INTERNAL_LINKS

type FaqItem = { question: string; answer: string }

type SeoGeoPageRow = {
  id: string
  slug: string
  page_type: 'city' | 'department' | 'region'
  city_slug: string | null
  city_name: string | null
  department_code: string
  department_name: string | null
  region_code: string | null
  region_name: string | null
  h1_title: string
  meta_title: string
  meta_description: string
  canonical_url: string | null
  intro_content: string | null
  long_form_content: string | null
  faq_items: FaqItem[] | null
  diagnosticians_count: number
  average_price_dpe: number | null
  transactions_count_dvf: number | null
  avg_price_per_m2: number | null
  population: number | null
  schema_jsonld: unknown
  priority_rank: number
}

type DiagnosticianCard = {
  id: string
  /** Schéma canonique unifié. Alias des anciens noms pour compat templates. */
  slug: string
  full_name: string
  city: string | null
  address: string | null
  phone: string | null
  gmb_rating: number | null
  gmb_review_count: number | null
  certifications: unknown
  years_active: number | null
}

async function loadCityPage(citySlug: string): Promise<SeoGeoPageRow | null> {
  try {
    const supabase = await createClient()
    // biome-ignore lint/suspicious/noExplicitAny: seo_geo_pages pas encore dans Database types
    const { data, error } = await (supabase as any)
      .from('seo_geo_pages')
      .select('*')
      .eq('slug', citySlug)
      .eq('page_type', 'city')
      .maybeSingle()

    if (error || !data) return null
    return data as SeoGeoPageRow
  } catch {
    return null
  }
}

async function loadDiagnosticiansForCity(
  citySlug: string,
  deptCode: string,
  limit = 12,
): Promise<{ rows: DiagnosticianCard[]; widenedToDept: boolean }> {
  // Schéma canonique prod (post-réconciliation FIX-AA) : slug / full_name /
  // city_slug / department_code (alias dept_code) / gmb_rating / etc.
  // Les anciens alias display_name / slug_full / address_line / phone_e164 /
  // rating_avg / reviews_count / years_experience ont disparu → query échouait
  // silencieusement, d'où "aucun diagnostiqueur" sur les pages city alors que
  // 50 fixtures sont en base. Fix 2026-05-23.
  const SELECT_FIELDS =
    'id, slug, full_name, city, address, phone, gmb_rating, gmb_review_count, certifications, years_active'

  try {
    const supabase = await createClient()
    // biome-ignore lint/suspicious/noExplicitAny: types Database à régénérer post-FIX-AA
    const client = supabase as any

    const { data: cityData, error: cityError } = await client
      .from('diagnosticians')
      .select(SELECT_FIELDS)
      .eq('city_slug', citySlug)
      .eq('is_published', true)
      .order('gmb_rating', { ascending: false, nullsFirst: false })
      .limit(limit)

    const cityRows = !cityError && cityData ? (cityData as DiagnosticianCard[]) : []
    if (cityRows.length >= 3) {
      return { rows: cityRows, widenedToDept: false }
    }

    // <3 diags locaux : on élargit au département pour respecter "3+
    // diagnostiqueurs réels par page" (Core Update mai 2026 helpful content).
    // Cherche sur department_code OU dept_code (cohabitation legacy/canonique).
    const { data: deptData, error: deptError } = await client
      .from('diagnosticians')
      .select(SELECT_FIELDS)
      .or(`department_code.eq.${deptCode},dept_code.eq.${deptCode}`)
      .eq('is_published', true)
      .order('gmb_rating', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (deptError || !deptData) {
      return { rows: cityRows, widenedToDept: false }
    }

    return { rows: deptData as DiagnosticianCard[], widenedToDept: true }
  } catch {
    return { rows: [], widenedToDept: false }
  }
}

const DIAG_PRICE_TABLE: { type: string; price_min: number; price_max: number }[] = [
  { type: 'DPE', price_min: 100, price_max: 250 },
  { type: 'Amiante', price_min: 90, price_max: 180 },
  { type: 'Plomb (CREP)', price_min: 130, price_max: 280 },
  { type: 'Gaz', price_min: 110, price_max: 160 },
  { type: 'Électricité', price_min: 100, price_max: 160 },
  { type: 'Termites', price_min: 100, price_max: 180 },
  { type: 'Loi Carrez', price_min: 70, price_max: 130 },
  { type: 'ERP', price_min: 20, price_max: 60 },
]

type RouteParams = { dept: string; city: string }

/**
 * Pre-compile les top-5000 villes (registry premium + extras). Toute autre
 * requête déclenche une génération à la demande avec ISR 24h. C'est le
 * compromis Core Update mai 2026 : volume × qualité.
 */
export async function generateStaticParams(): Promise<Array<{ dept: string; city: string }>> {
  // En dev/test, on évite le SSG complet pour gagner du temps de build.
  if (process.env.NEXT_BUILD_SSG_DISABLE === '1') {
    return CITIES.slice(0, 20).map((c) => ({ dept: c.dept, city: c.slug }))
  }
  return getAllTop5000Slugs().slice()
}

// Revalidate ISR — 24h pour les pages on-demand
export const revalidate = 86400

export async function generateMetadata({
  params,
}: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { dept, city } = await params
  const page = await loadCityPage(city)
  const registryCity = findCityAnywhere(city)
  const cityName = page?.city_name ?? registryCity?.name ?? city
  const postalCode = registryCity?.postalCode

  // Si on a au moins une ville registry, on peut générer une page synthétisée
  if (!page && !registryCity) {
    return { title: 'Ville introuvable — KOVAS' }
  }

  const title =
    page?.meta_title ??
    `Trouver un diagnostiqueur immobilier à ${cityName}${postalCode ? ` (${postalCode})` : ''} — KOVAS`
  const description =
    page?.meta_description ??
    `Comparez les diagnostiqueurs immobiliers certifiés à ${cityName}${postalCode ? ` (${postalCode})` : ''}. Prix DPE moyen, délais, spécificités locales et avis vérifiés. Devis gratuit sous 24h.`

  return {
    title,
    description,
    alternates: {
      canonical: page?.canonical_url ?? `${SITE_URL}/trouver-un-diagnostiqueur/${dept}/${city}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/trouver-un-diagnostiqueur/${dept}/${city}`,
      type: 'article',
      locale: 'fr_FR',
    },
    other: {
      'article:author': 'Benjamin Bel',
      'article:published_time': new Date().toISOString(),
    },
  }
}

function buildFaqJsonLd(faq: FaqItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  }
}

function buildBreadcrumbJsonLd(
  dept: string,
  city: string,
  cityName: string,
  deptName: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Trouver un diagnostiqueur',
        item: `${SITE_URL}/trouver-un-diagnostiqueur`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: deptName,
        item: `${SITE_URL}/trouver-un-diagnostiqueur/${dept}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: cityName,
        item: `${SITE_URL}/trouver-un-diagnostiqueur/${dept}/${city}`,
      },
    ],
  }
}

function buildArticleJsonLd(
  url: string,
  cityName: string,
  description: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Trouver un diagnostiqueur immobilier à ${cityName}`,
    description,
    author: {
      '@type': 'Person',
      name: 'Benjamin Bel',
      url: 'https://linkedin.com/in/benjaminbel',
      sameAs: ['https://linkedin.com/in/benjaminbel', `${SITE_URL}/a-propos`],
      jobTitle: 'Fondateur de KOVAS',
      worksFor: {
        '@type': 'Organization',
        name: 'NEXUS 1993',
        url: SITE_URL,
      },
    },
    publisher: {
      '@type': 'Organization',
      name: 'KOVAS',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/press-kit/logo-kovas-navy.svg`,
      },
    },
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  }
}

function buildLocalBusinessListJsonLd(
  diags: DiagnosticianCard[],
  cityName: string,
  regionName: string | null,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Diagnostiqueurs immobiliers à ${cityName}`,
    numberOfItems: diags.length,
    itemListElement: diags.map((d, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'LocalBusiness',
        '@id': `${SITE_URL}/trouver-un-diagnostiqueur/diag/${d.slug}`,
        name: d.full_name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: d.address ?? undefined,
          addressLocality: cityName,
          addressRegion: regionName ?? undefined,
          addressCountry: 'FR',
        },
        telephone: d.phone ?? undefined,
        aggregateRating: d.gmb_rating
          ? {
              '@type': 'AggregateRating',
              ratingValue: d.gmb_rating,
              reviewCount: d.gmb_review_count ?? 0,
              bestRating: 5,
              worstRating: 1,
            }
          : undefined,
      },
    })),
  }
}

function buildPlaceJsonLd(
  cityName: string,
  postalCode: string | undefined,
  regionName: string | null,
  population: number | null,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: cityName,
    address: {
      '@type': 'PostalAddress',
      postalCode,
      addressLocality: cityName,
      addressRegion: regionName ?? undefined,
      addressCountry: 'FR',
    },
    additionalProperty: population
      ? [
          {
            '@type': 'PropertyValue',
            propertyID: 'population',
            value: population,
          },
        ]
      : undefined,
  }
}

function buildDatasetJsonLd(
  cityName: string,
  medianPrice: number,
  fgRate: number,
  pageUrl: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `Statistiques diagnostic immobilier à ${cityName}`,
    description: `Données agrégées du marché du diagnostic immobilier à ${cityName} : prix médian DPE ${medianPrice} € TTC, ${fgRate} % de logements F/G, classe énergétique médiane, volumétrie estimée.`,
    creator: {
      '@type': 'Organization',
      name: 'KOVAS',
      url: SITE_URL,
    },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    keywords: ['DPE', 'diagnostic immobilier', 'amiante', 'plomb', cityName],
    dateModified: new Date().toISOString(),
    url: pageUrl,
  }
}

export default async function CityPage({ params }: { params: Promise<RouteParams> }) {
  const { dept, city } = await params
  const dbPage = await loadCityPage(city)
  const registryCity = findCityAnywhere(city)

  // Si ni DB ni registry → 404
  if (!dbPage && !registryCity) {
    notFound()
  }

  // City fictive (registry-based) si pas en DB
  const cityName = dbPage?.city_name ?? registryCity?.name ?? city
  const deptName = dbPage?.department_name ?? `Département ${dept}`
  const regionName = dbPage?.region_name ?? null
  const postalCode = registryCity?.postalCode

  const { rows: diagnosticians, widenedToDept } = await loadDiagnosticiansForCity(
    dbPage?.city_slug ?? city,
    dept,
    12,
  )

  // Data : essai DB réelle (ADEME+INSEE+Claude) puis fallback déterministe
  const localData = registryCity ? await getCityStats(registryCity) : null
  const neighborLinks = registryCity ? buildNeighborLinks(registryCity, CITY_LOOKUP) : []

  // Contenu Amandine Bart complet (top5, evol prix, FAQ 12, etc.)
  const amandineContent = registryCity ? buildCityContentAmandine(registryCity) : null

  // Contexte ville-spécifique (paragraphes profonds par dept)
  const cityContext = registryCity ? buildCityContextAmandine(registryCity) : null

  const baseFaq: FaqItem[] = dbPage && Array.isArray(dbPage.faq_items) ? dbPage.faq_items : []
  const faq: FaqItem[] =
    baseFaq.length > 0
      ? baseFaq
      : amandineContent
        ? amandineContent.faq.map((q) => ({ question: q.question, answer: q.answer }))
        : []

  const pageUrl = `${SITE_URL}/trouver-un-diagnostiqueur/${dept}/${city}`
  const description =
    dbPage?.meta_description ??
    `Comparez les diagnostiqueurs immobiliers certifiés à ${cityName}. Prix DPE moyen, délais, spécificités locales.`

  // Build all JSON-LD blocs
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(dept, city, cityName, deptName)
  const articleJsonLd = buildArticleJsonLd(pageUrl, cityName, description)
  const localBusinessListJsonLd = buildLocalBusinessListJsonLd(diagnosticians, cityName, regionName)
  const placeJsonLd = buildPlaceJsonLd(
    cityName,
    postalCode,
    regionName,
    registryCity?.population ?? null,
  )
  const datasetJsonLd = localData
    ? buildDatasetJsonLd(cityName, localData.medianDpePrice, localData.fgRatePct, pageUrl)
    : null
  const faqJsonLd = faq.length > 0 ? buildFaqJsonLd(faq) : null

  const lastUpdatedIso = localData?.lastUpdatedIso ?? new Date().toISOString().slice(0, 10)

  return (
    <div className="min-h-dvh flex flex-col bg-cream">
      {/* JSON-LD enrichi Core Update mai 2026 — E-E-A-T */}
      <Script
        id="seo-breadcrumb-jsonld"
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Script
        id="seo-article-jsonld"
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <Script
        id="seo-place-jsonld"
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }}
      />
      {diagnosticians.length > 0 ? (
        <Script
          id="seo-localbusiness-jsonld"
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessListJsonLd) }}
        />
      ) : null}
      {datasetJsonLd ? (
        <Script
          id="seo-dataset-jsonld"
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON
          dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
        />
      ) : null}
      {faqJsonLd ? (
        <Script
          id="seo-faq-jsonld"
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}

      <PublicHeader />

      <main className="flex-1 mx-auto max-w-6xl px-6 py-12 w-full">
        {/* ── Section 1 : H1 + hero ─────────────────────────────────── */}
        <div className="max-w-3xl mb-8 space-y-3">
          <p className="text-xs uppercase tracking-wider font-semibold text-ink-mute font-mono">
            {deptName}
            {regionName ? ` · ${regionName}` : ''}
            {registryCity?.population
              ? ` · ${registryCity.population.toLocaleString('fr-FR')} habitants`
              : ''}
          </p>
          <h1 className="font-sans font-bold text-4xl md:text-5xl tracking-tight text-ink">
            Trouver un diagnostiqueur DPE à {cityName}
            {postalCode ? ` (${postalCode})` : ''}
          </h1>
          <p className="text-ink-mute text-lg leading-relaxed">
            {dbPage?.intro_content ??
              `Comparez les diagnostiqueurs immobiliers certifiés intervenant à ${cityName}. Devis gratuit sous 24h, prix moyens vérifiés, spécificités locales et avis transparents. Tous les diagnostics obligatoires : DPE, amiante, plomb, gaz, électricité, termites, Carrez, ERP.`}
          </p>
          <p className="text-xs text-ink-faint font-mono inline-flex items-center gap-1.5 pt-2">
            <CalendarClock className="size-3" aria-hidden />
            <time dateTime={lastUpdatedIso}>
              Mis à jour le{' '}
              {new Date(lastUpdatedIso).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
          </p>
        </div>

        {/* ── Section 2 : CTA double intent-match ───────────────────── */}
        <section
          aria-label="Actions principales"
          className="mb-12 grid sm:grid-cols-2 gap-3 max-w-3xl"
        >
          <Card className="p-5 flex items-center justify-between gap-3 hover:shadow-glass transition-shadow">
            <div className="min-w-0">
              <p className="font-semibold text-ink text-sm">Demander 3 devis gratuits</p>
              <p className="text-xs text-ink-mute">Comparer les diagnostiqueurs locaux</p>
            </div>
            <Button asChild size="sm">
              <Link href={`/devis-diagnostic?ville=${encodeURIComponent(cityName)}`}>
                Demander
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </Card>
          <Card className="p-5 flex items-center justify-between gap-3 hover:shadow-glass transition-shadow">
            <div className="min-w-0">
              <p className="font-semibold text-ink text-sm">Estimer mon DPE</p>
              <p className="text-xs text-ink-mute">Simulation gratuite en 2 minutes</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/calculateur-dpe-gratuit">
                Commencer
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </Card>
        </section>

        {/* ── Section 3 : Comment ça marche à {city} en 3 étapes ──── */}
        <section className="mb-12 space-y-4">
          <h2 className="font-sans font-bold text-2xl tracking-tight">
            Comment ça marche à {cityName}
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              {
                num: '01',
                title: 'Vous décrivez votre bien',
                desc: `Surface, type de bien et localisation à ${cityName}. 2 minutes maximum.`,
              },
              {
                num: '02',
                title: 'Vous recevez 3 devis',
                desc: `3 diagnostiqueurs certifiés intervenant à ${cityName} vous contactent sous 24h.`,
              },
              {
                num: '03',
                title: 'Vous choisissez',
                desc: 'Comparez prix, délais et avis. Le rapport est livré sous 5-7 jours.',
              },
            ].map((step) => (
              <Card key={step.num} className="p-5 space-y-2">
                <p className="font-mono text-2xl text-ink-mute">{step.num}</p>
                <p className="font-semibold text-ink text-base">{step.title}</p>
                <p className="text-sm text-ink-soft">{step.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* ── ÉLÉMENT UNIQUE 1 : Statistiques exclusives KOVAS ─────── */}
        {localData ? (
          <section
            aria-label={`Statistiques diagnostic immobilier ${cityName}`}
            className="mb-12 space-y-4"
          >
            <h2 className="font-sans font-bold text-2xl tracking-tight">
              Statistiques locales du diagnostic à {cityName}
            </h2>
            <p className="text-sm text-ink-mute max-w-3xl">
              Données agrégées par KOVAS depuis les bases publiques ADEME, INSEE et DVF sur les 12
              derniers mois. Si la commune dispose de moins de 50 transactions référencées, les
              chiffres locaux peuvent être pondérés par les données départementales.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint inline-flex items-center gap-1.5">
                  <Banknote className="size-3" aria-hidden />
                  Prix médian DPE
                </p>
                <p className="font-serif italic text-2xl text-ink mt-1">
                  {localData.medianDpePrice} €
                </p>
                <p className="text-[11px] text-ink-faint">
                  {localData.minDpePrice}-{localData.maxDpePrice} € TTC
                </p>
              </Card>
              <Card className="p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint inline-flex items-center gap-1.5">
                  <Flame className="size-3" aria-hidden />
                  Classe médiane
                </p>
                <p className="font-serif italic text-2xl text-ink mt-1">
                  {localData.medianEnergyClass}
                </p>
                <p className="text-[11px] text-ink-faint">étiquette locale</p>
              </Card>
              <Card className="p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  Passoires F+G
                </p>
                <p className="font-serif italic text-2xl text-ink mt-1">{localData.fgRatePct}%</p>
                <p className="text-[11px] text-ink-faint">du parc local</p>
              </Card>
              <Card className="p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  Délai rapport
                </p>
                <p className="font-serif italic text-2xl text-ink mt-1">
                  {localData.medianDeliveryDays}j
                </p>
                <p className="text-[11px] text-ink-faint">médiane locale</p>
              </Card>
            </div>
            {localData.source === 'real' ? (
              <div className="flex items-start gap-2 rounded-md border border-accent-green/30 bg-accent-green/5 px-3 py-2 text-xs text-ink-soft">
                <CheckCircle2 className="size-3.5 shrink-0 mt-0.5 text-accent-green" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p>
                    <span className="font-semibold text-ink">Sources vérifiées</span> : ADEME DPE v2
                    Open Data
                    {localData.totalDpeCount && localData.totalDpeCount > 0
                      ? ` (${localData.totalDpeCount.toLocaleString('fr-FR')} DPE 2021-2026)`
                      : ''}
                    {localData.sourcesUsed.some((s) => s.name.includes('INSEE'))
                      ? ' + INSEE Filocom'
                      : ''}
                    {localData.aiModel ? ` + contextualisation ${localData.aiModel}` : ''}.
                    {localData.lastRefreshedAt ? (
                      <>
                        {' '}
                        Données actualisées le{' '}
                        <time dateTime={localData.lastRefreshedAt}>
                          {new Date(localData.lastRefreshedAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </time>
                        .
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-rule bg-cream-deep/40 px-3 py-2 text-xs text-ink-mute">
                <Info className="size-3.5 shrink-0 mt-0.5 text-ink-mute" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p>
                    <span className="font-semibold text-ink-soft">Estimation</span> basée sur les
                    moyennes régionales ADEME et INSEE. Données détaillées en cours de mise à jour
                    dans notre observatoire.
                  </p>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {/* ── Marché local — paragraphe narratif Amandine Bart ──── */}
        {localData ? (
          <section aria-label="Synthèse marché diagnostic local" className="mb-12 space-y-4">
            <h2 className="font-sans font-bold text-2xl tracking-tight">
              Synthèse du marché diagnostic à {cityName}
            </h2>
            <div className="text-ink-soft leading-relaxed whitespace-pre-line text-base max-w-3xl">
              {buildLocalMarketParagraph(localData)}
            </div>
          </section>
        ) : null}

        {/* ── ÉLÉMENT UNIQUE 3 : Diagnostiqueurs locaux réels ──── */}
        <section className="space-y-4 mb-12">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h2 className="font-sans font-bold text-2xl tracking-tight">
              Diagnostiqueurs certifiés à {cityName}
            </h2>
            <p className="text-sm text-ink-mute">
              {diagnosticians.length > 0
                ? `${diagnosticians.length} diagnostiqueur${diagnosticians.length > 1 ? 's' : ''} ${widenedToDept ? `dans le ${deptName}` : `à ${cityName}`}`
                : 'Aucun diagnostiqueur référencé pour le moment'}
            </p>
          </div>

          {widenedToDept ? (
            <Card className="p-4 bg-accent-warm-soft border-accent-warm/30">
              <p className="text-sm text-ink-soft inline-flex items-start gap-2">
                <ShieldAlert className="size-4 text-accent-warm shrink-0 mt-0.5" aria-hidden />
                <span>
                  Aucun diagnostiqueur n'a actuellement de fiche publique à {cityName}. Voici les
                  diagnostiqueurs certifiés du {deptName} susceptibles d'intervenir dans cette
                  commune.
                </span>
              </p>
            </Card>
          ) : null}

          {diagnosticians.length === 0 ? (
            <Card className="p-8 text-center text-ink-mute space-y-3">
              <p>
                Aucun diagnostiqueur référencé pour le moment à {cityName}. KOVAS s'enrichit chaque
                semaine via la base DHUP officielle.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href={`/trouver-un-diagnostiqueur/${dept}`}>
                  Voir tous les diagnostiqueurs du {deptName}
                </Link>
              </Button>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {diagnosticians.map((d) => (
                <Link
                  key={d.id}
                  href={`/trouver-un-diagnostiqueur/${dept}/${city}/${d.slug}`}
                  className="block"
                >
                  <Card className="p-5 hover:shadow-glass transition-shadow h-full">
                    <h3 className="font-semibold text-ink text-base">{d.full_name}</h3>
                    {d.city ? <p className="text-xs text-ink-mute mt-0.5">{d.city}</p> : null}
                    {d.years_active ? (
                      <p className="text-xs text-ink-mute mt-0.5">
                        {d.years_active} ans d&apos;expérience
                      </p>
                    ) : null}
                    {d.address ? (
                      <p className="text-sm text-ink-soft mt-2 flex items-start gap-1.5">
                        <MapPin className="size-3.5 text-ink-mute mt-0.5 shrink-0" />
                        <span>{d.address}</span>
                      </p>
                    ) : null}
                    {d.phone ? (
                      <p className="text-sm text-ink-soft mt-1 flex items-center gap-1.5 font-mono">
                        <Phone className="size-3.5 text-ink-mute" />
                        {d.phone}
                      </p>
                    ) : null}
                    {d.gmb_rating ? (
                      <p className="text-xs text-ink-mute mt-2">
                        Note {d.gmb_rating.toFixed(1)}/5 ({d.gmb_review_count ?? 0} avis)
                      </p>
                    ) : null}
                    {(() => {
                      // Certifications stockées comme jsonb objet riche
                      // [{type:'DPE',status:'valid',...}] ou legacy string[].
                      const certs = Array.isArray(d.certifications) ? d.certifications : []
                      const codes = certs
                        .map((c: unknown) => {
                          if (typeof c === 'string') return c
                          if (c && typeof c === 'object' && 'type' in c) {
                            const t = (c as { type?: unknown }).type
                            return typeof t === 'string' ? t : null
                          }
                          return null
                        })
                        .filter((c): c is string => Boolean(c))
                      if (codes.length === 0) return null
                      return (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {codes.slice(0, 3).map((c) => (
                            <Badge key={c} variant="muted" className="text-[10px]">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      )
                    })()}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── ÉLÉMENT UNIQUE 2 : Contexte ville-spécifique 3-5 paragraphes ── */}
        {cityContext ? (
          <section
            aria-label={`Particularités du diagnostic à ${cityName}`}
            className="mb-12 space-y-4"
          >
            <h2 className="font-sans font-bold text-2xl tracking-tight">
              Particularités du diagnostic immobilier à {cityName}
            </h2>
            <p className="text-sm text-ink-mute max-w-3xl">{cityContext.intro}</p>
            {cityContext.riskFlags.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {cityContext.riskFlags.map((flag) => (
                  <Badge
                    key={flag}
                    variant="muted"
                    className="text-[11px] uppercase tracking-wider"
                  >
                    {flag}
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="grid md:grid-cols-2 gap-4 pt-2">
              {cityContext.paragraphs.map((p) => (
                <Card
                  key={p.heading}
                  className={
                    p.highlight
                      ? 'p-5 space-y-2 bg-accent-warm-soft border-accent-warm/40'
                      : 'p-5 space-y-2'
                  }
                >
                  <h3 className="font-sans font-bold text-base text-ink">{p.heading}</h3>
                  <p className="text-sm text-ink-soft leading-relaxed">{p.body}</p>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── FAQ 12 questions ville-spécifique ──────────────────── */}
        {faq.length > 0 ? (
          <section className="max-w-3xl space-y-4 mb-12">
            <h2 className="font-sans font-bold text-2xl tracking-tight">
              Questions fréquentes — Diagnostic à {cityName}
            </h2>
            <div className="space-y-3">
              {faq.map((q, idx) => (
                <Card key={`${q.question}-${idx}`} className="p-5">
                  <h3 className="font-semibold text-ink text-base mb-2">{q.question}</h3>
                  <FaqAnswer markdown={q.answer} />
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Tableau évolution prix DPE 2021-2026 ──────────────── */}
        {amandineContent ? (
          <section
            aria-label={`Évolution prix DPE médian ${cityName} 2021-2026`}
            className="mb-12 space-y-4"
          >
            <h2 className="font-sans font-bold text-2xl tracking-tight">
              Évolution du prix DPE médian à {cityName} (2021-2026)
            </h2>
            <p className="text-sm text-ink-mute max-w-3xl">
              Trajectoire du prix médian d'un DPE résidentiel à {cityName} sur 5 ans. Données
              indexées sur l'inflation et la complexification 3CL-2021.
            </p>
            <Card className="p-6">
              <div className="grid grid-cols-6 gap-2 items-end h-32 mb-4">
                {amandineContent.priceEvolution.map((p) => {
                  const maxPrice = Math.max(
                    ...amandineContent.priceEvolution.map((x) => x.priceEur),
                  )
                  const heightPct = Math.round((p.priceEur / maxPrice) * 100)
                  return (
                    <div key={p.year} className="flex flex-col items-center justify-end h-full">
                      <span className="font-mono text-[10px] text-ink mb-1 tabular-nums">
                        {p.priceEur}€
                      </span>
                      <div
                        className="w-full rounded-t bg-navy"
                        style={{ height: `${heightPct}%` }}
                        aria-hidden
                      />
                    </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-6 gap-2">
                {amandineContent.priceEvolution.map((p) => (
                  <div key={`label-${p.year}`} className="text-center">
                    <p className="font-mono text-[10px] text-ink-mute tabular-nums">{p.year}</p>
                    {p.variationPct !== null ? (
                      <p
                        className={`font-mono text-[9px] ${
                          p.variationPct >= 0 ? 'text-accent-green' : 'text-accent-red'
                        }`}
                      >
                        {p.variationPct >= 0 ? '+' : ''}
                        {p.variationPct}%
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="text-xs text-ink-faint mt-4">
                Source : agrégation INSEE + ADEME + observatoire KOVAS. Variations indicatives.
              </p>
            </Card>
          </section>
        ) : null}

        {/* ── Top 5 diagnostics demandés ─────────────────────────── */}
        {amandineContent ? (
          <section
            aria-label={`Top 5 diagnostics demandés à ${cityName}`}
            className="mb-12 space-y-4"
          >
            <h2 className="font-sans font-bold text-2xl tracking-tight">
              Top 5 diagnostics demandés à {cityName}
            </h2>
            <p className="text-sm text-ink-mute max-w-3xl">
              Répartition observée des diagnostics commandés à {cityName} sur les 12 derniers mois.
            </p>
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-cream-deep border-b border-rule">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-ink">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-ink">Diagnostic</th>
                    <th className="text-right px-4 py-3 font-semibold text-ink">Demande locale</th>
                    <th className="text-right px-4 py-3 font-semibold text-ink">
                      Tendance 12 mois
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {amandineContent.top5Diagnostics.map((d, idx) => (
                    <tr
                      key={d.type}
                      className="border-b border-rule last:border-b-0 hover:bg-cream-deep/40"
                    >
                      <td className="px-4 py-3 text-ink-mute font-mono text-xs">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-3 text-ink font-medium">{d.label}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink">{d.demandPct}%</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-xs ${
                            d.trendPct >= 0 ? 'text-accent-green' : 'text-accent-red'
                          }`}
                        >
                          {d.trendPct >= 0 ? (
                            <TrendingUp className="size-3" aria-hidden />
                          ) : (
                            <TrendingDown className="size-3" aria-hidden />
                          )}
                          {d.trendPct >= 0 ? '+' : ''}
                          {d.trendPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>
        ) : null}

        {/* ── Prix moyens ─────────────────────────────────────────── */}
        <section className="space-y-4 mb-12">
          <h2 className="font-sans font-bold text-2xl tracking-tight">
            Prix moyens diagnostic à {cityName}
          </h2>
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream-deep border-b border-rule">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-ink">Diagnostic</th>
                  <th className="text-right px-4 py-3 font-semibold text-ink">
                    Tarif indicatif (HT)
                  </th>
                </tr>
              </thead>
              <tbody>
                {DIAG_PRICE_TABLE.map((row) => (
                  <tr key={row.type} className="border-b border-rule last:border-b-0">
                    <td className="px-4 py-3 text-ink-soft">{row.type}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink">
                      {row.price_min} — {row.price_max} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="text-xs text-ink-faint">
            Fourchettes indicatives. Les tarifs varient selon la surface, le type de bien et le
            diagnostiqueur.
          </p>
        </section>

        {/* ── Internal linking : 8 diagnostics types × {city} ──── */}
        {registryCity ? (
          <section aria-label="Diagnostics disponibles" className="mb-12 space-y-4">
            <h2 className="font-sans font-bold text-2xl tracking-tight">
              Diagnostics disponibles à {cityName}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {DIAGNOSTIC_TYPES_FOR_INTERNAL_LINKS.map((d) => (
                <Link
                  key={d.type}
                  href={`/diagnostic/${d.type}/${registryCity.slug}`}
                  className="block"
                >
                  <Card className="p-4 hover:shadow-glass transition-shadow h-full">
                    <p className="font-semibold text-ink text-sm">{d.label}</p>
                    <p className="text-xs text-ink-mute mt-0.5">à {cityName}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Internal linking : villes voisines ─────────────────── */}
        {neighborLinks.length > 0 ? (
          <section aria-label="Diagnostics villes voisines" className="mb-12 space-y-4">
            <h2 className="font-sans font-bold text-2xl tracking-tight">
              Diagnostiqueurs dans les villes voisines
            </h2>
            <div className="flex flex-wrap gap-2">
              {neighborLinks.map((n) => (
                <Link
                  key={n.slug}
                  href={n.href}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-pill border border-rule text-sm text-ink-soft hover:border-ink hover:text-ink transition-colors"
                >
                  {n.name}
                  <span className="font-mono text-[11px] text-ink-faint">{n.postalCode}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Bloc auteur Benjamin Bel (E-E-A-T Core Update mai 2026) ── */}
        <section className="mb-12">
          <AuthorBio
            lastUpdatedIso={lastUpdatedIso}
            contextLabel={`le diagnostic immobilier à ${cityName}`}
          />
        </section>

        {/* ── CTA final dual ─────────────────────────────────────── */}
        <div className="mt-16 pt-8 border-t border-rule text-center space-y-4">
          <p className="text-sm text-ink-mute">Vous êtes diagnostiqueur à {cityName} ?</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button asChild>
              <Link href="/pros">Référencer mon cabinet</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/trouver-un-diagnostiqueur/${dept}`}>
                Voir tous les diagnostiqueurs du {deptName}
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
