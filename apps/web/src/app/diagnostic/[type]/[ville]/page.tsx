import {
  ProgrammaticShell,
  SeoCtaBlock,
  SeoFaqSection,
  SeoHero,
  SeoInternalLinking,
  SeoSection,
} from '@/components/seo-prog/ProgrammaticShell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { CITIES, getCityBySlug, getNeighborCities } from '@/lib/cities/registry'
import {
  DIAGNOSTIC_LABELS,
  DIAGNOSTIC_LONG_LABELS,
  DIAGNOSTIC_PRICE_RANGES,
  DIAGNOSTIC_TYPES,
  type DiagnosticType,
  isDiagnosticType,
} from '@/lib/diagnostics/types'
import {
  buildBreadcrumbLD,
  buildFaqLD,
  buildLocalBusinessListLD,
  buildMockDiagnosticians,
  buildServiceLD,
} from '@/lib/seo-content/jsonld-builders'
import { buildSeoMetadata } from '@/lib/seo-content/metadata-builder'
import { generateLocalContent } from '@/lib/seo-content/template-generator'
import { MapPin, Star } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

/**
 * /diagnostic/[type]/[ville] — page programmatique SEO long-form.
 *
 * Pattern : 9 diagnostics × 213 villes = 1917 pages indexables.
 */

export const dynamic = 'force-static'
export const revalidate = 86400

interface RouteParams {
  type: string
  ville: string
}

export function generateStaticParams(): ReadonlyArray<RouteParams> {
  const out: RouteParams[] = []
  for (const type of DIAGNOSTIC_TYPES) {
    for (const city of CITIES) {
      out.push({ type, ville: city.slug })
    }
  }
  return out
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}): Promise<Metadata> {
  const { type, ville } = await params
  if (!isDiagnosticType(type)) return { title: 'Page introuvable — KOVAS' }
  const city = getCityBySlug(ville)
  if (!city) return { title: 'Page introuvable — KOVAS' }

  const label = DIAGNOSTIC_LABELS[type]
  const range = DIAGNOSTIC_PRICE_RANGES[type]

  return buildSeoMetadata({
    title: `${label} à ${city.name} (${city.postalCode}) — Prix, démarches, diagnostiqueurs`,
    description: `${label} à ${city.name} : tarifs ${range.min}-${range.max} €, durée de validité, obligations légales et diagnostiqueurs certifiés. Devis gratuit.`,
    path: `/diagnostic/${type}/${city.slug}`,
  })
}

export default async function DiagnosticVillePage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { type, ville } = await params
  if (!isDiagnosticType(type)) notFound()
  const city = getCityBySlug(ville)
  if (!city) notFound()

  const diagnosticType: DiagnosticType = type
  const label = DIAGNOSTIC_LABELS[diagnosticType]
  const longLabel = DIAGNOSTIC_LONG_LABELS[diagnosticType]
  const content = generateLocalContent(diagnosticType, city)
  const neighbors = getNeighborCities(city.slug)
  const otherTypes = DIAGNOSTIC_TYPES.filter((t) => t !== diagnosticType).slice(0, 8)
  const mockDiags = buildMockDiagnosticians(city, 5)

  const breadcrumbs = [
    { label: 'Accueil', href: '/' },
    { label: 'Diagnostics', href: '/trouver-un-diagnostiqueur' },
    { label: label, href: `/diagnostic/${diagnosticType}/${city.slug}` },
    { label: city.name, href: `/diagnostic/${diagnosticType}/${city.slug}` },
  ]

  const jsonLd: ReadonlyArray<Record<string, unknown>> = [
    buildServiceLD(diagnosticType, city, '/diagnostic'),
    buildBreadcrumbLD(
      breadcrumbs.map((c) => ({ name: c.label, url: `https://kovas.fr${c.href}` })),
    ),
    buildFaqLD(content.faq),
    buildLocalBusinessListLD(mockDiags, city),
  ]

  return (
    <ProgrammaticShell city={city} breadcrumbs={breadcrumbs} jsonLd={jsonLd}>
      <SeoHero
        eyebrow={`${city.region.split('-').join(' ')} · Dépt ${city.dept} · ${city.postalCode}`}
        titlePrefix={label}
        titleEm={`à ${city.name}`}
        lede={content.intro}
      />

      <SeoSection title={`Pourquoi faire un ${label} à ${city.name}`}>
        <p>{content.whyHere}</p>
      </SeoSection>

      <SeoSection title={`Combien coûte un ${label} à ${city.name}`}>
        <p>{content.priceContext}</p>
        <Card className="p-6 mt-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-mute font-mono">Minimum</p>
              <p className="font-mono text-2xl font-semibold text-ink mt-1">
                {DIAGNOSTIC_PRICE_RANGES[diagnosticType].min} €
              </p>
            </div>
            <div className="border-x border-rule">
              <p className="text-xs uppercase tracking-wider text-ink-mute font-mono">Médiane</p>
              <p className="font-serif italic text-3xl text-chartreuse-deep mt-1">
                {DIAGNOSTIC_PRICE_RANGES[diagnosticType].median} €
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-mute font-mono">Maximum</p>
              <p className="font-mono text-2xl font-semibold text-ink mt-1">
                {DIAGNOSTIC_PRICE_RANGES[diagnosticType].max} €
              </p>
            </div>
          </div>
          <p className="text-xs text-ink-faint mt-4 text-center">
            Tarifs TTC indicatifs constatés à {city.name} et alentours.
          </p>
        </Card>
      </SeoSection>

      <SeoSection title={`Diagnostiqueurs ${label} certifiés à ${city.name}`}>
        <p className="mb-4">
          KOVAS référence les diagnostiqueurs certifiés exerçant à {city.name} ({city.postalCode}).
          Voici une sélection de professionnels disponibles dans votre commune.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockDiags.slice(0, 3).map((d) => (
            <Card key={d.id} className="p-5">
              <h3 className="font-semibold text-ink text-base">{d.displayName}</h3>
              <p className="text-sm text-ink-soft mt-2 flex items-start gap-1.5">
                <MapPin className="size-3.5 text-ink-mute mt-0.5 shrink-0" aria-hidden />
                <span>{d.streetAddress}</span>
              </p>
              {d.ratingAvg !== undefined ? (
                <p className="text-xs text-ink-mute mt-3 flex items-center gap-1.5">
                  <Star className="size-3.5 text-chartreuse-deep fill-chartreuse" aria-hidden />
                  {d.ratingAvg.toFixed(1)}/5 · {d.ratingCount} avis
                </p>
              ) : null}
            </Card>
          ))}
        </div>
        <p className="text-sm text-ink-mute mt-5">
          <Link
            href={`/trouver-un-diagnostiqueur/${city.dept}/${city.slug}`}
            className="text-ink hover:underline underline-offset-4 font-medium"
          >
            Voir tous les diagnostiqueurs à {city.name} →
          </Link>
        </p>
      </SeoSection>

      <SeoSection title={`Quand faire un ${label}`}>
        <p>{content.legalContext}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="muted">Vente</Badge>
          <Badge variant="muted">Location</Badge>
          <Badge variant="muted">Copropriété</Badge>
        </div>
      </SeoSection>

      <SeoCtaBlock
        title={`Demander un devis ${label} à ${city.name}`}
        description={`Recevez jusqu’à 3 devis gratuits de diagnostiqueurs certifiés à ${city.name} en moins de 24 heures.`}
        primary={{
          label: 'Demander un devis gratuit',
          href: `/contact?type=${diagnosticType}&ville=${city.slug}`,
        }}
        secondary={
          diagnosticType === 'dpe'
            ? {
                label: 'Estimer mon DPE en 2 minutes',
                href: '/calculateur-dpe-gratuit',
              }
            : undefined
        }
      />

      <SeoFaqSection faq={content.faq} />

      <SeoInternalLinking
        city={city}
        type={diagnosticType}
        otherTypes={otherTypes}
        neighborCities={neighbors}
        basePath="/diagnostic"
      />

      <div className="mt-12 pt-8 border-t border-rule text-sm text-ink-mute text-center">
        <p>
          Vous êtes diagnostiqueur certifié à {city.name} ?{' '}
          <Link
            href="/pour-les-diagnostiqueurs"
            className="text-ink hover:underline underline-offset-4 font-medium"
          >
            Référencer votre cabinet sur KOVAS
          </Link>
          .
        </p>
        <p className="mt-3 text-xs text-ink-faint">
          Information : pour la prestation {longLabel.toLowerCase()}, vérifiez toujours la
          certification COFRAC du diagnostiqueur avant signature.
        </p>
      </div>
    </ProgrammaticShell>
  )
}
