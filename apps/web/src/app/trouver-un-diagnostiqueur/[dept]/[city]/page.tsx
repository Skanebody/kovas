import { FaqAnswer } from '@/components/faq-answer'
import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CITIES, getCityBySlug } from '@/lib/cities/registry'
import {
  DIAGNOSTIC_TYPES_INTERNAL_LINKS,
  buildCityContentAmandine,
} from '@/lib/seo-content/city-content-amandine'
import {
  buildEnrichedFaq,
  buildLocalMarketParagraph,
  buildNeighborLinks,
  getCityLocalData,
} from '@/lib/seo-content/local-data'
import { createClient } from '@/lib/supabase/server'
import {
  Banknote,
  CalendarClock,
  ChevronRight,
  Flame,
  MapPin,
  Phone,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Script from 'next/script'

// Lookup table villes (registry) pour internal linking voisins
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

/**
 * KOVAS — Page ville SEO (Mission C1)
 * Route : /trouver-un-diagnostiqueur/[dept]/[city]
 * Charge seo_geo_pages.slug = <city> + page_type = 'city'.
 * Distincte de /[dept]/[city]/[slug] (fiche diag, scope A2).
 */

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
  slug_full: string
  display_name: string
  company_name: string | null
  address_line: string | null
  phone_e164: string | null
  rating_avg: number | null
  reviews_count: number | null
  certifications: string[] | null
}

async function loadCityPage(citySlug: string): Promise<SeoGeoPageRow | null> {
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
}

async function loadDiagnosticiansForCity(
  citySlug: string,
  limit = 12,
): Promise<DiagnosticianCard[]> {
  const supabase = await createClient()
  // biome-ignore lint/suspicious/noExplicitAny: diagnosticians créée par mission A1, cast as any cohabitation
  const { data, error } = await (supabase as any)
    .from('diagnosticians')
    .select(
      'id, slug_full, display_name, company_name, address_line, phone_e164, rating_avg, reviews_count, certifications',
    )
    .eq('slug_city', citySlug)
    .eq('is_published', true)
    .order('rating_avg', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error || !data) return []
  return data as DiagnosticianCard[]
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

export async function generateMetadata({
  params,
}: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { dept, city } = await params
  const page = await loadCityPage(city)
  if (!page) {
    return { title: 'Ville introuvable — KOVAS' }
  }
  return {
    title: page.meta_title,
    description: page.meta_description,
    alternates: {
      canonical: page.canonical_url ?? `https://kovas.fr/trouver-un-diagnostiqueur/${dept}/${city}`,
    },
  }
}

function buildFaqJsonLd(faq: FaqItem[]) {
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

function buildCityJsonLd(page: SeoGeoPageRow, diags: DiagnosticianCard[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Diagnostiqueurs immobiliers à ${page.city_name ?? page.slug}`,
    numberOfItems: diags.length,
    itemListElement: diags.map((d, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'LocalBusiness',
        name: d.display_name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: d.address_line ?? undefined,
          addressLocality: page.city_name ?? undefined,
          addressRegion: page.region_name ?? undefined,
          addressCountry: 'FR',
        },
        telephone: d.phone_e164 ?? undefined,
        aggregateRating: d.rating_avg
          ? {
              '@type': 'AggregateRating',
              ratingValue: d.rating_avg,
              reviewCount: d.reviews_count ?? 0,
            }
          : undefined,
      },
    })),
  }
}

export default async function CityPage({ params }: { params: Promise<RouteParams> }) {
  const { dept, city } = await params
  const page = await loadCityPage(city)
  if (!page) {
    notFound()
  }

  const diagnosticians = await loadDiagnosticiansForCity(page.city_slug ?? page.slug, 12)

  // Données locales (méthode Amandine Bart) — déterministes par ville
  const registryCity = getCityBySlug(page.city_slug ?? page.slug)
  const localData = registryCity ? getCityLocalData(registryCity) : null
  const neighborLinks = registryCity ? buildNeighborLinks(registryCity, CITY_LOOKUP) : []

  // Contenu Amandine Bart complet (top5 diags, évolution prix, spécificités, FAQ 12 questions)
  const amandineContent = registryCity ? buildCityContentAmandine(registryCity) : null

  // FAQ : préférer celle en base si présente, sinon FAQ enrichie Amandine Bart 12 questions
  const baseFaq: FaqItem[] = Array.isArray(page.faq_items) ? page.faq_items : []
  const faq: FaqItem[] =
    baseFaq.length > 0
      ? baseFaq
      : amandineContent
        ? amandineContent.faq.map((q) => ({
            question: q.question,
            answer: q.answer,
          }))
        : localData
          ? buildEnrichedFaq(localData).map((q) => ({
              question: q.question,
              answer: q.answer,
            }))
          : []

  const cityJsonLd =
    page.schema_jsonld && typeof page.schema_jsonld === 'object'
      ? page.schema_jsonld
      : buildCityJsonLd(page, diagnosticians)

  return (
    <div className="min-h-dvh flex flex-col bg-cream">
      <Script
        id="seo-city-jsonld"
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cityJsonLd) }}
      />
      {faq.length > 0 ? (
        <Script
          id="seo-city-faq-jsonld"
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faq)) }}
        />
      ) : null}

      <PublicHeader />

      <main className="flex-1 mx-auto max-w-6xl px-6 py-12 w-full">
        <div className="max-w-3xl mb-10 space-y-3">
          <p className="text-xs uppercase tracking-wider font-semibold text-ink-mute font-mono">
            {page.department_name ?? `Dépt ${page.department_code}`} · {page.region_name ?? '—'}
            {page.population ? ` · ${page.population.toLocaleString('fr-FR')} habitants` : ''}
          </p>
          <h1 className="font-sans font-bold text-4xl md:text-5xl tracking-tight text-ink">
            {page.h1_title}
          </h1>
          {page.intro_content ? (
            <p className="text-ink-mute text-lg leading-relaxed whitespace-pre-line">
              {page.intro_content}
            </p>
          ) : null}
          {localData ? (
            <p className="text-xs text-ink-faint font-mono inline-flex items-center gap-1.5 pt-2">
              <CalendarClock className="size-3" aria-hidden />
              <time dateTime={localData.lastUpdatedIso}>
                Mise à jour :{' '}
                {new Date(localData.lastUpdatedIso).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </time>
            </p>
          ) : null}
        </div>

        {/* CTA double intent-match Amandine Bart */}
        <section
          aria-label="Actions principales"
          className="mb-10 grid sm:grid-cols-2 gap-3 max-w-3xl"
        >
          <Card className="p-5 flex items-center justify-between gap-3 hover:shadow-glass transition-shadow">
            <div className="min-w-0">
              <p className="font-semibold text-ink text-sm">Estimer mon DPE</p>
              <p className="text-xs text-ink-mute">Simulation gratuite en 2 minutes</p>
            </div>
            <Button asChild size="sm">
              <Link href="/estimer-dpe">
                Commencer
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </Card>
          <Card className="p-5 flex items-center justify-between gap-3 hover:shadow-glass transition-shadow">
            <div className="min-w-0">
              <p className="font-semibold text-ink text-sm">Demander des devis</p>
              <p className="text-xs text-ink-mute">Comparer 3 diagnostiqueurs locaux</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/devis-diagnostic?ville=${encodeURIComponent(page.city_name ?? page.slug)}`}
              >
                Demander
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </Card>
        </section>

        {/* Section data locale Amandine Bart */}
        {localData ? (
          <section aria-label="Marché local du diagnostic" className="mb-12 space-y-4">
            <h2 className="font-sans font-bold text-2xl tracking-tight">
              Marché local du diagnostic à {page.city_name ?? page.slug}
            </h2>
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
                  Classe énergétique
                </p>
                <p className="font-serif italic text-2xl text-ink mt-1">
                  {localData.medianEnergyClass}
                </p>
                <p className="text-[11px] text-ink-faint">médiane locale</p>
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
                  DPE / an
                </p>
                <p className="font-serif italic text-2xl text-ink mt-1">
                  {localData.estimatedDpePerYear.toLocaleString('fr-FR')}
                </p>
                <p className="text-[11px] text-ink-faint">estimés</p>
              </Card>
            </div>
            <div className="max-w-3xl pt-2">
              <div className="text-ink-soft leading-relaxed whitespace-pre-line text-base">
                {buildLocalMarketParagraph(localData)}
              </div>
            </div>
          </section>
        ) : null}

        {/* Section Top 5 diagnostics demandés (Amandine Bart) */}
        {amandineContent ? (
          <section
            aria-label={`Top 5 diagnostics demandés à ${page.city_name ?? page.slug}`}
            className="mb-12 space-y-4"
          >
            <h2 className="font-sans font-bold text-2xl tracking-tight">
              Top 5 diagnostics demandés à {page.city_name ?? page.slug}
            </h2>
            <p className="text-sm text-ink-mute max-w-3xl">
              Répartition observée des diagnostics commandés à {page.city_name ?? page.slug} sur les
              12 derniers mois. Tendances annuelles indiquées vs 2024.
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

        {/* Section Évolution prix DPE médian 2021-2026 (mini-chart 5 points) */}
        {amandineContent ? (
          <section
            aria-label={`Évolution prix DPE médian ${page.city_name ?? page.slug} 2021-2026`}
            className="mb-12 space-y-4"
          >
            <h2 className="font-sans font-bold text-2xl tracking-tight">
              Évolution du prix DPE médian à {page.city_name ?? page.slug} (2021-2026)
            </h2>
            <p className="text-sm text-ink-mute max-w-3xl">
              Trajectoire du prix médian d'un DPE résidentiel à {page.city_name ?? page.slug} sur 5
              ans. Données indexées sur l'inflation et la complexification 3CL-2021.
            </p>
            <Card className="p-6">
              {/* Mini-chart SVG sobre — 5 points reliés */}
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
              {/* Labels années sous le graphique */}
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
                Source : agrégation INSEE + ADEME + observatoire KOVAS. Variations indicatives, prix
                réel selon surface et complexité du bien.
              </p>
            </Card>
          </section>
        ) : null}

        {/* Section Spécificités locales (3-5 paragraphes variant selon dept) */}
        {amandineContent && amandineContent.specificities.length > 0 ? (
          <section
            aria-label={`Spécificités locales du diagnostic à ${page.city_name ?? page.slug}`}
            className="mb-12 space-y-4"
          >
            <h2 className="font-sans font-bold text-2xl tracking-tight">
              Spécificités du diagnostic immobilier à {page.city_name ?? page.slug}
            </h2>
            <p className="text-sm text-ink-mute max-w-3xl">
              Le marché du diagnostic à {page.city_name ?? page.slug} présente des caractéristiques
              propres à son département ({page.department_name ?? page.department_code}) et à son
              parc immobilier. Voici les points de vigilance majeurs.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {amandineContent.specificities.map((spec) => (
                <Card key={spec.title} className="p-5 space-y-3">
                  <h3 className="font-sans font-bold text-base text-ink">{spec.title}</h3>
                  <p className="text-sm text-ink-soft leading-relaxed">{spec.body}</p>
                  {spec.relatedDiags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {spec.relatedDiags.map((diag) => (
                        <Badge key={diag} variant="muted" className="text-[10px] uppercase">
                          {diag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {/* Liste 12 diag ville */}
        <section className="space-y-4 mb-12">
          <div className="flex items-baseline justify-between">
            <h2 className="font-sans font-bold text-2xl tracking-tight">
              {page.diagnosticians_count} diagnostiqueur
              {page.diagnosticians_count > 1 ? 's' : ''} à {page.city_name ?? page.slug}
            </h2>
            {page.diagnosticians_count > 12 ? (
              <Link
                href={`/trouver-un-diagnostiqueur/${dept}/${city}/tous`}
                className="text-sm text-navy hover:underline underline-offset-4"
              >
                Voir tous &rarr;
              </Link>
            ) : null}
          </div>

          {diagnosticians.length === 0 ? (
            <Card className="p-8 text-center text-ink-mute">
              Aucun diagnostiqueur référencé pour le moment dans cette ville. KOVAS s'enrichit
              chaque semaine.
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {diagnosticians.map((d) => (
                <Link
                  key={d.id}
                  href={`/trouver-un-diagnostiqueur/${dept}/${city}/${d.slug_full}`}
                  className="block"
                >
                  <Card className="p-5 hover:shadow-glass transition-shadow h-full">
                    <h3 className="font-semibold text-ink text-base">{d.display_name}</h3>
                    {d.company_name ? (
                      <p className="text-xs text-ink-mute mt-0.5">{d.company_name}</p>
                    ) : null}
                    {d.address_line ? (
                      <p className="text-sm text-ink-soft mt-2 flex items-start gap-1.5">
                        <MapPin className="size-3.5 text-ink-mute mt-0.5 shrink-0" />
                        <span>{d.address_line}</span>
                      </p>
                    ) : null}
                    {d.phone_e164 ? (
                      <p className="text-sm text-ink-soft mt-1 flex items-center gap-1.5 font-mono">
                        <Phone className="size-3.5 text-ink-mute" />
                        {d.phone_e164}
                      </p>
                    ) : null}
                    {d.rating_avg ? (
                      <p className="text-xs text-ink-mute mt-2">
                        Note {d.rating_avg.toFixed(1)}/5 ({d.reviews_count ?? 0} avis)
                      </p>
                    ) : null}
                    {d.certifications && d.certifications.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {d.certifications.slice(0, 3).map((c) => (
                          <Badge key={c} variant="muted" className="text-[10px]">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Section long-form */}
        {page.long_form_content ? (
          <section className="max-w-3xl space-y-4 mb-12">
            <h2 className="font-sans font-bold text-2xl tracking-tight">
              Pourquoi faire appel à un diagnostiqueur à {page.city_name ?? page.slug}
            </h2>
            <div className="text-ink-soft leading-relaxed whitespace-pre-line">
              {page.long_form_content}
            </div>
          </section>
        ) : null}

        {/* Tableau prix moyens */}
        <section className="space-y-4 mb-12">
          <h2 className="font-sans font-bold text-2xl tracking-tight">
            Prix moyens diagnostic à {page.city_name ?? page.slug}
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
            diagnostiqueur.{' '}
            {page.avg_price_per_m2 ? (
              <span>
                Prix moyen au m² à {page.city_name} :{' '}
                <strong className="font-mono">
                  {page.avg_price_per_m2.toLocaleString('fr-FR')} €
                </strong>{' '}
                (source DVF).
              </span>
            ) : null}
          </p>
        </section>

        {/* FAQ 5 questions */}
        {faq.length > 0 ? (
          <section className="max-w-3xl space-y-4 mb-12">
            <h2 className="font-sans font-bold text-2xl tracking-tight">Questions fréquentes</h2>
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

        {/* Internal linking — diagnostics dans la même ville */}
        {registryCity ? (
          <section aria-label="Diagnostics à la même adresse" className="mb-12 space-y-4">
            <h2 className="font-sans font-bold text-2xl tracking-tight">
              Diagnostics disponibles à {page.city_name ?? page.slug}
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
                    <p className="text-xs text-ink-mute mt-0.5">à {page.city_name ?? page.slug}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* Internal linking — villes voisines (rayon ~30km) */}
        {neighborLinks.length > 0 ? (
          <section aria-label="Diagnostics dans les villes voisines" className="mb-12 space-y-4">
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

        <div className="mt-16 pt-8 border-t border-rule text-center space-y-4">
          <p className="text-sm text-ink-mute">
            Vous êtes diagnostiqueur à {page.city_name ?? page.slug} ?
          </p>
          <Button asChild>
            <Link href="/signup">Référencer mon cabinet</Link>
          </Button>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
