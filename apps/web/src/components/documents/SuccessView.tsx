'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, ScanLine } from 'lucide-react'

interface SuccessViewProps {
  /** Stats issues du PrefillResult ou d'un save simple. */
  stats: {
    autoValidated: number
    pendingReview: number
    ignored: number
  }
  onClose: () => void
  onScanAnother: () => void
  className?: string
}

/**
 * Vue finale du flow document — stats + 2 CTA (Fermer / Scanner un autre).
 */
export function SuccessView({ stats, onClose, onScanAnother, className }: SuccessViewProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-6 py-10 px-6 text-center',
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-16 items-center justify-center rounded-full bg-chartreuse/30 text-navy shadow-glass-sm"
      >
        <Check className="size-8" strokeWidth={2} />
      </span>

      <div className="space-y-2">
        <h3 className="font-serif italic font-normal text-2xl text-ink">Document traité</h3>
        <p className="text-sm text-ink-mute max-w-sm">
          {stats.autoValidated} champ{stats.autoValidated > 1 ? 's' : ''} auto-validé
          {stats.autoValidated > 1 ? 's' : ''} · {stats.pendingReview} à vérifier · {stats.ignored}{' '}
          ignoré
          {stats.ignored > 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button type="button" variant="accent" size="lg" onClick={onScanAnother}>
          <ScanLine className="size-4" />
          Scanner un autre document
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  )
}
