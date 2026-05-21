'use client'

import { cn } from '@/lib/utils'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

type Period = 'day' | 'week' | 'month' | 'year' | 'custom'

interface PeriodSelectorProps {
  /** Période active courante (lue par le parent depuis searchParams). */
  current: Period
}

const OPTIONS: Array<{ id: Period; label: string }> = [
  { id: 'day', label: 'Jour' },
  { id: 'week', label: '7 jours' },
  { id: 'month', label: 'Mois' },
  { id: 'year', label: 'Année' },
  { id: 'custom', label: 'Personnalisé' },
]

/**
 * Segmented control style Apple Santé — filtre période page Performance.
 * État synchronisé via query param `?period=month`. Default = mois.
 *
 * Style DS v5 sobre : pill noir bleuté #0F1419 sur option active, gris très
 * pâle sur inactives, transitions douces 200ms. Pas de focus ring agressif.
 */
export function PeriodSelector({ current }: PeriodSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handleChange = (next: Period) => {
    const url = new URLSearchParams(params.toString())
    if (next === 'month') {
      url.delete('period')
    } else {
      url.set('period', next)
    }
    const qs = url.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  return (
    <div
      role="tablist"
      aria-label="Filtrer la période"
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border border-rule/60 bg-paper p-1',
        isPending && 'opacity-70',
      )}
    >
      {OPTIONS.map((opt) => {
        const active = opt.id === current
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => handleChange(opt.id)}
            disabled={opt.id === 'custom'}
            className={cn(
              'rounded-pill px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-200',
              active
                ? 'bg-[#0F1419] text-paper'
                : 'text-ink/55 hover:text-ink',
              opt.id === 'custom' && 'opacity-40 cursor-not-allowed',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export type { Period }
