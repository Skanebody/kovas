import { DemoForm } from '@/components/public/pros/DemoForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowRight, Calendar, Clock, Headset } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Demander une démo',
  description:
    'Réservez une démo personnalisée de KOVAS avec un membre de notre équipe. Réponse sous 48h ouvrées, démo planifiée selon vos disponibilités.',
}

export default function DemoPage() {
  return (
    <div className="px-6 py-16">
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
        </div>
      </div>
    </div>
  )
}
