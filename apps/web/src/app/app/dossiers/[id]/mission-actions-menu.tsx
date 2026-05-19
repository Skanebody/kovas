'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toaster'
import { MISSION_STATUS_LABELS } from '@/lib/mission-helpers'
import type { MissionStatus } from '@kovas/shared'
import { MoreHorizontal, Share2, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { removeMissionFromDossierAction, updateMissionStatusAction } from './actions'

interface MissionActionsMenuProps {
  missionId: string
  missionLabel: string
  missionReference: string
  currentStatus: MissionStatus
  clientEmail: string | null
}

const STATUS_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  draft: ['scheduled', 'in_progress', 'cancelled'],
  scheduled: ['in_progress', 'draft', 'cancelled'],
  in_progress: ['to_review', 'done', 'scheduled'],
  to_review: ['done', 'in_progress'],
  done: ['exported', 'to_review'],
  exported: ['archived', 'done'],
  archived: ['done'],
  cancelled: ['draft'],
}

/**
 * MissionActionsMenu v5 — regroupe les 3 actions secondaires de chaque
 * mission dans un seul menu `...` :
 * - Changer le statut (sous-menu)
 * - Partager au client (lien sécurisé)
 * - Supprimer (avec confirmation)
 *
 * Le bouton primary "Mode mission" + "Démarrer/Reprendre" restent
 * visibles à côté pour les actions critiques terrain.
 *
 * Avant v5 : 4 boutons en ligne + chevron + statut = 6 éléments par
 * mission. Avec 8 diagnostics → 48 éléments interactifs. Trop dense.
 */
export function MissionActionsMenu({
  missionId,
  missionLabel,
  missionReference,
  currentStatus,
  clientEmail,
}: MissionActionsMenuProps) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  const nextStatuses = STATUS_TRANSITIONS[currentStatus] ?? []

  function handleStatusChange(newStatus: MissionStatus) {
    setOpen(false)
    startTransition(async () => {
      try {
        await updateMissionStatusAction(missionId, newStatus)
        toast.success(`Statut → ${MISSION_STATUS_LABELS[newStatus] ?? newStatus}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur')
      }
    })
  }

  function handleShare() {
    setOpen(false)
    const subject = `${missionLabel} · ${missionReference}`
    const body = `Bonjour,\n\nVous trouverez ci-joint le rapport ${missionLabel} (référence ${missionReference}).\n\nCordialement,`
    const mailto = clientEmail
      ? `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailto
  }

  function handleRemove() {
    setOpen(false)
    const confirmed = window.confirm(
      `Supprimer définitivement la mission ${missionLabel} ?\nCette action est irréversible.`,
    )
    if (!confirmed) return
    startTransition(async () => {
      try {
        await removeMissionFromDossierAction(missionId)
        toast.success(`Mission ${missionLabel} supprimée`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur')
      }
    })
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions ${missionLabel}`}
          disabled={isPending}
          className="size-9"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {nextStatuses.length > 0 && (
          <>
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider font-mono text-ink-mute">
              Changer le statut
            </DropdownMenuLabel>
            {nextStatuses.map((status) => (
              <DropdownMenuItem
                key={status}
                onClick={() => handleStatusChange(status)}
                className="text-sm"
              >
                {MISSION_STATUS_LABELS[status] ?? status}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={handleShare} className="text-sm gap-2">
          <Share2 className="size-3.5" /> Partager au client
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleRemove} className="text-sm gap-2 text-danger">
          <Trash2 className="size-3.5" /> Supprimer la mission
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
