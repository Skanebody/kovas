'use client'

import { cn } from '@/lib/utils'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import {
  DEVIS_STATUS_LABELS,
  type DevisStatus,
  FACTURE_STATUS_LABELS,
  type FacturationTab,
  type FactureStatus,
} from './types'

interface FacturationFiltersProps {
  current: FacturationTab
}

/**
 * Filtres rapides par statut (chips pillule).
 * Synchronisé sur le query param `status`. Tab Tarifs : pas de filtre statut.
 */
export function FacturationFilters({ current }: FacturationFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selected = searchParams?.get('status') ?? null

  const setStatus = useCallback(
    (status: string | null) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      if (status) {
        params.set('status', status)
      } else {
        params.delete('status')
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  if (current === 'tarifs') return null

  const statuses =
    current === 'devis'
      ? (Object.entries(DEVIS_STATUS_LABELS) as [DevisStatus, string][])
      : (Object.entries(FACTURE_STATUS_LABELS) as [FactureStatus, string][])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setStatus(null)}
        className={cn(
          'rounded-pill px-3 py-1 text-[12px] font-medium transition-colors border',
          selected === null
            ? 'bg-navy text-paper border-navy'
            : 'border-rule text-ink-mute hover:text-ink hover:bg-ink/5',
        )}
      >
        Tous
      </button>
      {statuses.map(([key, label]) => {
        const active = selected === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            className={cn(
              'rounded-pill px-3 py-1 text-[12px] font-medium transition-colors border',
              active
                ? 'bg-navy text-paper border-navy'
                : 'border-rule text-ink-mute hover:text-ink hover:bg-ink/5',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
