'use client'

import { cn } from '@/lib/utils'
import { Clock, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export type DashboardMode = 'morning' | 'evening' | 'auto'

const STORAGE_KEY = 'kovas_dashboard_mode'

/**
 * Heure de bascule matin → soir (auto mode).
 * Avant 14h Paris → matin, après → soir.
 */
const EVENING_HOUR_PARIS = 14

function isEveningParis(date: Date): boolean {
  const parisHour = Number.parseInt(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      hour: 'numeric',
      hour12: false,
    }).format(date),
    10,
  )
  return parisHour >= EVENING_HOUR_PARIS
}

/**
 * Resolveur d'état effectif à partir du mode utilisateur + heure courante.
 * `auto` = matin avant 14h Paris, soir après.
 */
export function resolveDashboardMode(mode: DashboardMode, now: Date = new Date()): 'morning' | 'evening' {
  if (mode === 'morning') return 'morning'
  if (mode === 'evening') return 'evening'
  return isEveningParis(now) ? 'evening' : 'morning'
}

/**
 * Hook React pour récupérer le mode courant (lecture localStorage + state).
 * Côté serveur : retourne 'auto' (résolu côté client après hydration).
 */
export function useDashboardMode(): {
  mode: DashboardMode
  effective: 'morning' | 'evening'
  setMode: (m: DashboardMode) => void
  cycle: () => void
} {
  const [mode, setModeState] = useState<DashboardMode>('auto')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as DashboardMode | null
    if (stored && ['morning', 'evening', 'auto'].includes(stored)) {
      setModeState(stored)
    }
  }, [])

  function setMode(next: DashboardMode) {
    setModeState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  function cycle() {
    const next: DashboardMode = mode === 'auto' ? 'morning' : mode === 'morning' ? 'evening' : 'auto'
    setMode(next)
  }

  return { mode, effective: resolveDashboardMode(mode), setMode, cycle }
}

interface DashboardModeToggleProps {
  className?: string
}

/**
 * Toggle 3 états : auto (icône horloge), matin (soleil), soir (lune).
 * Cycle sur click. Persiste en localStorage.
 */
export function DashboardModeToggle({ className }: DashboardModeToggleProps) {
  const { mode, effective, cycle } = useDashboardMode()

  const label = mode === 'auto' ? `Auto (${effective === 'morning' ? 'matin' : 'soir'})` : mode === 'morning' ? 'Matin' : 'Soir'
  const Icon = mode === 'auto' ? Clock : mode === 'morning' ? Sun : Moon

  return (
    <button
      type="button"
      onClick={cycle}
      className={cn(
        'inline-flex items-center gap-2 rounded-pill border border-border-soft bg-paper px-3 py-1.5',
        'text-xs font-medium text-ink-soft hover:bg-cream-deep hover:border-border',
        'transition-colors duration-base',
        className,
      )}
      title="Basculer matin / soir / auto"
      aria-label={`Mode dashboard : ${label}. Cliquer pour changer.`}
    >
      <Icon className="size-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  )
}
