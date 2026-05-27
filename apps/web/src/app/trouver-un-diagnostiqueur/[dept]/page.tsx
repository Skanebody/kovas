import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CITIES, type City } from '@/lib/cities/registry'
import { EXTRA_CITIES_TOP_5000, extraToCity } from '@/lib/cities/top-5000'
import { getDepartmentName } from '@/lib/fr-departments'
import { MapPin, Users } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Script from 'next/script'

/**
 * Page département `/trouver-un-diagnostiqueur/[dept]`.
 *
 * Refonte 2026-05-23 (root cause : la table `seo_geo_pages` n'a jamais été
 * peuplée en prod → notFound() systématique). On reconstruit la page à partir
 * de sources fiables et toujours disponibles :
 *   - `FR_DEPARTMENTS` (lib/fr-departments) — valide le code dept et fournit
 *     le nom officiel + région.
 *   - `CITIES` (registry premium 213 villes) + `EXTRA_CITIES_TOP_5000` —
 *     listent toutes les villes du dept avec population.
 *   - Table `diagnosticians` Supabase — compte de diagnostiqueurs actifs par
 *     dept et city pour les CTAs internal-linking.
 *
 * Si le code dept n'est pas un département FR valide (01-95 + DROM 971-976) →
 * 404 strict. Sinon la page rend toujours, avec au minimum la liste des
 * villes connues.
 *
 * Core Update mai 2026 (helpful content + E-E-A-T) : signature Benjamin Bel
 * en bas + sources transparentes + CTA inscription clair.
 */

type RouteParams = { dept: string }

function isValidDeptCode(code: string): boolean {
  if (!/^(\d{2,3})$/.test(code)) return false
  return Boolean(getDepartmentName(code))
}

function getCitiesOfDepartment(deptCode: string): City[] {
  const fromRegistry = CITIES.filter((c) => c.dept === deptCode)
  const fromExtra = EXTRA_CITIES_TOP_5000.filter((c) => c.dept === deptCode).map(extraToCity)
  const merged = [...fromRegistry, ...fromExtra]
  // Dédoublonnage par slug + tri population desc
  const seen = new Set<string>()
  const unique: City[] = []
  for (const c of merged) {
    if (seen.has(c.slug)) continue
    seen.add(c.slug)
    unique.push(c)
  }
  unique.sort((a, b) => b.population - a.population)
  return unique
}

async function countDiagnosticiansInDept(deptCode: string): Promise<number> {
  try {
    // Page publique : utiliser admin client (bypass RLS) pour éviter l'asymétrie
    // anon / authenticated qui masque les diagnostiqueurs aux users connectés.
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()
    // biome-ignore lint/suspicious/noExplicitAny: types Database à régénérer
    const client = supabase as any
    const { count } = await client
      .from('diagnosticians')
      .select('id', { count: 'exact', head: true })
      .or(`department_code.eq.${deptCode},dept_code.eq.${deptCode}`)
    return count ?? 0
  } catch {
    return 0
  }
}

async function getDiagCountByCity(deptCode: string): Promise<Map<string, number>> {
  try {
    // Page publique : utiliser admin client (bypass RLS) pour éviter l'asymétrie
    // anon / authenticated qui masque les diagnostiqueurs aux users connectés.
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()
    // biome-ignore lint/suspicious/noExplicitAny: types Database à régénérer
    const client = supabase as any
    const { data } = await client
      .from('diagnosticians')
      .select('city_slug')
      .or(`department_code.eq.${deptCode},dept_code.eq.${deptCode}`)
      .limit(2000)
    const counts = new Map<string, number>()
    for (const row of (data ?? []) as { city_slug: string | null }[]) {
      const slug = row.city_slug
      if (!slug) continue
      counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
    return counts
  } catch {
    return new Map()
  }
}

export async function generateMetadata({
  params,
}: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { dept } = await params
  if (!isValidDeptCode(dept)) {
    return { title: 'Département introuvable — KOVAS' }
  }
  const deptName = getDepartmentName(dept) ?? `Département ${dept}`
  return {
    title: `Trouver un diagnostiqueur immobilier en ${deptName} (${dept}) · KOVAS`,
    description: `Annuaire des diagnostiqueurs immobiliers certifiés du département ${dept} ${deptName}. DPE, amiante, plomb, gaz, électricité, termites, Carrez/Boutin, ERP.`,
    alternates: {
      canonical: `https://kovas.fr/trouver-un-diagnostiqueur/${dept}`,
    },
  }
}

export default async function DepartmentPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { dept } = await params

  if (!isValidDeptCode(dept)) {
    notFound()
  }

  const deptName = getDepartmentName(dept) ?? `Département ${dept}`
  const cities = getCitiesOfDepartment(dept)
  const [totalDiag, diagByCity] = await Promise.all([
    countDiagnosticiansInDept(dept),
    getDiagCountByCity(dept),
  ])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: deptName,
    address: {
      '@type': 'PostalAddress',
      addressRegion: deptName,
      addressCountry: 'FR',
    },
  }

  const topCities = cities.slice(0, 60)

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <Script
        id="seo-dept-jsonld"
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PublicHeader />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-8 lg:px-12 py-12">
        {/* Hero */}
        <div className="max-w-3xl mb-12 space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-mute">
            Département {dept}
          </p>
          <h1
            className="font-sans font-medium tracking-tight text-ink leading-[1.05]"
            style={{ fontSize: 'clamp(36px, 4.5vw, 56px)' }}
          >
            Diagnostiqueurs immobiliers en{' '}
            <span className="font-serif italic font-normal text-chartreuse-deep">{deptName}</span>.
          </h1>
          <p className="text-ink-mute text-lg leading-relaxed">
            Annuaire des professionnels certifiés du département {dept}. Comparez{' '}
            <strong className="text-ink">{totalDiag}</strong> diagnostiqueurs vérifiés répartis sur{' '}
            <strong className="text-ink">{cities.length}</strong> communes.
          </p>
        </div>

        {/* CTA recherche */}
        <Card
          variant="opaque"
          padding="default"
          className="mb-10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"
        >
          <p className="text-sm text-ink-mute">
            Vous cherchez un diagnostiqueur dans une ville précise ?
          </p>
          <Button asChild variant="accent">
            <Link href={`/trouver-un-diagnostiqueur?dept=${dept}`}>Rechercher dans le {dept}</Link>
          </Button>
        </Card>

        {/* Grid villes du département */}
        <section className="space-y-4 mb-16">
          <div className="flex items-baseline justify-between">
            <h2 className="font-sans font-semibold text-2xl tracking-tight">
              Villes couvertes ({cities.length})
            </h2>
            {cities.length > 60 && (
              <p className="text-xs text-ink-mute font-mono">Top 60 par population</p>
            )}
          </div>

          {topCities.length === 0 ? (
            <Card variant="opaque" padding="default" className="text-center">
              <p className="text-ink-mute">
                Aucune ville référencée pour ce département. Tu es diagnostiqueur ici ?{' '}
                <Link href="/signup" className="text-chartreuse-deep underline">
                  Référencer mon cabinet
                </Link>
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {topCities.map((c) => {
                const diagCount = diagByCity.get(c.slug) ?? 0
                return (
                  <Link
                    key={c.slug}
                    href={`/trouver-un-diagnostiqueur/${dept}/${c.slug}`}
                    className="block group"
                  >
                    <Card
                      variant="opaque"
                      padding="default"
                      className="h-full transition-shadow hover:shadow-glass-sm"
                    >
                      <div className="flex items-start gap-3">
                        <MapPin className="size-4 mt-1 text-ink-mute shrink-0" aria-hidden />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-ink truncate group-hover:text-chartreuse-deep transition-colors">
                            {c.name}
                          </p>
                          <p className="mt-1 text-xs text-ink-mute font-mono flex items-center gap-1.5">
                            <Users className="size-3" aria-hidden />
                            {c.population.toLocaleString('fr-FR')} hab.
                            {diagCount > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-ink">{diagCount} diag.</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Footer CTA */}
        <div className="border-t border-rule/60 pt-10 text-center space-y-4 max-w-3xl mx-auto">
          <Badge variant="muted" className="mx-auto">
            Pour les professionnels
          </Badge>
          <h3 className="font-sans font-semibold text-2xl tracking-tight">
            Tu exerces en {deptName} ?
          </h3>
          <p className="text-sm text-ink-mute">
            Référence gratuitement ton cabinet sur l&apos;annuaire KOVAS et reçois des demandes de
            devis qualifiées des particuliers de ta zone.
          </p>
          <Button asChild variant="accent" size="lg">
            <Link href="/signup">Référencer mon cabinet</Link>
          </Button>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
