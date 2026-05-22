import { Badge } from '@/components/ui/badge'
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
import { DIAGNOSTIC_TYPES } from '@/lib/diagnostics/types'
import { buildSeoMetadata } from '@/lib/seo-content/metadata-builder'
import { buildBreadcrumbLD, buildFaqLD } from '@/lib/seo-content/jsonld-builders'
import type { FaqItem } from '@/lib/seo-content/template-generator'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

/**
 * /maprimerenov/[ville] — barèmes MaPrimeRénov contextualisés ville.
 * 1 × 213 villes = 213 pages.
 *
 * Contenu strictement informatif. KOVAS n'opère pas la marketplace MAR/RGE
 * (cf. CLAUDE.md §20 — définitivement annulée). Ces pages génèrent du
 * trafic SEO sur "maprimerenov + ville" qui converti vers /audit-energetique
 * et /diagnostic/dpe.
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
    title: `MaPrimeRénov à ${city.name} (${city.postalCode}) — Barèmes 2026 et démarches`,
    description: `MaPrimeRénov à ${city.name} : barèmes 2026 par tranche de revenu, montants par travaux (isolation, chauffage, audit), aides cumulables.`,
    path: `/maprimerenov/${city.slug}`,
  })
}

interface PrimeRow {
  readonly travaux: string
  readonly bleu: string
  readonly jaune: string
  readonly violet: string
  readonly rose: string
}

const PRIME_ROWS: ReadonlyArray<PrimeRow> = [
  { travaux: 'Isolation des combles (perdus)', bleu: '25 €/m²', jaune: '20 €/m²', violet: '15 €/m²', rose: '7 €/m²' },
  { travaux: 'Isolation des murs par l’extérieur', bleu: '75 €/m²', jaune: '60 €/m²', violet: '40 €/m²', rose: '15 €/m²' },
  { travaux: 'Isolation des planchers', bleu: '25 €/m²', jaune: '20 €/m²', violet: '15 €/m²', rose: '7 €/m²' },
  { travaux: 'Pompe à chaleur air/eau', bleu: '5 000 €', jaune: '4 000 €', violet: '3 000 €', rose: '—' },
  { travaux: 'Pompe à chaleur géothermique', bleu: '11 000 €', jaune: '9 000 €', violet: '6 000 €', rose: '—' },
  { travaux: 'Chaudière biomasse', bleu: '8 000 €', jaune: '6 500 €', violet: '3 000 €', rose: '—' },
  { travaux: 'Chauffe-eau solaire', bleu: '4 000 €', jaune: '3 000 €', violet: '2 000 €', rose: '—' },
  { travaux: 'Audit énergétique', bleu: '500 €', jaune: '400 €', violet: '300 €', rose: '—' },
]

interface TrancheRevenu {
  readonly couleur: string
  readonly variant: 'blue' | 'yellow' | 'amber' | 'muted'
  readonly idfMin: number
  readonly idfMax: number
  readonly hidfMin: number
  readonly hidfMax: number
}

const TRANCHES_REVENUS: ReadonlyArray<TrancheRevenu> = [
  { couleur: 'Bleu (très modeste)', variant: 'blue', idfMin: 0, idfMax: 28657, hidfMin: 0, hidfMax: 22461 },
  { couleur: 'Jaune (modeste)', variant: 'yellow', idfMin: 28658, idfMax: 34993, hidfMin: 22462, hidfMax: 28799 },
  { couleur: 'Violet (intermédiaire)', variant: 'amber', idfMin: 34994, idfMax: 48831, hidfMin: 28800, hidfMax: 40991 },
  { couleur: 'Rose (supérieur)', variant: 'muted', idfMin: 48832, idfMax: Number.POSITIVE_INFINITY, hidfMin: 40992, hidfMax: Number.POSITIVE_INFINITY },
]

function buildMprFaq(cityName: string): ReadonlyArray<FaqItem> {
  return [
    {
      question: `Qui peut bénéficier de MaPrimeRénov à ${cityName} ?`,
      answer: 'Tous les propriétaires occupants, bailleurs et copropriétés sont éligibles, quelle que soit la commune. Les conditions principales : logement de plus de 15 ans (sauf changement de mode de chauffage), résidence principale, travaux réalisés par un artisan RGE.',
    },
    {
      question: 'Comment connaître ma tranche de couleur (Bleu, Jaune, Violet, Rose) ?',
      answer: 'Votre tranche dépend de votre revenu fiscal de référence (RFR) figurant sur votre dernier avis d’imposition, du nombre de personnes du foyer et de la région (Île-de-France ou autres). Le simulateur officiel sur maprimerenov.gouv.fr donne la réponse en 2 minutes.',
    },
    {
      question: 'MaPrimeRénov est-elle cumulable avec d’autres aides ?',
      answer: 'Oui : MaPrimeRénov est cumulable avec les Certificats d’Économies d’Énergie (CEE), l’éco-prêt à taux zéro (éco-PTZ), la TVA à 5,5 % et les aides locales (région, département, intercommunalité). Le cumul total ne peut toutefois excéder 100 % du coût des travaux.',
    },
    {
      question: 'Quand est versée MaPrimeRénov ?',
      answer: 'Après réception des factures finales, l’ANAH procède au versement sous 15 jours en moyenne. Pour les ménages très modestes, une avance de 70 % peut être versée avant travaux pour faciliter le démarrage du chantier.',
    },
    {
      question: 'Faut-il un audit énergétique pour bénéficier de MaPrimeRénov ?',
      answer: 'Pour MaPrimeRénov Parcours Accompagné (ex-Sérénité), oui : un audit énergétique avant travaux est obligatoire. Pour MaPrimeRénov Geste par Geste (travaux isolés), un audit n’est pas exigé sauf cas spécifique. L’audit lui-même peut être pris en charge partiellement par MaPrimeRénov.',
    },
  ]
}

export default async function MaPrimeRenovVillePage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { ville } = await params
  const city = getCityBySlug(ville)
  if (!city) notFound()

  const neighbors = getNeighborCities(city.slug)
  const otherTypes = DIAGNOSTIC_TYPES.filter(
    (t) => t === 'dpe' || t === 'audit-energetique',
  )
  const faq = buildMprFaq(city.name)

  const isIdf = city.region === 'ile-de-france'

  const breadcrumbs = [
    { label: 'Accueil', href: '/' },
    { label: 'MaPrimeRénov', href: '/maprimerenov' },
    { label: city.name, href: `/maprimerenov/${city.slug}` },
  ]

  const jsonLd: ReadonlyArray<Record<string, unknown>> = [
    buildBreadcrumbLD(
      breadcrumbs.map((c) => ({ name: c.label, url: `https://kovas.fr${c.href}` })),
    ),
    buildFaqLD(faq),
  ]

  return (
    <ProgrammaticShell city={city} breadcrumbs={breadcrumbs} jsonLd={jsonLd}>
      <SeoHero
        eyebrow={`Aides rénovation · ${city.region.split('-').join(' ')} · ${city.postalCode}`}
        titlePrefix="MaPrimeRénov"
        titleEm={`à ${city.name}`}
        lede={`Barèmes 2026 MaPrimeRénov à ${city.name} : montants par tranche de revenu et par type de travaux. Conditions d’éligibilité, démarches, cumul avec d’autres aides.`}
      />

      <SeoSection title={`Tranches de revenus à ${city.name}`}>
        <p>
          MaPrimeRénov classe les foyers en 4 tranches de couleur selon leur
          revenu fiscal de référence. À {city.name} ({isIdf ? 'Île-de-France' : 'hors Île-de-France'}),
          les plafonds applicables pour une personne seule sont les suivants.
          Pour chaque personne supplémentaire du foyer, les plafonds sont
          relevés d’environ 4 000 € en moyenne.
        </p>
        <Card className="p-0 overflow-hidden mt-4">
          <table className="w-full text-sm">
            <thead className="bg-cream-deep border-b border-rule">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-ink">Tranche</th>
                <th className="text-right px-4 py-3 font-semibold text-ink">
                  RFR maximum (1 personne)
                </th>
              </tr>
            </thead>
            <tbody>
              {TRANCHES_REVENUS.map((t) => {
                const max = isIdf ? t.idfMax : t.hidfMax
                const min = isIdf ? t.idfMin : t.hidfMin
                return (
                  <tr key={t.couleur} className="border-b border-rule last:border-b-0">
                    <td className="px-4 py-3">
                      <Badge variant={t.variant}>{t.couleur}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-ink">
                      {max === Number.POSITIVE_INFINITY
                        ? `> ${min.toLocaleString('fr-FR')} €`
                        : `≤ ${max.toLocaleString('fr-FR')} €`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
        <p className="text-xs text-ink-faint mt-3">
          Source : barèmes ANAH 2026.{' '}
          {isIdf ? 'Plafonds Île-de-France' : 'Plafonds hors Île-de-France'} pour 1 personne.
        </p>
      </SeoSection>

      <SeoSection title="Montants MaPrimeRénov par travaux (2026)">
        <p>
          Le montant de la prime dépend des travaux réalisés et de votre
          tranche. Voici les principaux postes finançables pour un logement
          situé à {city.name}.
        </p>
        <Card className="p-0 overflow-hidden mt-4 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-cream-deep border-b border-rule">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-ink">Travaux</th>
                <th className="text-right px-3 py-3 font-semibold text-ink">Bleu</th>
                <th className="text-right px-3 py-3 font-semibold text-ink">Jaune</th>
                <th className="text-right px-3 py-3 font-semibold text-ink">Violet</th>
                <th className="text-right px-3 py-3 font-semibold text-ink">Rose</th>
              </tr>
            </thead>
            <tbody>
              {PRIME_ROWS.map((row) => (
                <tr key={row.travaux} className="border-b border-rule last:border-b-0">
                  <td className="px-4 py-3 text-ink-soft">{row.travaux}</td>
                  <td className="px-3 py-3 text-right font-mono text-ink">{row.bleu}</td>
                  <td className="px-3 py-3 text-right font-mono text-ink">{row.jaune}</td>
                  <td className="px-3 py-3 text-right font-mono text-ink">{row.violet}</td>
                  <td className="px-3 py-3 text-right font-mono text-ink-mute">{row.rose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-xs text-ink-faint mt-3">
          Source : barème officiel ANAH 2026. Montants maximum hors bonifications.
        </p>
      </SeoSection>

      <SeoSection title="Calculateur d’éligibilité simplifié">
        <p>
          Pour une estimation rapide de votre éligibilité à MaPrimeRénov à{' '}
          {city.name}, répondez à ces 3 questions :
        </p>
        <Card className="p-6 mt-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-ink mb-1">
              1. Votre logement a-t-il plus de 15 ans ?
            </p>
            <p className="text-xs text-ink-mute">
              Si oui, vous êtes éligible. Sinon, uniquement en cas de
              changement de mode de chauffage (pompe à chaleur, biomasse).
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink mb-1">
              2. Le logement est-il votre résidence principale ou un bien loué
              déclaré ?
            </p>
            <p className="text-xs text-ink-mute">
              Les résidences secondaires ne sont pas éligibles.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink mb-1">
              3. Les travaux seront-ils réalisés par un artisan RGE certifié ?
            </p>
            <p className="text-xs text-ink-mute">
              Seuls les artisans RGE (Reconnu Garant de l’Environnement)
              ouvrent droit à la prime.
            </p>
          </div>
          <div className="pt-3 border-t border-rule">
            <p className="text-xs text-ink-faint">
              Si vous répondez « oui » aux 3 questions, vous êtes éligible.
              Le montant exact dépendra ensuite de votre tranche de revenu et
              des travaux retenus.
            </p>
          </div>
        </Card>
      </SeoSection>

      <SeoSection title={`Avant les travaux : DPE et audit énergétique à ${city.name}`}>
        <p>
          Avant d’engager des travaux financés par MaPrimeRénov, deux
          diagnostics sont fréquemment requis :
        </p>
        <ul className="space-y-2 list-disc pl-5 mt-3">
          <li>
            Un{' '}
            <Link
              href={`/diagnostic/dpe/${city.slug}`}
              className="text-ink hover:underline underline-offset-4 font-medium"
            >
              DPE à {city.name}
            </Link>{' '}
            pour connaître la classe énergétique de départ.
          </li>
          <li>
            Pour le parcours « rénovation d’ampleur », un{' '}
            <Link
              href={`/audit-energetique/${city.slug}`}
              className="text-ink hover:underline underline-offset-4 font-medium"
            >
              audit énergétique à {city.name}
            </Link>{' '}
            qui propose le scénario de travaux le plus performant.
          </li>
        </ul>
      </SeoSection>

      <SeoCtaBlock
        title="Estimer mes aides MaPrimeRénov"
        description="Le simulateur officiel maprimerenov.gouv.fr donne une estimation précise en 2 minutes."
        primary={{
          label: `Estimer mon DPE à ${city.name}`,
          href: '/calculateur-dpe-gratuit',
        }}
        secondary={{
          label: `Audit énergétique à ${city.name}`,
          href: `/audit-energetique/${city.slug}`,
        }}
      />

      <SeoFaqSection faq={faq} />

      <SeoInternalLinking
        city={city}
        otherTypes={otherTypes}
        neighborCities={neighbors}
        basePath="/maprimerenov"
      />

      <div className="mt-12 pt-8 border-t border-rule text-sm text-ink-mute text-center space-y-3">
        <p className="text-xs text-ink-faint">
          Source officielle : ANAH (Agence nationale de l’habitat). Cette page
          a une vocation informative uniquement. KOVAS n’est pas opérateur de
          MaPrimeRénov. Pour toute démarche officielle, rendez-vous sur{' '}
          <a
            href="https://www.maprimerenov.gouv.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline underline-offset-4"
          >
            maprimerenov.gouv.fr
          </a>
          .
        </p>
      </div>
    </ProgrammaticShell>
  )
}
