/**
 * Cancellation — Step 4 : Confirmation finale + Calendly optionnel.
 *
 * Server component. Affiche le récap : résiliation enregistrée, date effective,
 * email envoyé. Propose un créneau Calendly customer success (15 min) — option
 * RH, jamais bloquante. Aucun numéro WhatsApp personnel exposé (spec).
 *
 * Le tracking calendly_link_shown_at est posé par le wrapper page lors du
 * rendering quand step=4 et calendly URL configurée.
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft, CalendarClock, CheckCircle2, Mail } from 'lucide-react'
import Link from 'next/link'

interface Step4Props {
  effectiveEndDate: string | null
  userEmail: string
  calendlyUrl: string | null
}

function formatFr(date: string | null): string {
  if (!date) return 'fin de la période en cours'
  try {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return 'fin de la période en cours'
  }
}

export function CancellationStep4({ effectiveEndDate, userEmail, calendlyUrl }: Step4Props) {
  return (
    <div className="space-y-6">
      <Card variant="opaque" padding="lg" className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-full bg-accent-green/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="size-6 text-accent-green" />
          </div>
          <div className="space-y-2 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Votre résiliation est{' '}
              <span className="font-serif italic font-normal">enregistrée</span>
            </h1>
            <p className="text-sm text-ink-mute">
              Aucune nouvelle facturation ne sera effectuée. Vous conservez l&apos;accès
              complet à KOVAS jusqu&apos;au{' '}
              <strong className="text-ink">{formatFr(effectiveEndDate)}</strong>.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-rule bg-paper p-4 flex items-start gap-3">
          <Mail className="size-4 text-ink-mute mt-0.5 shrink-0" />
          <div className="text-xs space-y-1">
            <p className="text-ink">
              Un email de confirmation a été envoyé à{' '}
              <strong className="text-ink">{userEmail}</strong>.
            </p>
            <p className="text-ink-mute">
              Après expiration de votre abonnement, votre compte bascule 90 jours en mode
              lecture et export complet (PDF, Word, CSV, JSON, ZIP Liciel). Vos factures
              restent conservées 10 ans.
            </p>
          </div>
        </div>
      </Card>

      {calendlyUrl && (
        <Card variant="warm" padding="default" className="space-y-4">
          <div className="flex items-start gap-3">
            <CalendarClock className="size-5 text-ink mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h2 className="text-base font-bold text-ink">
                15 minutes pour ajuster votre offre ?
              </h2>
              <p className="text-xs text-ink-soft">
                Si vous souhaitez en discuter avec un expert KOVAS — pour identifier une
                formule mieux adaptée ou simplement nous faire un retour structuré — nous
                serions ravis d&apos;échanger. Aucune obligation, aucune relance ensuite.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild variant="default" className="flex-1">
              <a href={calendlyUrl} target="_blank" rel="noopener noreferrer">
                Réserver un créneau
              </a>
            </Button>
          </div>
        </Card>
      )}

      <div className="pt-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/dashboard">
            <ArrowLeft className="size-4" /> Retour à l&apos;application
          </Link>
        </Button>
      </div>
    </div>
  )
}
