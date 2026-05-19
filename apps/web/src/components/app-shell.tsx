import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type AppBackground = 'light' | 'cyan' | 'navy' | 'cream'

/**
 * Backgrounds AppShell v5 — Clear sage par défaut, Drama opt-in.
 * Spec v5 §3 : Drama UNIQUEMENT 3 contextes (dashboard soir / mode mission /
 * landing marketing). Pour l'app prod générale → 'light' rend sage `#F5F7F4`.
 */
const BG: Record<AppBackground, string> = {
  light: 'bg-sage', // v5 : était bg-fluid-light Drama cyan, maintenant sage Clear
  cyan: 'bg-fluid-cyan', // Drama landing kovas.fr seulement
  navy: 'bg-fluid-navy', // Drama dashboard soir + mode mission seulement
  cream: 'bg-sage', // alias rétrocompat — pointe vers sage v5
}

export function AppShell({
  background = 'light',
  className,
  children,
}: {
  background?: AppBackground
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('min-h-full', BG[background], className)}>{children}</div>
  )
}
