'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useExpandState } from '@/lib/hooks/use-expand-state'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

interface MissionCardCollapsibleProps {
  missionId: string
  typeLabel: string
  reference: string
  percentage: number
  missingRequiredCount: number
  /** Actions toujours visibles (Reprendre, statut, Share, Remove) */
  headerActions: ReactNode
  /** Contenu expandable (checklist détaillée) */
  children: ReactNode
}

function pillColor(pct: number, missing: number): { dot: string; ring: string } {
  if (pct >= 100) return { dot: 'bg-accent-blue', ring: 'ring-accent-blue/30' }
  if (pct >= 75) return { dot: 'bg-accent-green', ring: 'ring-accent-green/30' }
  if (pct >= 25 || missing > 0) return { dot: 'bg-accent-orange', ring: 'ring-accent-orange/30' }
  return { dot: 'bg-accent-red', ring: 'ring-accent-red/30' }
}

/**
 * Card mission collapsible — ~70px collapsed, expand au tap.
 * État expand persisté en localStorage par mission id.
 * cf. spec dossier-allegement-visuel 2026-05-18.
 */
export function MissionCardCollapsible({
  missionId,
  typeLabel,
  reference,
  percentage,
  missingRequiredCount,
  headerActions,
  children,
}: MissionCardCollapsibleProps) {
  const [expanded, setExpanded] = useExpandState(`kovas_mission_${missionId}_expanded`, false)
  const color = pillColor(percentage, missingRequiredCount)

  return (
    <Card id={`mission-${missionId}`} className="scroll-mt-20">
      <CardHeader className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls={`mission-${missionId}-body`}
            className="flex items-center gap-3 flex-1 min-w-0 text-left"
          >
            <span
              className={cn('size-2.5 rounded-full ring-4 shrink-0', color.dot, color.ring)}
              aria-hidden
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm truncate">{typeLabel}</span>
                <Badge variant="muted" className="text-[10px] py-0">
                  {percentage}%
                </Badge>
                {missingRequiredCount > 0 && (
                  <Badge variant="orange" className="text-[10px] py-0">
                    {missingRequiredCount} item{missingRequiredCount > 1 ? 's' : ''} à compléter
                  </Badge>
                )}
              </div>
              <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{reference}</p>
            </div>
            <ChevronDown
              className={cn(
                'size-4 text-muted-foreground transition-transform shrink-0',
                expanded && 'rotate-180',
              )}
            />
          </button>
          <div className="flex items-center gap-1.5 flex-wrap">{headerActions}</div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent id={`mission-${missionId}-body`} className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  )
}
