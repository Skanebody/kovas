import { DemoForm } from '@/components/public/pros/DemoForm'
import { JsonLd } from '@/components/seo/JsonLd'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { buildMetadata } from '@/lib/seo/metadata'
import { KOVAS_BASE_URL, buildBreadcrumbList } from '@/lib/seo/schema-org'
import { ArrowRight, Calendar, Clock, Headset } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = buildMetadata({
  title: 'Démo KOVAS personnalisée pour diagnostiqueur immobilier | KOVAS',
  description:
    'Réservez votre démo KOVAS personnalisée en visio 45 min avec un membre de l’équipe. Démonstration adaptée à votre cabinet et votre logiciel actuel. Réponse sous 48 h ouvrées.',
  path: '/demo',
  ogImage: '/og-images/demo.png',
})

export default function DemoPage() {
  const breadcrumb = buildBreadcrumbList([
    { name: 'Accueil', path: '/' },
    { name: 'Démo personnalisée', path: '/demo' },
  ])

  const webPageSchema = {
    '@context': 'https://schema.org' as const,
    '@type': 'WebPage' as const,
    '@id': `${KOVAS_BASE_URL}/demo#webpage`,
    url: `${KOVAS_BASE_URL}/demo`,
    name: 'Démo KOVAS personnalisée pour diagnostiqueur immobilier',
    description:
      "Réservez une démo personnalisée de KOVAS en visio (45 min) avec un membre de l'équipe.",
    inLanguage: 'fr-FR' as const,
    isPartOf: { '@id': `${KOVAS_BASE_URL}/#website` },
    primaryImageOfPage: {
      '@type': 'ImageObject' as const,
      url: `${KOVAS_BASE_URL}/og-images/demo.png`,
    },
    potentialAction: {
      '@type': 'ReserveAction' as const,
      name: 'Réserver une démo',
      target: `${KOVAS_BASE_URL}/demo`,
    },
  }

  return (
    <div className="px-6 py-16">
      <JsonLd data={[webPageSchema, breadcrumb]} id="demo" />
      <div className="mx-auto max-w-5xl space-y-12">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Badge variant="muted">Démo personnalisée</Badge>
          <h1 className="font-display text-display-m font-light tracking-tight text-ink sm:text-display-l">
            Voir KOVAS en{' '}
            <span className="text-display-serif text-chartreuse-deep">situation réelle</span>
          </h1>
          <p className="text-ink-mute">
            45 minutes en visio avec un membre de notre équipe. Démonstration adaptée à votre
            cabinet, vos diagnostics types, votre logiciel actuel.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card variant="opaque" padding="sm" className="space-y-2">
            <Calendar className="size-5 text-ink-mute" />
            <h2 className="text-base font-semibold leading-tight">48h ouvrées</h2>
            <p className="text-sm text-ink-mute">
              Délai de planification garanti à compter de votre demande.
            </p>
          </Card>
          <Card variant="opaque" padding="sm" className="space-y-2">
            <Clock className="size-5 text-ink-mute" />
            <h2 className="text-base font-semibold leading-tight">45 minutes</h2>
            <p className="text-sm text-ink-mute">
              Durée standard, ajustable selon vos questions. Présentation puis Q&amp;R.
            </p>
          </Card>
          <Card variant="opaque" padding="sm" className="space-y-2">
            <Headset className="size-5 text-ink-mute" />
            <h2 className="text-base font-semibold leading-tight">Sans engagement</h2>
            <p className="text-sm text-ink-mute">
              Aucune obligation à l&apos;issue de la démo. Vous repartez avec vos questions
              répondues.
            </p>
          </Card>
        </div>

        <Card variant="opaque" padding="lg" className="mx-auto max-w-3xl">
          <DemoForm />
        </Card>

        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <h2 className="text-xl font-semibold tracking-tight">
            Pas le temps d&apos;attendre une démo ?
          </h2>
          <p className="text-ink-mute">
            Vous pouvez tester KOVAS gratuitement pendant 30 jours, sans assistance commerciale.
            Carte bancaire à l&apos;inscription, aucun débit avant J+30.
          </p>
          <Button size="lg" variant="outline" asChild>
            <Link href="/signup">
              Essayez gratuitement 30 jours <ArrowRight className="size-4" />
            </Link>
          </Button>
          <p className="pt-4 text-sm text-ink-mute">
            Voir aussi les{' '}
            <Link href="/tarifs" className="underline underline-offset-2 hover:text-ink">
              tarifs détaillés
            </Link>
            , le{' '}
            <Link href="/comparatif" className="underline underline-offset-2 hover:text-ink">
              comparatif Liciel
            </Link>{' '}
            ou les{' '}
            <Link href="/temoignages" className="underline underline-offset-2 hover:text-ink">
              témoignages diagnostiqueurs
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
