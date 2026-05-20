import { Card } from '@/components/ui/card'
import type { DossierHeroSummary, DossierVisualState } from '@/lib/dossier/types'
import { cn } from '@/lib/utils'
import { Activity, Calendar, CheckCheck, type LucideIcon } from 'lucide-react'

interface DossierHeroCardProps {
  state: DossierVisualState
  summary: DossierHeroSummary
  className?: string
}

interface StateConfig {
  icon: LucideIcon
  title: string
  /** Classes appliquées à la <Card> racine. */
  cardClass: string
  /** Classes du wrapper icône (cercle chartreuse ou variante). */
  iconWrapperClass: string
  iconClass: string
  titleClass: string
  subtitleClass: string
}

const STATE_CONFIG: Record<DossierVisualState, StateConfig> = {
  'to-start': {
    icon: Calendar,
    title: 'Mission à démarrer',
    cardClass: 'bg-navy text-paper',
    iconWrapperClass: 'bg-chartreuse',
    iconClass: 'text-ink',
    titleClass: 'text-paper',
    subtitleClass: 'text-paper/70',
  },
  'in-progress': {
    icon: Activity,
    title: 'Mission en cours',
    cardClass: 'bg-navy text-paper',
    iconWrapperClass: 'bg-chartreuse',
    iconClass: 'text-ink',
    titleClass: 'text-paper',
    subtitleClass: 'text-paper/70',
  },
  completed: {
    icon: CheckCheck,
    title: 'Dossier terminé',
    // accent-green/15 + bordure verte (design v5 final state).
    cardClass: 'bg-accent-green/15 text-ink border border-accent-green/40 shadow-none',
    iconWrapperClass: 'bg-chartreuse',
    iconClass: 'text-ink',
    titleClass: 'text-ink',
    subtitleClass: 'text-ink-mute',
  },
}

function formatSubtitle(state: DossierVisualState, summary: DossierHeroSummary): string {
  const parts: string[] = []

  if (state === 'in-progress' && summary.currentRoom) {
    parts.push(summary.currentRoom)
  }
  if (typeof summary.totalDurationMin === 'number') {
    parts.push(`${summary.totalDurationMin} min`)
  }
  if (summary.photosCount > 0) {
    parts.push(`${summary.photosCount} photo${summary.photosCount > 1 ? 's' : ''}`)
  }
  if (summary.voiceNotesCount > 0) {
    parts.push(
      `${summary.voiceNotesCount} note${summary.voiceNotesCount > 1 ? 's' : ''} vocale${
        summary.voiceNotesCount > 1 ? 's' : ''
      }`,
    )
  }

  if (parts.length === 0) {
    return state === 'to-start'
      ? 'Tout est prêt pour démarrer'
      : state === 'completed'
        ? 'Tous les diagnostics sont collectés'
        : 'Mission en cours sur le terrain'
  }
  return parts.join(' · ')
}

/**
 * Bandeau compact (PAS gros CTA) qui résume l'état du dossier.
 * Design v5 :
 * - to-start / in-progress → fond navy `#163144`, texte paper
 * - completed → bg `accent-green/15` + bordure `accent-green/40`, texte ink
 *
 * Icône 48x48 rounded chartreuse, titre serif italic 2xl, sous-titre 1 ligne.
 */
export function DossierHeroCard({ state, summary, className }: DossierHeroCardProps) {
  const config = STATE_CONFIG[state]
  const Icon = config.icon
  const subtitle = formatSubtitle(state, summary)

  return (
    <Card
      variant="opaque"
      padding="none"
      className={cn('overflow-hidden', config.cardClass, className)}
    >
      <div className="flex items-center gap-5 p-5">
        <div
          aria-hidden
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-lg',
            config.iconWrapperClass,
          )}
        >
          <Icon className={cn('size-6', config.iconClass)} />
        </div>
        <div className="flex-1 min-w-0">
          <h2
            className={cn(
              'font-serif italic font-normal text-2xl leading-tight',
              config.titleClass,
            )}
          >
            {config.title}
          </h2>
          <p className={cn('mt-1 truncate text-sm', config.subtitleClass)} title={subtitle}>
            {subtitle}
          </p>
        </div>
      </div>
    </Card>
  )
}
