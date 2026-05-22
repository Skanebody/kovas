import { Card } from '@/components/ui/card'
import {
  ProgrammaticShell,
  SeoCtaBlock,
  SeoFaqSection,
  SeoHero,
  SeoInternalLinking,
  SeoSection,
} from '@/components/seo-prog/ProgrammaticShell'
import { CITIES, getCityBySlug, getNeighborCities } from '@/lib/cities/registry'
import {
  DIAGNOSTIC_PRICE_RANGES,
  DIAGNOSTIC_TYPES,
  type DiagnosticType,
} from '@/lib/diagnostics/types'
import { buildSeoMetadata } from '@/lib/seo-content/metadata-builder'
import {
  buildBreadcrumbLD,
  buildFaqLD,
  buildLocalBusinessListLD,
  buildMockDiagnosticians,
  buildServiceLD,
} from '@/lib/seo-content/jsonld-builders'
import { generateLocalContent } from '@/lib/seo-content/template-generator'
import { AlertCircle, MapPin } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

/**
 * /audit-energetique/[ville] — contenu informatif réglementation.
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
    title: `Audit énergétique obligatoire à ${city.name} (${city.postalCode}) — Coût et auditeurs certifiés`,
    description: `Audit énergétique réglementaire à ${city.name} : obligation F/G/E depuis 2025, coût 500-1200 €, aides MaPrimeRénov, auditeurs certifiés.`,
    path: `/audit-energetique/${city.slug}`,
  })
}

export default async function AuditEnergetiqueVillePage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { ville } = await params
  const city = getCityBySlug(ville)
  if (!city) notFound()

  const auditType: DiagnosticType = 'audit-energetique'
  const content = generateLocalContent(auditType, city)
  const neighbors = getNeighborCities(city.slug)
  const otherTypes = DIAGNOSTIC_TYPES.filter(
    (t) => t !== 'audit-energetique',
  ).slice(0, 8)
  const mockDiags = buildMockDiagnosticians(city, 4)
  const range = DIAGNOSTIC_PRICE_RANGES[auditType]

  const breadcrumbs = [
    { label: 'Accueil', href: '/' },
    { label: 'Audit énergétique', href: '/audit-energetique' },
    { label: city.name, href: `/audit-energetique/${city.slug}` },
  ]

  const jsonLd: ReadonlyArray<Record<string, unknown>> = [
    buildServiceLD(auditType, city, '/audit-energetique'),
    buildBreadcrumbLD(
      breadcrumbs.map((c) => ({ name: c.label, url: `https://kovas.fr${c.href}` })),
    ),
    buildFaqLD(content.faq),
    buildLocalBusinessListLD(mockDiags, city),
  ]

  const reglementationSteps: ReadonlyArray<{ year: string; rule: string }> = [
    {
      year: 'Avril 2023',
      rule: 'Audit énergétique obligatoire à la vente pour tout logement classé F ou G (monopropriété).',
    },
    {
      year: 'Janvier 2025',
      rule: 'Extension de l’obligation aux logements classés E (monopropriété).',
    },
    {
      year: 'Janvier 2034',
      rule: 'Extension de l’obligation aux logements classés D (monopropriété).',
    },
  ]

  return (
    <ProgrammaticShell city={city} breadcrumbs={breadcrumbs} jsonLd={jsonLd}>
      <SeoHero
        eyebrow={`Obligation réglementaire · ${city.region.split('-').join(' ')} · ${city.postalCode}`}
        titlePrefix="Audit énergétique"
        titleEm={`obligatoire à ${city.name}`}
        lede={`Si vous vendez à ${city.name} un logement classé F, G ou E (depuis 2025), un audit énergétique est obligatoire en plus du DPE. Coût, démarches, auditeurs certifiés et aides disponibles.`}
      />

      <section className="mb-12 max-w-3xl">
        <Card variant="warm" className="p-6 flex items-start gap-4">
          <AlertCircle
            className="size-6 text-chartreuse-deep flex-shrink-0 mt-0.5"
            aria-hidden
          />
          <div className="text-sm">
            <p className="font-semibold text-ink mb-1">
              Vous vendez un logement F, G ou E à {city.name} ?
            </p>
            <p className="text-ink-soft leading-relaxed">
              L’audit énergétique est obligatoire en complément du DPE. Il doit
              être remis dès la première visite et joint au compromis de vente.
            </p>
          </div>
        </Card>
      </section>

      <SeoSection title={`Pourquoi un audit énergétique à ${city.name}`}>
        <p>{content.whyHere}</p>
        <p>
          L’audit va plus loin que le DPE : il propose un plan de travaux
          chiffré (au moins 2 scénarios) permettant d’améliorer la classe
          énergétique du bien. À {city.name}, les auditeurs certifiés
          connaissent les spécificités du parc immobilier local et adaptent
          leurs préconisations en conséquence.
        </p>
      </SeoSection>

      <SeoSection title="Réglementation et calendrier d’obligation">
        <div className="space-y-3 mt-3">
          {reglementationSteps.map((step) => (
            <Card key={step.year} className="p-5">
              <p className="text-xs uppercase tracking-wider text-ink-mute font-mono mb-2">
                {step.year}
              </p>
              <p className="text-ink-soft leading-relaxed">{step.rule}</p>
            </Card>
          ))}
        </div>
      </SeoSection>

      <SeoSection title={`Coût d’un audit énergétique à ${city.name}`}>
        <p>{content.priceContext}</p>
        <Card className="p-6 mt-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-mute font-mono">
                Minimum
              </p>
              <p className="font-mono text-2xl font-semibold text-ink mt-1">
                {range.min} €
              </p>
            </div>
            <div className="border-x border-rule">
              <p className="text-xs uppercase tracking-wider text-ink-mute font-mono">
                Médiane
              </p>
              <p className="font-serif italic text-3xl text-chartreuse-deep mt-1">
                {range.median} €
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-mute font-mono">
                Maximum
              </p>
              <p className="font-mono text-2xl font-semibold text-ink mt-1">
                {range.max} €
              </p>
            </div>
          </div>
          <p className="text-xs text-ink-faint mt-4 text-center">
            Tarifs TTC indicatifs constatés à {city.name}. L’audit peut être
            partiellement pris en charge par MaPrimeRénov.
          </p>
        </Card>
      </SeoSection>

      <SeoSection title={`Aides MaPrimeRénov à ${city.name}`}>
        <p>
          Les travaux préconisés par l’audit énergétique peuvent être financés
          partiellement par MaPrimeRénov, selon vos revenus et la nature des
          travaux. Le montant des aides dépend de votre tranche fiscale (Bleu,
          Jaune, Violet, Rose) et du gain énergétique atteint.
        </p>
        <p className="mt-3">
          <Link
            href={`/maprimerenov/${city.slug}`}
            className="text-ink hover:underline underline-offset-4 font-medium"
          >
            Voir les barèmes MaPrimeRénov à {city.name} →
          </Link>
        </p>
      </SeoSection>

      <SeoSection title={`Auditeurs énergétiques certifiés à ${city.name}`}>
        <p>
          L’audit énergétique réglementaire ne peut être réalisé que par un
          professionnel disposant d’une certification spécifique (RGE Audit
          ou architecte). Voici une sélection d’auditeurs exerçant à{' '}
          {city.name} et alentours.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mt-5">
          {mockDiags.map((d) => (
            <Card key={d.id} className="p-5">
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
              {d.ratingAvg !== undefined ? (
                <p className="text-xs text-ink-mute mt-2">
                  Note {d.ratingAvg.toFixed(1)}/5 · {d.ratingCount} avis
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      </SeoSection>

      <SeoSection title="Que contient l’audit énergétique réglementaire">
        <ul className="space-y-2 list-disc pl-5">
          <li>
            Un état initial du logement : isolation, ventilation, chauffage,
            production d’eau chaude.
          </li>
          <li>
            Un calcul détaillé de la performance énergétique avec ses points
            faibles.
          </li>
          <li>
            Au moins 2 scénarios de travaux chiffrés permettant d’atteindre la
            classe B (objectif idéal) ou la classe C (objectif réaliste).
          </li>
          <li>
            Pour chaque scénario : coût des travaux, gain énergétique attendu,
            économies de chauffage projetées, aides mobilisables (MaPrimeRénov,
            CEE, éco-prêt).
          </li>
          <li>Une estimation des économies sur facture après travaux.</li>
        </ul>
      </SeoSection>

      <SeoCtaBlock
        title={`Trouver un auditeur énergétique certifié à ${city.name}`}
        description="Demandez un devis comparatif d’auditeurs certifiés exerçant dans votre commune."
        primary={{
          label: 'Demander un devis audit énergétique',
          href: `/contact?type=audit-energetique&ville=${city.slug}&source=audit`,
        }}
        secondary={{
          label: `DPE à ${city.name}`,
          href: `/diagnostic/dpe/${city.slug}`,
        }}
      />

      <SeoFaqSection faq={content.faq} />

      <SeoInternalLinking
        city={city}
        otherTypes={otherTypes}
        neighborCities={neighbors}
        basePath="/audit-energetique"
      />

      <div className="mt-12 pt-8 border-t border-rule text-sm text-ink-mute text-center space-y-3">
        <p className="text-xs text-ink-faint">
          Information : l’audit énergétique réglementaire est obligatoire à la
          vente. Pour la location, c’est le DPE qui s’applique. Les copropriétés
          relèvent du DPE collectif (différent de l’audit individuel).
        </p>
      </div>
    </ProgrammaticShell>
  )
}
