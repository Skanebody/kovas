'use client'

import { cn } from '@/lib/utils'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import type { FacturationTab } from './types'

const TABS: { id: FacturationTab; label: string }[] = [
  { id: 'devis', label: 'Devis' },
  { id: 'factures', label: 'Factures' },
  { id: 'tarifs', label: 'Tarifs' },
]

interface FacturationTabsProps {
  current: FacturationTab
}

/**
 * Navigation tabs Facturation — pattern Qonto unifié.
 * Pillule active = navy (bg-cta) + paper, inactive = ink-mute hover ink.
 * Préserve les autres searchParams (filter, client_id, etc.).
 */
export function FacturationTabs({ current }: FacturationTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setTab = useCallback(
    (tab: FacturationTab) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set('tab', tab)
      // Reset des filtres spécifiques quand on change d'onglet.
      params.delete('status')
      params.delete('filter')
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return (
    <div
      role="tablist"
      aria-label="Sous-sections Facturation"
      className="inline-flex items-center gap-1 rounded-pill border border-rule bg-paper/80 p-1 shadow-glass-xs"
    >
      {TABS.map((t) => {
        const active = t.id === current
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-pill px-4 py-1.5 text-[13px] font-medium transition-colors duration-fast',
              active
                ? 'bg-navy text-paper shadow-accent'
                : 'text-ink-mute hover:text-ink hover:bg-ink/5',
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
