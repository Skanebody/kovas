/**
 * KOVAS — PackSuggestion
 *
 * Card chartreuse-soft signalant qu'un pack est applicable à la sélection de
 * diagnostics courante. Bouton "Utiliser ce pack" déclenche `onApply`.
 *
 * Usage : poussé au-dessus du breakdown quand `detectApplicablePack` retourne
 * un pack pertinent qui n'a pas encore été appliqué dans le devis.
 */

'use client'

import { Button } from '@/components/ui/button'
import type { ApplicablePack } from '@/lib/pricing/pack-detector'
import { cn } from '@/lib/utils'
import { Sparkles } from 'lucide-react'

interface PackSuggestionProps {
  pack: ApplicablePack
  onApply: () => void
  className?: string
  /** Label custom du bouton. Défaut : "Utiliser ce pack". */
  ctaLabel?: string
  /** Désactive l'action (ex: déjà appliqué). */
  applied?: boolean
}

function formatEur(amount: number): string {
  if (Number.isInteger(amount)) return `${amount} €`
  return `${amount.toFixed(2).replace('.', ',')} €`
}

function formatPercent(percent: number): string {
  if (Number.isInteger(percent)) return `${percent}%`
  return `${percent.toFixed(1).replace('.', ',')}%`
}

export function PackSuggestion({
  pack,
  onApply,
  className,
  ctaLabel,
  applied,
}: PackSuggestionProps) {
  return (
    <div
      className={cn(
        'rounded-lg bg-chartreuse-soft border border-chartreuse-deep/20 p-4 space-y-3',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex size-8 items-center justify-center rounded-full bg-chartreuse text-ink shrink-0"
        >
          <Sparkles className="size-4" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
            Pack applicable
          </p>
          <p className="text-[14px] font-semibold text-ink leading-snug">{pack.packName}</p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="font-serif italic text-3xl text-ink leading-none tracking-tight tabular-nums">
            {formatEur(pack.packPriceHt)}
          </span>
          {pack.savingsVsItemized > 0 && (
            <span className="text-[12px] font-semibold text-ink">
              −{formatEur(pack.savingsVsItemized)} ({formatPercent(pack.savingsPercent)})
            </span>
          )}
        </div>
        <p className="text-[11px] text-ink-mute">Économie vs prix à l'unité — prix HT indicatif.</p>
      </div>

      <Button
        variant="accent"
        size="sm"
        onClick={onApply}
        disabled={applied}
        className="w-full sm:w-auto"
      >
        {ctaLabel ?? (applied ? 'Pack appliqué' : 'Utiliser ce pack')}
      </Button>
    </div>
  )
}
