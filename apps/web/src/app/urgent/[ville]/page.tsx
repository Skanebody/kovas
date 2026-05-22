import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  ProgrammaticShell,
  SeoCtaBlock,
  SeoHero,
  SeoInternalLinking,
  SeoSection,
} from '@/components/seo-prog/ProgrammaticShell'
import { CITIES, getCityBySlug, getNeighborCities } from '@/lib/cities/registry'
import {
  DIAGNOSTIC_LABELS,
  DIAGNOSTIC_TYPES,
  type DiagnosticType,
} from '@/lib/diagnostics/types'
import { buildSeoMetadata } from '@/lib/seo-content/metadata-builder'
import {
  buildBreadcrumbLD,
  buildLocalBusinessListLD,
  buildMockDiagnosticians,
} from '@/lib/seo-content/jsonld-builders'
import { Clock, MapPin, Phone, Zap } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

/**
 * /urgent/[ville] — page programmatique diagnostic en urgence.
 * 1 page × 213 villes = 213 pages.
 */

export const dynamic = 'force-static'
export const revalidate = 86400

interface RouteParams {
  ville: string
}

export function generateStaticParams(): ReadonlyArray<RouteParams> {
  return CITIES.map((city) => ({ ville: city.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}): Promise<Metadata> {
  const { ville } = await params
  const city = getCityBySlug(ville)
  if (!city) return { title: 'Page introuvable — KOVAS' }

  return buildSeoMetadata({
    title: `Diagnostic immobilier urgent à ${city.name} (${city.postalCode}) — Sous 48h`,
    description: `Diagnostiqueur disponible en urgence à ${city.name} : DPE, amiante, gaz, électricité sous 24-48h. Devis gratuit immédiat.`,
    path: `/urgent/${city.slug}`,
  })
}

export default async function UrgentVillePage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { ville } = await params
  const city = getCityBySlug(ville)
  if (!city) notFound()

  const neighbors = getNeighborCities(city.slug)
  const mockDiags = buildMockDiagnosticians(city, 5)

  const breadcrumbs = [
    { label: 'Accueil', href: '/' },
    { label: 'Diagnostic urgent', href: '/diagnostiqueurs' },
    { label: city.name, href: `/urgent/${city.slug}` },
  ]

  const urgentService: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Diagnostic immobilier urgent à ${city.name}`,
    serviceType: 'Diagnostic immobilier en urgence',
    description: `Intervention diagnostiqueur sous 24-48h à ${city.name} pour DPE, amiante, gaz, électricité, plomb et tous diagnostics réglementaires.`,
    areaServed: {
      '@type': 'City',
      name: city.name,
      address: {
        '@type': 'PostalAddress',
        addressLocality: city.name,
        postalCode: city.postalCode,
        addressCountry: 'FR',
      },
    },
    provider: { '@type': 'Organization', name: 'KOVAS', url: 'https://kovas.fr' },
    hoursAvailable: 'Mo-Sa 08:00-19:00',
  }

  const jsonLd: ReadonlyArray<Record<string, unknown>> = [
    urgentService,
    buildBreadcrumbLD(
      breadcrumbs.map((c) => ({ name: c.label, url: `https://kovas.fr${c.href}` })),
    ),
    buildLocalBusinessListLD(mockDiags, city),
  ]

  const reasons: ReadonlyArray<{ title: string; desc: string }> = [
    {
      title: 'Vente accélérée',
      desc: 'Un compromis signé sans tous les diagnostics doit être complété sous quelques jours. Une intervention rapide évite le report de la signature.',
    },
    {
      title: 'Mise en location immédiate',
      desc: 'Le bailleur doit fournir le DPE et l’ERP dès la mise sur le marché. Un diagnostic urgent évite une vacance locative coûteuse.',
    },
    {
      title: 'Demande notariale',
      desc: 'Un notaire peut demander un complément de diagnostic à quelques jours de la signature définitive. Délai impératif.',
    },
    {
      title: 'Sinistre ou rénovation',
      desc: 'Avant travaux dans un bien construit avant 1997, le diagnostic amiante avant-travaux est obligatoire. Souvent réalisé en urgence.',
    },
  ]

  return (
    <ProgrammaticShell city={city} breadcrumbs={breadcrumbs} jsonLd={jsonLd}>
      <SeoHero
        eyebrow={`Urgence · ${city.region.split('-').join(' ')} · ${city.postalCode}`}
        titlePrefix="Diagnostic immobilier"
        titleEm={`urgent à ${city.name}`}
        lede={`Vous avez besoin d’un diagnostic immobilier rapidement à ${city.name} ? Des diagnostiqueurs certifiés interviennent sous 24 à 48 heures dans votre commune. Demandez un devis immédiat.`}
      />

      <section className="mb-12 max-w-3xl">
        <Card variant="warm" className="p-8 text-center">
          <Zap
            className="size-10 mx-auto text-chartreuse-deep mb-3"
            aria-hidden
          />
          <p className="font-serif italic text-4xl md:text-5xl text-ink mt-1">
            Sous 48 heures
          </p>
          <p className="text-ink-mute mt-3 max-w-md mx-auto">
            Diagnostiqueurs disponibles en intervention rapide à {city.name}{' '}
            pour tous diagnostics réglementaires.
          </p>
        </Card>
      </section>

      <SeoSection title={`Pourquoi un diagnostic en urgence à ${city.name}`}>
        <p>
          À {city.name}, le marché immobilier est actif et de nombreuses
          situations exigent un diagnostic en urgence. Voici les principaux
          motifs d’intervention rapide observés.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mt-5">
          {reasons.map((r) => (
            <Card key={r.title} className="p-5">
              <h3 className="font-semibold text-ink text-base mb-2 flex items-center gap-2">
                <Clock className="size-4 text-chartreuse-deep" aria-hidden />
                {r.title}
              </h3>
              <p className="text-sm text-ink-soft leading-relaxed">{r.desc}</p>
            </Card>
          ))}
        </div>
      </SeoSection>

      <SeoSection
        title={`Diagnostiqueurs disponibles sous 48h à ${city.name}`}
      >
        <p>
          Sélection de diagnostiqueurs réactifs exerçant à {city.name} et
          alentours, capables d’intervenir en urgence sur tous types de
          diagnostics réglementaires.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
          {mockDiags.map((d) => (
            <Card key={d.id} className="p-5">
              <Badge variant="amber" className="mb-3">
                Disponible sous 48h
              </Badge>
              <h3 className="font-semibold text-ink text-base">
                {d.displayName}
              </h3>
              <p className="text-sm text-ink-soft mt-2 flex items-start gap-1.5">
                <MapPin
                  className="size-3.5 text-ink-mute mt-0.5 shrink-0"
                  aria-hidden
                />
                <span>{d.streetAddress}</span>
              </p>
              {d.phone !== undefined ? (
                <p className="text-sm text-ink-soft mt-1 flex items-center gap-1.5 font-mono">
                  <Phone className="size-3.5 text-ink-mute" aria-hidden />
                  {d.phone}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      </SeoSection>

      <SeoSection title="Diagnostics fréquemment demandés en urgence">
        <p>
          Tous les diagnostics réglementaires peuvent être réalisés en urgence à{' '}
          {city.name}. Voici les plus demandés :
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {DIAGNOSTIC_TYPES.filter((t) => t !== 'audit-energetique').map(
            (t: DiagnosticType) => (
              <Link
                key={t}
                href={`/diagnostic/${t}/${city.slug}`}
                className="inline-flex items-center"
              >
                <Badge variant="outline">
                  {DIAGNOSTIC_LABELS[t]}
                </Badge>
              </Link>
            ),
          )}
        </div>
      </SeoSection>

      <SeoCtaBlock
        title={`Demander un diagnostiqueur en urgence à ${city.name}`}
        description="Formulaire 4 champs · réponse sous 1 heure ouvrée · intervention possible dès le lendemain."
        primary={{
          label: 'Demander une intervention urgente',
          href: `/contact?ville=${city.slug}&urgent=true&source=urgent`,
        }}
        secondary={{
          label: 'Voir tous les diagnostiqueurs',
          href: `/diagnostiqueurs/${city.dept}/${city.slug}`,
        }}
      />

      <SeoInternalLinking
        city={city}
        otherTypes={[]}
        neighborCities={neighbors}
        basePath="/urgent"
      />

      <div className="mt-12 pt-8 border-t border-rule text-sm text-ink-mute text-center space-y-3">
        <p className="text-xs text-ink-faint">
          Information : un diagnostic réalisé en urgence a la même valeur
          juridique qu’un diagnostic planifié. Vérifiez toujours la
          certification COFRAC du diagnostiqueur.
        </p>
      </div>
    </ProgrammaticShell>
  )
}
