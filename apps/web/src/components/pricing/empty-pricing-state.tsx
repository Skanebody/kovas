/**
 * KOVAS — EmptyPricingState
 *
 * Affiché quand `PricingEstimate.hasPricingConfigured === false`.
 * Pousse l'utilisateur vers /app/compte/tarifs pour initialiser sa grille.
 *
 * Pattern v5 : box border-dashed sage, microcopy sobre, lien chartreuse.
 */

import { cn } from '@/lib/utils'
import { Settings2 } from 'lucide-react'
import Link from 'next/link'

interface EmptyPricingStateProps {
  className?: string
  /** Microcopy custom. Par défaut : invitation neutre à configurer ses tarifs. */
  message?: string
}

export function EmptyPricingState({ className, message }: EmptyPricingStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-3 py-6 px-5',
        'rounded-lg border border-dashed border-rule bg-paper/40',
        className,
      )}
    >
      <div
        aria-hidden
        className="flex size-10 items-center justify-center rounded-full bg-cream-deep text-ink-mute"
      >
        <Settings2 className="size-4" strokeWidth={1.75} />
      </div>
      <p className="text-[13px] text-ink-mute max-w-xs leading-relaxed">
        {message ?? 'Configure tes tarifs pour afficher le prix indicatif.'}
      </p>
      <Link
        href="/app/compte/tarifs"
        className="text-[12px] font-semibold text-ink underline underline-offset-4 decoration-chartreuse-deep hover:decoration-2"
      >
        Configurer mes tarifs →
      </Link>
    </div>
  )
}
