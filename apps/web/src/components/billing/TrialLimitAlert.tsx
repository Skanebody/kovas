'use client'

/**
 * <TrialLimitAlert> — Bandeau gracieux affiché lorsqu'une limite de l'essai
 * gratuit 30 jours est atteinte (mission, Whisper, Vision, chat Claude).
 *
 * Tokens v5 strict : sage / paper / chartreuse, font Urbanist + Instrument Serif
 * italique sur l'accroche. Pas d'emoji marketing, ton sobre professionnel
 * (cf. CLAUDE.md §21bis "vouvoiement" + "rapport business sobre").
 *
 * Usage typique :
 *   const verdict = await checkTrialLimit(...)
 *   if (verdict.kind === 'limit_reached') {
 *     return <TrialLimitAlert message={verdict.message} ctaHref={verdict.ctaHref} />
 *   }
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AlertOctagon, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export interface TrialLimitAlertProps {
  /** Message complet (déjà localisé en FR par `checkTrialLimit`). */
  message: string
  /** Lien upgrade. Défaut: /dashboard/upgrade/logiciel. */
  ctaHref?: string
  /** Label du bouton CTA. */
  ctaLabel?: string
  className?: string
}

export function TrialLimitAlert({
  message,
  ctaHref = '/dashboard/upgrade/logiciel',
  ctaLabel = 'Voir les forfaits payants',
  className,
}: TrialLimitAlertProps) {
  return (
    <Card variant="opaque" padding="default" className={className}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex shrink-0 items-center justify-center size-9 rounded-md bg-warning/15"
          >
            <AlertOctagon className="size-4 text-ink" strokeWidth={1.75} />
          </span>
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-ink-mute">
              Essai gratuit 30 jours
            </p>
            <p className="text-[14px] leading-snug text-ink">
              <span className="font-serif italic text-ink">Limite atteinte.</span> {message}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <Button variant="accent" size="sm" asChild>
            <Link href={ctaHref}>
              {ctaLabel}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  )
}
