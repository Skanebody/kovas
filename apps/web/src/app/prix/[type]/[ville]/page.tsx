import {
  ProgrammaticShell,
  SeoCtaBlock,
  SeoFaqSection,
  SeoHero,
  SeoInternalLinking,
  SeoSection,
} from '@/components/seo-prog/ProgrammaticShell'
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
  buildPriceSpecLD,
  buildServiceLD,
} from '@/lib/seo-content/jsonld-builders'
import { buildSeoMetadata } from '@/lib/seo-content/metadata-builder'
import { generateLocalContent } from '@/lib/seo-content/template-generator'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

/**
 * /prix/[type]/[ville] — page programmatique focus prix.
 * 9 × 213 villes = 1917 pages.
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
    title: `Prix d’un ${label} à ${city.name} (${city.postalCode}) — ${range.min} à ${range.max} €`,
    description: `Tarifs ${label} à ${city.name} : fourchette de ${range.min} à ${range.max} € TTC, prix médian ${range.median} €. Comparez les devis gratuits.`,
    path: `/prix/${type}/${city.slug}`,
  })
}

interface PriceRow {
  readonly bienType: string
  readonly surface: string
  readonly priceMin: number
  readonly priceMax: number
}

function buildPriceTable(type: DiagnosticType): ReadonlyArray<PriceRow> {
  const r = DIAGNOSTIC_PRICE_RANGES[type]
  return [
    {
      bienType: 'Studio / T1',
      surface: '< 30 m²',
      priceMin: Math.round(r.min * 0.85),
      priceMax: Math.round(r.median * 0.95),
    },
    {
      bienType: 'Appartement T2-T3',
      surface: '30 à 70 m²',
      priceMin: Math.round(r.min * 1.0),
      priceMax: Math.round(r.median * 1.1),
    },
    {
      bienType: 'Appartement T4+',
      surface: '70 à 110 m²',
      priceMin: Math.round(r.median * 1.0),
      priceMax: Math.round(r.max * 0.9),
    },
    {
      bienType: 'Maison',
      surface: '100 à 200 m²',
      priceMin: Math.round(r.median * 1.1),
      priceMax: r.max,
    },
    {
      bienType: 'Grande maison',
      surface: '> 200 m²',
      priceMin: Math.round(r.max * 0.9),
      priceMax: Math.round(r.max * 1.15),
    },
  ]
}

export default async function PrixDiagnosticVillePage({
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
  const range = DIAGNOSTIC_PRICE_RANGES[diagnosticType]
  const content = generateLocalContent(diagnosticType, city)
  const neighbors = getNeighborCities(city.slug)
  const otherTypes = DIAGNOSTIC_TYPES.filter((t) => t !== diagnosticType).slice(0, 8)
  const priceTable = buildPriceTable(diagnosticType)

  const breadcrumbs = [
    { label: 'Accueil', href: '/' },
    { label: 'Prix diagnostics', href: '/trouver-un-diagnostiqueur' },
    { label: `Prix ${label}`, href: `/prix/${diagnosticType}/${city.slug}` },
    { label: city.name, href: `/prix/${diagnosticType}/${city.slug}` },
  ]

  const jsonLd: ReadonlyArray<Record<string, unknown>> = [
    buildPriceSpecLD(diagnosticType, city),
    buildServiceLD(diagnosticType, city, '/prix'),
    buildBreadcrumbLD(
      breadcrumbs.map((c) => ({ name: c.label, url: `https://kovas.fr${c.href}` })),
    ),
    buildFaqLD(content.faq),
  ]

  return (
    <ProgrammaticShell city={city} breadcrumbs={breadcrumbs} jsonLd={jsonLd}>
      <SeoHero
        eyebrow={`Tarifs · ${city.region.split('-').join(' ')} · ${city.postalCode}`}
        titlePrefix={`Prix d’un ${label}`}
        titleEm={`à ${city.name}`}
        lede={`Combien coûte un ${longLabel.toLowerCase()} à ${city.name} ? Fourchette de prix observée, comparatif par type de bien et facteurs de variation. Données 2026.`}
      />

      <section className="mb-12 max-w-3xl">
        <Card className="p-8 text-center">
          <p className="text-xs uppercase tracking-wider text-ink-mute font-mono">
            Prix médian à {city.name}
          </p>
          <p className="font-serif italic text-6xl md:text-7xl text-chartreuse-deep mt-3">
            {range.median} €
          </p>
          <p className="text-ink-mute mt-3">
            Fourchette {range.min} – {range.max} € TTC pour un {label} standard
          </p>
        </Card>
      </section>

      <SeoSection title={`Tarifs détaillés par type de bien à ${city.name}`}>
        <p>{content.priceContext}</p>
        <Card className="p-0 overflow-hidden mt-4">
          <table className="w-full text-sm">
            <thead className="bg-cream-deep border-b border-rule">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-ink">Type de bien</th>
                <th className="text-left px-4 py-3 font-semibold text-ink">Surface</th>
                <th className="text-right px-4 py-3 font-semibold text-ink">Tarif {label} (TTC)</th>
              </tr>
            </thead>
            <tbody>
              {priceTable.map((row) => (
                <tr key={row.bienType} className="border-b border-rule last:border-b-0">
                  <td className="px-4 py-3 text-ink-soft">{row.bienType}</td>
                  <td className="px-4 py-3 text-ink-mute text-xs">{row.surface}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink">
                    {row.priceMin} – {row.priceMax} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </SeoSection>

      <SeoSection title="Facteurs qui font varier le prix">
        <ul className="space-y-2 list-disc pl-5">
          <li>
            <strong className="font-semibold text-ink">Surface du bien</strong> : la surface est le
            premier critère de tarification. Le diagnostic d’un studio coûte moins cher que celui
            d’une grande maison.
          </li>
          <li>
            <strong className="font-semibold text-ink">Complexité</strong> : nombre de pièces,
            accessibilité des combles, équipements multiples augmentent le temps d’intervention.
          </li>
          <li>
            <strong className="font-semibold text-ink">Urgence</strong> : une intervention sous 48h
            peut générer un surcoût de 15-30 % selon les diagnostiqueurs à {city.name}.
          </li>
          <li>
            <strong className="font-semibold text-ink">Distance</strong> : certains diagnostiqueurs
            facturent un déplacement si votre bien est éloigné de leur secteur habituel.
          </li>
          <li>
            <strong className="font-semibold text-ink">Pack groupé</strong> : commander plusieurs
            diagnostics ensemble permet généralement d’économiser 15-25 % par rapport aux tarifs
            unitaires.
          </li>
        </ul>
      </SeoSection>

      <SeoCtaBlock
        title={`Recevez 3 devis ${label} à ${city.name}`}
        description="Comparez les tarifs et délais de diagnostiqueurs certifiés en moins de 24 heures. Sans engagement."
        primary={{
          label: 'Demander 3 devis gratuits',
          href: `/contact?type=${diagnosticType}&ville=${city.slug}&source=prix`,
        }}
        secondary={{
          label: `Voir les diagnostiqueurs à ${city.name}`,
          href: `/trouver-un-diagnostiqueur/${city.dept}/${city.slug}`,
        }}
      />

      <SeoFaqSection faq={content.faq} />

      <SeoInternalLinking
        city={city}
        type={diagnosticType}
        otherTypes={otherTypes}
        neighborCities={neighbors}
        basePath="/prix"
      />

      <div className="mt-12 pt-8 border-t border-rule text-sm text-ink-mute text-center space-y-3">
        <p className="text-xs text-ink-faint">
          <Link
            href={`/diagnostic/${diagnosticType}/${city.slug}`}
            className="hover:underline underline-offset-4"
          >
            En savoir plus sur le {label} à {city.name}
          </Link>
        </p>
      </div>
    </ProgrammaticShell>
  )
}
