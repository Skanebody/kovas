'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MISSION_STATUS_LABELS, MISSION_STATUS_VARIANT } from '@/lib/mission-helpers'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { updateMissionStatusAction } from './actions'

type Status =
  | 'draft'
  | 'scheduled'
  | 'in_progress'
  | 'to_review'
  | 'done'
  | 'exported'
  | 'archived'
  | 'cancelled'

// Transitions autorisées simples (Phase 1 — workflow non rigide)
const NEXT_STATUSES: Record<Status, Status[]> = {
  draft: ['scheduled', 'in_progress', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['to_review', 'done', 'cancelled'],
  to_review: ['in_progress', 'done'],
  done: ['exported', 'archived'],
  exported: ['archived'],
  archived: [],
  cancelled: ['draft'],
}

export function MissionStatusButton({
  missionId,
  currentStatus,
}: {
  missionId: string
  currentStatus: Status
}) {
  const [isPending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useState<Status>(currentStatus)

  // Sync depuis le serveur quand la prop change (après revalidatePath
  // déclenché par une autre action — ex. ResumeButton).
  useEffect(() => {
    setOptimistic(currentStatus)
  }, [currentStatus])

  const transitions = NEXT_STATUSES[optimistic] ?? []

  function handleChange(next: Status) {
    setOptimistic(next)
    startTransition(async () => {
      try {
        await updateMissionStatusAction(missionId, next)
      } catch (err) {
        setOptimistic(currentStatus)
        alert(err instanceof Error ? err.message : 'Erreur statut')
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant={MISSION_STATUS_VARIANT[optimistic] ?? 'muted'}>
        {MISSION_STATUS_LABELS[optimistic] ?? optimistic}
      </Badge>
      {transitions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              {isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <ChevronDown className="size-3" />
              )}
              Changer
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {transitions.map((s) => (
              <DropdownMenuItem key={s} onClick={() => handleChange(s)}>
                <Check className="size-3 opacity-0" />
                {MISSION_STATUS_LABELS[s] ?? s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
