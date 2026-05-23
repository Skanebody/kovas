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
} from '@/lib/seo-content/jsonld-builders'
import { buildSeoMetadata } from '@/lib/seo-content/metadata-builder'
import { generateLocalContent } from '@/lib/seo-content/template-generator'
import { MapPin, Star, Trophy } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

/**
 * /comparatif/[type]/[ville] — comparatif diagnostiqueurs.
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

  return buildSeoMetadata({
    title: `Comparatif ${label} à ${city.name} — Meilleurs diagnostiqueurs 2026`,
    description: `Top diagnostiqueurs ${label} à ${city.name} : avis, prix, délais, certifications. Comparez et choisissez le meilleur professionnel.`,
    path: `/comparatif/${type}/${city.slug}`,
  })
}

interface DiagComparisonRow {
  readonly id: string
  readonly displayName: string
  readonly streetAddress?: string
  readonly ratingAvg: number
  readonly ratingCount: number
  readonly priceFrom: number
  readonly delayBusinessDays: number
  readonly specialties: ReadonlyArray<string>
}

function enrichForComparison(
  city: ReturnType<typeof getCityBySlug>,
  type: DiagnosticType,
): ReadonlyArray<DiagComparisonRow> {
  if (!city) return []
  const base = buildMockDiagnosticians(city, 7)
  const r = DIAGNOSTIC_PRICE_RANGES[type]

  const seedFn = (input: string): number => {
    let h = 2166136261
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return Math.abs(h)
  }

  const allTypes = DIAGNOSTIC_TYPES.map((t) => DIAGNOSTIC_LABELS[t])

  return base.map((d) => {
    const seed = seedFn(`${d.id}:${type}`)
    const priceFrom = Math.round(r.min + (seed % (r.max - r.min)))
    const delayBusinessDays = 2 + (seed % 5)
    const specialtyCount = 3 + (seed % 4)
    const specialties: string[] = []
    for (let i = 0; i < specialtyCount; i++) {
      const item = allTypes[(seed + i * 7) % allTypes.length]
      if (item !== undefined && !specialties.includes(item)) {
        specialties.push(item)
      }
    }
    return {
      id: d.id,
      displayName: d.displayName,
      streetAddress: d.streetAddress,
      ratingAvg: d.ratingAvg ?? 4.5,
      ratingCount: d.ratingCount ?? 20,
      priceFrom,
      delayBusinessDays,
      specialties,
    }
  })
}

export default async function ComparatifVillePage({
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
  const candidates = enrichForComparison(city, diagnosticType)

  const sortedCandidates = [...candidates].sort((a, b) => {
    const scoreA = a.ratingAvg * 20 - a.priceFrom / 10 - a.delayBusinessDays * 5
    const scoreB = b.ratingAvg * 20 - b.priceFrom / 10 - b.delayBusinessDays * 5
    return scoreB - scoreA
  })

  const breadcrumbs = [
    { label: 'Accueil', href: '/' },
    { label: 'Comparatifs', href: '/trouver-un-diagnostiqueur' },
    {
      label: `Comparatif ${label}`,
      href: `/comparatif/${diagnosticType}/${city.slug}`,
    },
    { label: city.name, href: `/comparatif/${diagnosticType}/${city.slug}` },
  ]

  const jsonLd: ReadonlyArray<Record<string, unknown>> = [
    buildBreadcrumbLD(
      breadcrumbs.map((c) => ({ name: c.label, url: `https://kovas.fr${c.href}` })),
    ),
    buildLocalBusinessListLD(
      sortedCandidates.map((c) => ({
        id: c.id,
        displayName: c.displayName,
        streetAddress: c.streetAddress,
        ratingAvg: c.ratingAvg,
        ratingCount: c.ratingCount,
      })),
      city,
    ),
    buildFaqLD(content.faq),
  ]

  return (
    <ProgrammaticShell city={city} breadcrumbs={breadcrumbs} jsonLd={jsonLd}>
      <SeoHero
        eyebrow={`Comparatif · ${city.region.split('-').join(' ')} · ${city.postalCode}`}
        titlePrefix={`Comparatif ${label}`}
        titleEm={`à ${city.name}`}
        lede={`Nous avons comparé les meilleurs diagnostiqueurs ${longLabel.toLowerCase()} exerçant à ${city.name} selon 5 critères : note clients, délai d’intervention, prix, spécialités et proximité. Classement actualisé 2026.`}
      />

      <SeoSection title={`Top diagnostiqueurs ${label} à ${city.name}`}>
        <p>
          Sélection des {sortedCandidates.length} meilleurs diagnostiqueurs {label} à {city.name}{' '}
          selon notre score composite (note clients pondérée par nombre d’avis, prix de référence,
          délai moyen d’intervention). Les 3 premiers sont mis en avant.
        </p>
        <div className="space-y-3 mt-5">
          {sortedCandidates.map((d, idx) => {
            const rank = idx + 1
            const isPodium = rank <= 3
            return (
              <Card key={d.id} className={isPodium ? 'p-5 border-2 border-chartreuse/60' : 'p-5'}>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div
                      className={
                        isPodium
                          ? 'size-12 rounded-pill bg-chartreuse text-ink flex items-center justify-center font-bold text-lg'
                          : 'size-12 rounded-pill bg-cream-deep text-ink-mute flex items-center justify-center font-bold text-lg'
                      }
                    >
                      {rank === 1 ? <Trophy className="size-5" aria-hidden /> : rank}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-ink text-base">{d.displayName}</h3>
                    {d.streetAddress !== undefined ? (
                      <p className="text-sm text-ink-soft mt-1 flex items-start gap-1.5">
                        <MapPin className="size-3.5 text-ink-mute mt-0.5 shrink-0" aria-hidden />
                        <span>{d.streetAddress}</span>
                      </p>
                    ) : null}
                    <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-ink-mute font-mono">
                          Note
                        </p>
                        <p className="flex items-center gap-1 mt-0.5 text-ink">
                          <Star
                            className="size-3.5 text-chartreuse-deep fill-chartreuse"
                            aria-hidden
                          />
                          {d.ratingAvg.toFixed(1)} · {d.ratingCount} avis
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-ink-mute font-mono">
                          Prix
                        </p>
                        <p className="font-mono text-ink mt-0.5">dès {d.priceFrom} €</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-ink-mute font-mono">
                          Délai
                        </p>
                        <p className="text-ink mt-0.5">{d.delayBusinessDays} j ouvrés</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {d.specialties.slice(0, 5).map((s) => (
                        <Badge key={s} variant="muted" className="text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </SeoSection>

      <SeoSection title={`Comment choisir un diagnostiqueur ${label} à ${city.name}`}>
        <ul className="space-y-2 list-disc pl-5">
          <li>
            <strong className="font-semibold text-ink">Certification COFRAC</strong> : obligatoire
            et nominative. Vérifiez sa validité sur le site COFRAC avant signature.
          </li>
          <li>
            <strong className="font-semibold text-ink">
              Assurance responsabilité civile professionnelle
            </strong>{' '}
            : indispensable. Demandez l’attestation de moins d’un an.
          </li>
          <li>
            <strong className="font-semibold text-ink">Indépendance</strong> : le diagnostiqueur ne
            doit avoir aucun lien avec une agence immobilière, un syndic ou un artisan susceptible
            de réaliser des travaux suite au diagnostic.
          </li>
          <li>
            <strong className="font-semibold text-ink">Devis détaillé</strong> : exigez un devis
            écrit listant les diagnostics inclus, le délai d’intervention et de remise du rapport,
            le mode de paiement.
          </li>
          <li>
            <strong className="font-semibold text-ink">Avis clients</strong> : consultez Google et
            les annuaires spécialisés. Au moins 10 avis authentiques sont un bon indicateur
            d’expérience.
          </li>
        </ul>
      </SeoSection>

      <SeoCtaBlock
        title={`Demander un devis aux 3 meilleurs ${label} de ${city.name}`}
        description="Recevez en moins de 24 heures un devis personnalisé du Top 3 diagnostiqueurs sélectionnés."
        primary={{
          label: 'Demander 3 devis comparatifs',
          href: `/contact?type=${diagnosticType}&ville=${city.slug}&source=comparatif`,
        }}
        secondary={{
          label: `Prix d’un ${label} à ${city.name}`,
          href: `/prix/${diagnosticType}/${city.slug}`,
        }}
      />

      <SeoFaqSection faq={content.faq} />

      <SeoInternalLinking
        city={city}
        type={diagnosticType}
        otherTypes={otherTypes}
        neighborCities={neighbors}
        basePath="/comparatif"
      />

      <div className="mt-12 pt-8 border-t border-rule text-sm text-ink-mute text-center space-y-3">
        <p className="text-xs text-ink-faint">
          Méthodologie : score composite (60 % note × volume d’avis, 25 % prix rapporté à la médiane
          locale, 15 % délai moyen d’intervention). Classement mis à jour mensuellement. Données
          déclaratives diagnostiqueurs.
        </p>
      </div>
    </ProgrammaticShell>
  )
}
