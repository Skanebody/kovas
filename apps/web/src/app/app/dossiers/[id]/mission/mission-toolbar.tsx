'use client'

/**
 * KOVAS — Toolbar du mode terrain Capture-First (V1.5 iteration 1).
 *
 * Barre sticky top : [Retour dossier] · [Pièce courante font-serif italic] · [Picker pièce]
 *
 * Pas d'appel API à cette itération — juste l'UI.
 */

import { cn } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

interface MissionToolbarProps {
  dossierId: string
  dossierReference: string
  currentRoomName: string | null
  /** Slot où le parent peut placer le RoomPicker (gardé sous contrôle parent). */
  roomPickerSlot?: ReactNode
}

export function MissionToolbar({
  dossierId,
  dossierReference,
  currentRoomName,
  roomPickerSlot,
}: MissionToolbarProps) {
  return (
    <header
      className={cn('sticky top-0 z-20 border-b border-rule', 'bg-paper/95 backdrop-blur-md')}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href={`/app/dossiers/${dossierId}`}
          className={cn(
            'inline-flex items-center gap-2 rounded-pill px-3 py-2',
            'text-sm font-medium text-ink',
            'transition-colors hover:bg-sage-alt/40',
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">
            {dossierReference}
          </span>
        </Link>

        <div className="flex flex-1 items-center justify-center px-2">
          <h1 className="font-serif text-2xl italic text-ink">
            {currentRoomName ?? 'Aucune pièce sélectionnée'}
          </h1>
        </div>

        <div className="flex shrink-0 items-center">{roomPickerSlot}</div>
      </div>
    </header>
  )
}
