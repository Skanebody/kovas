'use client'

import {
  CheckCircle2,
  Circle,
  Clock,
  Mail,
  MapPin,
  Phone,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'
import type {
  TimelineRecipientView,
  TimelineResponse,
} from '@/app/api/quote-requests/[token]/timeline/route'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DIAGNOSTIC_LABEL, type DiagnosticCode } from '@/lib/quote-request/diagnostics'

interface QuoteRequestTimelineProps {
  timeline: TimelineResponse
}

type StatusVisual = {
  label: string
  variant: 'pending' | 'responded' | 'declined' | 'late'
  icon: 'circle' | 'check' | 'cross' | 'clock'
}

function statusVisual(status: TimelineRecipientView['status']): StatusVisual {
  switch (status) {
    case 'responded':
      return { label: 'A répondu', variant: 'responded', icon: 'check' }
    case 'declined':
      return { label: 'Indisponible', variant: 'declined', icon: 'cross' }
    case 'expired':
    case 'ignored':
      return { label: 'Pas de réponse', variant: 'late', icon: 'clock' }
    case 'opened':
      return { label: 'Email ouvert', variant: 'late', icon: 'clock' }
    case 'sent':
    default:
      return { label: 'En attente', variant: 'pending', icon: 'circle' }
  }
}

function StatusBadge({ visual }: { visual: StatusVisual }) {
  const classes =
    visual.variant === 'responded'
      ? 'bg-pastel-lime text-ink border-success/30'
      : visual.variant === 'declined'
        ? 'bg-cream-deep text-ink-mute border-rule'
        : visual.variant === 'late'
          ? 'bg-pastel-butter text-ink border-amber/30'
          : 'bg-pastel-sky text-ink border-blue-500/20'

  const Icon =
    visual.icon === 'check'
      ? CheckCircle2
      : visual.icon === 'cross'
        ? XCircle
        : visual.icon === 'clock'
          ? Clock
          : Circle

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11px] font-medium ${classes}`}
    >
      <Icon className="size-3" aria-hidden />
      {visual.label}
    </span>
  )
}

export function QuoteRequestTimeline({ timeline }: QuoteRequestTimelineProps) {
  const responded = useMemo(
    () => timeline.recipients.filter((r) => r.status === 'responded').length,
    [timeline.recipients],
  )
  const totalSent = timeline.recipients.length

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] tracking-wider uppercase text-ink-faint font-medium mb-1">
          Votre demande de devis
        </p>
        <h1 className="text-[28px] font-bold text-ink mb-2">
          Bonjour {timeline.requesterFirstName},
        </h1>
        <p className="text-[14px] text-ink-mute leading-relaxed">
          Voici le suivi de votre demande
          {timeline.propertyCity ? ` à ${timeline.propertyCity}` : ''}.{' '}
          {responded > 0
            ? `${responded} diagnostiqueur${responded > 1 ? 's ont' : ' a'} déjà répondu.`
            : 'Les diagnostiqueurs vous répondront sous 24-48 heures.'}
        </p>
      </header>

      <Card variant="opaque" padding="default">
        <h2 className="text-[14px] font-semibold text-ink mb-3">
          Diagnostics demandés
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {timeline.diagnosticsRequested.map((d) => (
            <span
              key={d}
              className="inline-block rounded-pill bg-pastel-butter/60 px-3 py-1 text-[12px] font-medium text-ink"
            >
              {DIAGNOSTIC_LABEL[d as DiagnosticCode] ?? d}
            </span>
          ))}
        </div>
      </Card>

      <section aria-labelledby="recipients-heading">
        <div className="flex items-baseline justify-between mb-3">
          <h2 id="recipients-heading" className="text-[16px] font-bold text-ink">
            Diagnostiqueurs contactés ({totalSent})
          </h2>
          <span className="text-[12px] text-ink-faint font-mono">
            {responded} réponse{responded !== 1 ? 's' : ''}
          </span>
        </div>

        {timeline.recipients.length === 0 ? (
          <Card variant="opaque" padding="default" className="text-center text-ink-mute text-[13px]">
            Votre demande est en cours de routage. Patientez quelques instants.
          </Card>
        ) : (
          <ul className="space-y-3">
            {timeline.recipients.map((r) => {
              const visual = statusVisual(r.status)
              const hasResponse = r.diagnostician.has_response
              return (
                <li key={r.id}>
                  <Card
                    variant="opaque"
                    padding="default"
                    className={hasResponse ? 'border-success/30' : undefined}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-[15px] font-semibold text-ink">
                            {r.diagnostician.display_name}
                          </h3>
                          <StatusBadge visual={visual} />
                        </div>
                        {r.diagnostician.city && (
                          <p className="text-[12px] text-ink-mute inline-flex items-center gap-1">
                            <MapPin className="size-3" aria-hidden />
                            {r.diagnostician.city}
                          </p>
                        )}

                        {hasResponse && (
                          <div className="mt-3 grid gap-1.5 text-[13px]">
                            {r.diagnostician.contact_email && (
                              <a
                                href={`mailto:${r.diagnostician.contact_email}`}
                                className="inline-flex items-center gap-2 text-navy hover:underline"
                              >
                                <Mail className="size-3.5" aria-hidden />
                                {r.diagnostician.contact_email}
                              </a>
                            )}
                            {r.diagnostician.contact_phone && (
                              <a
                                href={`tel:${r.diagnostician.contact_phone}`}
                                className="inline-flex items-center gap-2 text-navy hover:underline"
                              >
                                <Phone className="size-3.5" aria-hidden />
                                {r.diagnostician.contact_phone}
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      {r.diagnostician.public_url && (
                        <Link
                          href={r.diagnostician.public_url}
                          className="shrink-0 text-[12px] font-medium text-navy underline hover:no-underline"
                        >
                          Voir la fiche
                        </Link>
                      )}
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="actions-heading" className="pt-4">
        <h2 id="actions-heading" className="sr-only">
          Actions complémentaires
        </h2>
        <Card variant="warm" padding="default">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[14px] font-semibold text-ink mb-1">
                Pas assez de réponses ?
              </p>
              <p className="text-[12px] text-ink-mute">
                Élargissez la recherche à 3 diagnostiqueurs supplémentaires.
              </p>
            </div>
            <Button variant="outline" size="default">
              Demander à plus de diagnostiqueurs
            </Button>
          </div>
        </Card>
      </section>

      <p className="text-[11px] text-ink-faint text-center pt-4">
        Référence — {timeline.trackingToken.slice(0, 8)}… · Conservez cet email pour
        consulter votre suivi ultérieurement.
      </p>
    </div>
  )
}
