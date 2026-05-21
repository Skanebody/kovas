'use client'

import { cn } from '@/lib/utils'

export type BillingCycle = 'monthly' | 'annual'

interface PricingToggleProps {
  value: BillingCycle
  onChange: (cycle: BillingCycle) => void
  /** Permet l'inversion de palette (sombre sur clair vs clair sur sombre). */
  variant?: 'light' | 'dark'
  /** Optionnel : libellé accessible distinct du label visible. */
  ariaLabel?: string
  className?: string
}

/**
 * Toggle mensuel / annuel — réutilisable sur `/pricing`, page calculator,
 * banner upgrade. Badge "2 mois offerts" en chartreuse lors de l'option
 * annuelle.
 *
 * State local non géré ici (composant contrôlé). Le parent persiste si besoin.
 */
export function PricingToggle({
  value,
  onChange,
  variant = 'light',
  ariaLabel = 'Période de facturation',
  className,
}: PricingToggleProps) {
  const isDark = variant === 'dark'
  return (
    <div className={cn('text-center mx-auto max-w-xl', className)}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          'inline-flex rounded-full p-1 gap-1 border',
          isDark
            ? 'bg-white/[0.06] border-white/15'
            : 'bg-white border-[#0F1419]/[0.08]',
        )}
      >
        <button
          type="button"
          role="tab"
          aria-selected={value === 'monthly'}
          onClick={() => onChange('monthly')}
          className={cn(
            'px-5 py-2.5 rounded-full text-sm font-medium transition-colors duration-150',
            value === 'monthly'
              ? isDark
                ? 'bg-white text-[#0F1419]'
                : 'bg-[#0F1419] text-white'
              : isDark
                ? 'text-white/72 hover:text-white'
                : 'text-[#0F1419]/55 hover:text-[#0F1419]',
          )}
        >
          Mensuel
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={value === 'annual'}
          onClick={() => onChange('annual')}
          className={cn(
            'px-5 py-2.5 rounded-full text-sm font-medium transition-colors duration-150 inline-flex items-center gap-2',
            value === 'annual'
              ? isDark
                ? 'bg-white text-[#0F1419]'
                : 'bg-[#0F1419] text-white'
              : isDark
                ? 'text-white/72 hover:text-white'
                : 'text-[#0F1419]/55 hover:text-[#0F1419]',
          )}
        >
          Annuel
          <span className="bg-chartreuse text-[#0F1419] font-mono text-[10px] uppercase tracking-[0.08em] font-bold px-2 py-0.5 rounded-full">
            2 mois offerts
          </span>
        </button>
      </div>
      <p
        className={cn(
          'mt-3 text-[13px] leading-normal',
          isDark ? 'text-white/72' : 'text-[#0F1419]/55',
        )}
      >
        Mensuel : résiliable à tout moment. Annuel : 10 mois payés sur 12.
      </p>
    </div>
  )
}
