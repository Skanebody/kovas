import { cn } from '@/lib/utils'
import { LEVELS, type LevelId } from '@/lib/gamification/levels'
import { LevelBadge } from './LevelBadge'
import { Check } from 'lucide-react'

export interface ProgressionTimelineProps {
  currentLevel: LevelId
  unlockedAt?: string | null
  className?: string
}

/**
 * Frise verticale des 7 statuts professionnels.
 *
 * Ton sobre, vouvoiement, descriptions courtes (cf. docs/avatar-client.md).
 * Aucune mention d'avantage tarifaire.
 */
export function ProgressionTimeline({ currentLevel, unlockedAt, className }: ProgressionTimelineProps) {
  return (
    <ol className={cn('relative space-y-5 pl-1', className)}>
      {LEVELS.map((lvl, idx) => {
        const isUnlocked = lvl.id <= currentLevel
        const isCurrent = lvl.id === currentLevel
        const isLast = idx === LEVELS.length - 1
        return (
          <li key={lvl.id} className="relative flex gap-4">
            {/* Vertical line connecting the steps */}
            {!isLast ? (
              <div
                className={cn(
                  'absolute left-[15px] top-8 h-[calc(100%-8px)] w-px',
                  isUnlocked ? 'bg-navy/30' : 'bg-border/50',
                )}
                aria-hidden
              />
            ) : null}

            <div className="flex-shrink-0">
              {isUnlocked ? (
                <div className="relative">
                  <LevelBadge level={lvl.id} size="md" showLabel={false} />
                  <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-navy text-paper">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </div>
                </div>
              ) : (
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-border/70 bg-paper">
                  <span className="font-mono text-[10px] text-ink-mute">{lvl.id}</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h3
                  className={cn(
                    'font-mono uppercase text-[11px] tracking-[0.08em]',
                    isCurrent ? 'text-ink font-semibold' : 'text-ink-soft',
                  )}
                >
                  {lvl.label}
                </h3>
                {isCurrent ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-chartreuse-deep">
                    Statut actuel{unlockedAt ? ` · ${formatDate(unlockedAt)}` : ''}
                  </span>
                ) : null}
              </div>
              <p
                className={cn(
                  'mt-1 text-[13px] leading-relaxed',
                  isUnlocked ? 'text-ink-mute' : 'text-ink-faint',
                )}
              >
                {lvl.description}
              </p>
              {!isUnlocked ? <CriteriaHint level={lvl} /> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function CriteriaHint({ level }: { level: (typeof LEVELS)[number] }) {
  const c = level.unlockCriteria
  const parts: string[] = []
  if (c.missions !== undefined) parts.push(`${c.missions} missions`)
  if (c.subscriptionDays !== undefined) {
    const months = Math.round(c.subscriptionDays / 30)
    parts.push(`${months} mois d'abonnement`)
  }
  if (c.referralsPaid !== undefined) parts.push(`${c.referralsPaid} filleuls payants`)
  if (c.ademeScore !== undefined) parts.push(`score ADEME ≥ ${Math.round(c.ademeScore * 100)} %`)
  if (parts.length === 0) return null
  const joiner = c.requireAll ? ' ET ' : ' ou '
  return (
    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">
      Critères : {parts.join(joiner)}
    </p>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
