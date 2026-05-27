'use client'

import { Button } from '@/components/ui/button'
import type { DossierHeroSummary, DossierVisualState } from '@/lib/dossier/types'
import { cn } from '@/lib/utils'
import { Activity, Calendar, CheckCheck, Download, Play } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { type DossierMenuItem, DossierStickyMenu } from './DossierStickyMenu'

interface DossierStickyBarProps {
  dossierId: string
  state: DossierVisualState
  summary: DossierHeroSummary
  /** Override des items du menu ⋯ (sinon défauts via DossierStickyMenu). */
  menuItems?: DossierMenuItem[]
  /** Override du href du bouton primaire (sinon : /mission ou ancre #export-section). */
  primaryHref?: string
  /** Override du handler primaire (priorité sur primaryHref). */
  onPrimary?: () => void
  className?: string
}

interface PrimaryConfig {
  label: string
  icon: ReactNode
  variant: 'accent' | 'default'
  defaultHref: string
}

const PRIMARY_BY_STATE: Record<DossierVisualState, PrimaryConfig> = {
  'to-start': {
    label: 'Démarrer',
    icon: <Play className="size-4" />,
    variant: 'accent',
    defaultHref: '',
  },
  'in-progress': {
    label: 'Reprendre',
    icon: <Play className="size-4" />,
    variant: 'accent',
    defaultHref: '',
  },
  completed: {
    label: 'Exporter',
    icon: <Download className="size-4" />,
    variant: 'default',
    defaultHref: '#export-section',
  },
}

interface MainCopy {
  icon: ReactNode
  title: string
}

function mainCopyFor(state: DossierVisualState, summary: DossierHeroSummary): MainCopy {
  if (state === 'to-start') {
    return {
      icon: <Calendar className="size-4 text-paper/80" />,
      title: 'Mission à démarrer',
    }
  }
  if (state === 'completed') {
    return {
      icon: <CheckCheck className="size-4 text-success" />,
      title: 'Dossier terminé',
    }
  }
  return {
    icon: <Activity className="size-4 text-chartreuse" />,
    title: summary.currentRoom ? `Mission en cours · ${summary.currentRoom}` : 'Mission en cours',
  }
}

function metaCopyFor(summary: DossierHeroSummary): string {
  const parts: string[] = []
  if (typeof summary.totalDurationMin === 'number') {
    parts.push(`${summary.totalDurationMin} min`)
  }
  if (summary.photosCount > 0) {
    parts.push(`${summary.photosCount} photo${summary.photosCount > 1 ? 's' : ''}`)
  }
  if (summary.voiceNotesCount > 0) {
    parts.push(`${summary.voiceNotesCount} note${summary.voiceNotesCount > 1 ? 's' : ''}`)
  }
  return parts.join(' · ')
}

/**
 * Sticky bar bottom fixe — Design v5.
 *
 * Position : `fixed bottom-0 left-[80px]` (offset sidebar app de 80px),
 * full-width sur mobile (< md).
 *
 * - Left  : icône + main text (état · pièce) + meta (durée · photos · notes)
 * - Right : menu ⋯ + bouton primaire (Démarrer / Reprendre / Exporter)
 */
export function DossierStickyBar({
  dossierId,
  state,
  summary,
  menuItems,
  primaryHref,
  onPrimary,
  className,
}: DossierStickyBarProps) {
  const primary = PRIMARY_BY_STATE[state]
  const main = mainCopyFor(state, summary)
  const meta = metaCopyFor(summary)

  const resolvedHref =
    primaryHref ??
    (primary.defaultHref || `/dashboard/dossiers/${encodeURIComponent(dossierId)}/mission`)

  return (
    <section
      aria-label="Actions du dossier"
      className={cn(
        // Position : au-dessus de AppMobileNav (64px) sur mobile via helper
        // `.above-mobile-nav` (globals.css). Sur md+, `bottom: 0` restauré et
        // sidebar 80px gérée par `md:left-20`.
        'above-mobile-nav fixed left-0 right-0 z-40 md:left-20',
        'border-t border-rule/60 bg-navy/95 text-paper shadow-lg backdrop-blur-md',
        'supports-[backdrop-filter]:bg-navy/85',
        // Safe area iOS PWA (home indicator) — utile sur md+ où helper = 0.
        'pb-[max(env(safe-area-inset-bottom),0px)]',
        className,
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-paper/10"
          >
            {main.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-paper">{main.title}</div>
            {meta && (
              <div className="hidden truncate font-mono text-[11px] uppercase tracking-[0.1em] text-paper/60 md:block">
                {meta}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DossierStickyMenu state={state} items={menuItems} />

          {onPrimary ? (
            <Button type="button" variant={primary.variant} size="default" onClick={onPrimary}>
              {primary.icon}
              <span>{primary.label}</span>
            </Button>
          ) : (
            <Button asChild variant={primary.variant} size="default">
              <Link href={resolvedHref}>
                {primary.icon}
                <span>{primary.label}</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
