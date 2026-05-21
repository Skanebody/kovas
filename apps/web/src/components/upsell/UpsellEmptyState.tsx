'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getUpsellEntry } from '@/lib/upsell/upsell-content'
import { ArrowRight, Lock, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { UpsellModal } from './UpsellModal'

export interface UpsellEmptyStateProps {
  /** Code addon / pack / tier suggéré. */
  target: string
  /** Contexte d'origine (analytics_attempted, cockpit_m2_attempted...). Tracking. */
  trigger?: string
  /** Override de titre si on veut être plus contextuel que le catalog. */
  title?: string
  /** Override de description. */
  description?: string
  className?: string
}

/**
 * Empty state d'upsell sobre — affiché à la place d'un module gated.
 *
 * Layout :
 *   - Header sage avec icône Lock + tag mono "Non inclus"
 *   - Titre Instrument Serif italic
 *   - Description factuelle
 *   - Liste 3 bénéfices
 *   - CTA primary chartreuse "Démarrer mon essai 14j"
 */
export function UpsellEmptyState({ target, trigger, title, description, className }: UpsellEmptyStateProps) {
  const entry = getUpsellEntry(target)
  const [modalOpen, setModalOpen] = useState(false)

  if (!entry) {
    return null
  }

  return (
    <>
      <Card variant="opaque" padding="none" className={className}>
        <div className="flex items-center justify-between gap-3 border-b border-rule/60 px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-ink">
            <span className="text-ink-mute">·</span> {entry.title}
          </p>
          <span className="font-mono text-[10px] text-ink-mute tracking-[0.08em] uppercase inline-flex items-center gap-1">
            <Lock className="size-3" aria-hidden /> Non inclus
          </span>
        </div>

        <div className="flex flex-col gap-5 p-5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="size-12 rounded-md bg-chartreuse/15 flex items-center justify-center shrink-0"
            >
              <Sparkles className="size-5 text-[#0F1419]" />
            </span>
            <div className="space-y-1">
              <p className="font-serif italic text-2xl text-ink leading-tight">
                {title ?? entry.title}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
                {entry.priceLabel} · {entry.trialLabel}
              </p>
            </div>
          </div>

          <p className="text-[13px] text-ink-mute leading-relaxed">
            {description ?? entry.description}
          </p>

          <ul className="space-y-1.5">
            {entry.benefits.map((b) => (
              <li key={b} className="flex items-start gap-2 text-[13px] text-ink">
                <span aria-hidden className="text-ink-mute mt-0.5">→</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <Button
            variant="accent"
            size="default"
            className="w-full sm:w-auto self-start"
            onClick={() => setModalOpen(true)}
          >
            {entry.ctaPrimary}
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </Card>

      <UpsellModal target={target} trigger={trigger} open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}
