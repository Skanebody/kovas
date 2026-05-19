import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type AppBackground = 'light' | 'cyan' | 'navy' | 'cream'

const BG: Record<AppBackground, string> = {
  light: 'bg-fluid-light',
  cyan: 'bg-fluid-cyan',
  navy: 'bg-fluid-navy',
  cream: 'bg-cream',
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
