'use client'

import type { DashboardMode } from '@/lib/dashboard-mode'
import { resolveDashboardMode } from '@/lib/dashboard-mode'
import { cn } from '@/lib/utils'
import { Clock, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export type { DashboardMode } from '@/lib/dashboard-mode'

const STORAGE_KEY = 'kovas_dashboard_mode'

export function useDashboardMode(): {
  mode: DashboardMode
  effective: 'morning' | 'evening'
  hydrated: boolean
  setMode: (m: DashboardMode) => void
  cycle: () => void
} {
  const [mode, setModeState] = useState<DashboardMode>('auto')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as DashboardMode | null
    if (stored && ['morning', 'evening', 'auto'].includes(stored)) {
      setModeState(stored)
    }
    setHydrated(true)
  }, [])

  function setMode(next: DashboardMode) {
    setModeState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  function cycle() {
    const next: DashboardMode = mode === 'auto' ? 'morning' : mode === 'morning' ? 'evening' : 'auto'
    setMode(next)
  }

  return { mode, effective: resolveDashboardMode(mode), hydrated, setMode, cycle }
}

interface DashboardModeToggleProps {
  className?: string
}

export function DashboardModeToggle({ className }: DashboardModeToggleProps) {
  const { mode, effective, cycle } = useDashboardMode()

  const label =
    mode === 'auto'
      ? `Auto (${effective === 'morning' ? 'matin' : 'soir'})`
      : mode === 'morning'
        ? 'Matin'
        : 'Soir'
  const Icon = mode === 'auto' ? Clock : mode === 'morning' ? Sun : Moon

  return (
    <button
      type="button"
      onClick={cycle}
      className={cn(
        'inline-flex items-center gap-2 rounded-pill border border-rule bg-paper px-3 py-1.5',
        'text-xs font-medium text-ink-soft hover:bg-cream-deep hover:border-rule',
        'transition-colors duration-base',
        className,
      )}
      title="Basculer matin / soir / auto"
      aria-label={`Mode dashboard : ${label}. Cliquer pour changer.`}
    >
      <Icon className="size-3.5 shrink-0" />
      <span suppressHydrationWarning>{label}</span>
    </button>
  )
}
