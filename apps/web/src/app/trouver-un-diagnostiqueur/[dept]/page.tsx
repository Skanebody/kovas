import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { MapPin } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Script from 'next/script'

/**
 * KOVAS — Page département SEO (Mission C1)
 * Route : /trouver-un-diagnostiqueur/[dept]
 * Charge seo_geo_pages.slug = <dept> + page_type = 'department'.
 * 404 si pas trouvée.
 */

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
  faq_items: unknown
  diagnosticians_count: number
  population: number | null
  schema_jsonld: unknown
  priority_rank: number
}

type CityCard = {
  slug: string
  city_slug: string | null
  city_name: string | null
  diagnosticians_count: number
}

async function loadDepartmentPage(deptSlug: string): Promise<SeoGeoPageRow | null> {
  const supabase = await createClient()
  // biome-ignore lint/suspicious/noExplicitAny: table seo_geo_pages pas encore dans Database types
  const { data, error } = await (supabase as any)
    .from('seo_geo_pages')
    .select('*')
    .eq('slug', deptSlug)
    .eq('page_type', 'department')
    .maybeSingle()

  if (error || !data) return null
  return data as SeoGeoPageRow
}

async function loadCitiesOfDepartment(deptCode: string): Promise<CityCard[]> {
  const supabase = await createClient()
  // biome-ignore lint/suspicious/noExplicitAny: cohabitation table SEO + diagnosticians
  const { data, error } = await (supabase as any)
    .from('seo_geo_pages')
    .select('slug, city_slug, city_name, diagnosticians_count')
    .eq('department_code', deptCode)
    .eq('page_type', 'city')
    .order('priority_rank', { ascending: true })
    .limit(60)

  if (error || !data) return []
  return data as CityCard[]
}

type RouteParams = { dept: string }

export async function generateMetadata({
  params,
}: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { dept } = await params
  const page = await loadDepartmentPage(dept)
  if (!page) {
    return { title: 'Département introuvable — KOVAS' }
  }
  return {
    title: page.meta_title,
    description: page.meta_description,
    alternates: {
      canonical: page.canonical_url ?? `https://kovas.fr/trouver-un-diagnostiqueur/${dept}`,
    },
  }
}

export default async function DepartmentPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { dept } = await params
  const page = await loadDepartmentPage(dept)
  if (!page) {
    notFound()
  }

  const cities = await loadCitiesOfDepartment(page.department_code)

  // Schema.org Place JSON-LD (fallback si schema_jsonld absent en DB)
  const jsonLd =
    page.schema_jsonld && typeof page.schema_jsonld === 'object'
      ? page.schema_jsonld
      : {
          '@context': 'https://schema.org',
          '@type': 'Place',
          name: page.department_name ?? page.h1_title,
          address: {
            '@type': 'PostalAddress',
            addressRegion: page.region_name ?? undefined,
            addressCountry: 'FR',
          },
        }

  return (
    <div className="min-h-dvh flex flex-col bg-cream">
      <Script
        id="seo-dept-jsonld"
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PublicHeader />

      <main className="flex-1 mx-auto max-w-6xl px-6 py-12 w-full">
        <div className="max-w-3xl mb-10 space-y-3">
          <p className="text-xs uppercase tracking-wider font-semibold text-ink-mute font-mono">
            Département {page.department_code} · {page.region_name ?? '—'}
          </p>
          <h1 className="font-sans font-bold text-4xl md:text-5xl tracking-tight text-ink">
            {page.h1_title}
          </h1>
          {page.intro_content ? (
            <p className="text-ink-mute text-lg leading-relaxed whitespace-pre-line">
              {page.intro_content}
            </p>
          ) : null}
        </div>

        {/* Grid villes du département */}
        <section className="space-y-4 mb-12">
          <h2 className="font-sans font-bold text-2xl tracking-tight">
            Villes couvertes ({cities.length})
          </h2>
          {cities.length === 0 ? (
            <Card className="p-8 text-center text-ink-mute">
              Aucune ville référencée pour le moment dans ce département.
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {cities.map((c) => (
                <Link
                  key={c.slug}
                  href={`/trouver-un-diagnostiqueur/${dept}/${c.city_slug ?? c.slug}`}
                  className="block"
                >
                  <Card className="p-4 hover:shadow-glass transition-shadow">
                    <p className="font-semibold text-ink flex items-center gap-2">
                      <MapPin className="size-4 text-ink-mute" />
                      {c.city_name ?? c.slug}
                    </p>
                    <p className="mt-1 text-xs text-ink-mute font-mono">
                      {c.diagnosticians_count} diagnostiqueur
                      {c.diagnosticians_count > 1 ? 's' : ''}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Contenu long-form département */}
        {page.long_form_content ? (
          <section className="prose prose-ink max-w-3xl space-y-4">
            <h2 className="font-sans font-bold text-2xl tracking-tight mt-12">
              Le diagnostic immobilier dans {page.department_name ?? 'le département'}
            </h2>
            <div className="text-ink-soft leading-relaxed whitespace-pre-line">
              {page.long_form_content}
            </div>
          </section>
        ) : null}

        <div className="mt-16 pt-8 border-t border-rule text-center space-y-4">
          <p className="text-sm text-ink-mute">
            Vous êtes diagnostiqueur dans {page.department_name ?? 'ce département'} ?
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
