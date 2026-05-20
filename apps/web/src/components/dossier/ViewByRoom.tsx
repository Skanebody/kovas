'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DiagChip } from '@/components/ui/diag-chip'
import { diagnosticToDiagChip } from '@/lib/dossier/diagnostic-to-diag-chip'
import { resolveRoomIcon } from '@/lib/dossier/room-icon-resolver'
import type {
  DiagnosticStatus,
  RoomVisitStatus,
  SuggestedRoom,
  VisitedRoom,
} from '@/lib/dossier/types'
import { cn } from '@/lib/utils'
import { AlertTriangle, Camera, CheckCircle2, Info, type LucideIcon } from 'lucide-react'
import Link from 'next/link'

interface RoomRowProps {
  dossierId: string
  room: VisitedRoom | SuggestedRoom
  className?: string
}

interface RoomStatusVisual {
  /** Variant Badge KOVAS. */
  badge: 'green' | 'amber' | 'blue' | 'muted' | 'orange'
  label: string
}

function statusVisualFor(status: RoomVisitStatus | 'not-visited'): RoomStatusVisual {
  switch (status) {
    case 'completed':
      return { badge: 'green', label: 'Terminé' }
    case 'in-progress':
      return { badge: 'amber', label: 'En cours' }
    case 'started':
      return { badge: 'blue', label: 'Commencé' }
    case 'skipped':
      return { badge: 'muted', label: 'Passé' }
    case 'not-visited':
      return { badge: 'orange', label: 'À visiter' }
    default:
      return { badge: 'muted', label: 'Inconnu' }
  }
}

function DiagnosticMiniChip({ status }: { status: DiagnosticStatus }) {
  const Icon: LucideIcon = status.hasIssue ? AlertTriangle : CheckCircle2
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px]',
        status.hasIssue ? 'bg-orange-mist text-[#7C3F0A]' : 'bg-lime-mist text-[#2D4015]',
      )}
      title={status.issueLabel ?? undefined}
    >
      <Icon aria-hidden className="size-3 shrink-0" />
      <DiagChip
        type={diagnosticToDiagChip(status.diagnostic)}
        className="bg-transparent px-0 py-0"
      />
      {status.hasIssue && status.issueLabel && (
        <span className="hidden text-[10px] font-normal text-ink-soft md:inline">
          {status.issueLabel}
        </span>
      )}
    </span>
  )
}

export function RoomRow({ dossierId, room, className }: RoomRowProps) {
  const IconRoom = resolveRoomIcon(room.type)
  const isSuggested = room.status === 'not-visited'
  const statusVisual = statusVisualFor(room.status)

  const meta = isSuggested
    ? (room as SuggestedRoom).suggestedReason
    : formatVisitedMeta(room as VisitedRoom)

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-md p-3 transition-colors duration-fast',
        isSuggested ? 'bg-orange-mist/40' : 'hover:bg-sage-alt/60',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md',
            isSuggested ? 'bg-orange-mist text-[#7C3F0A]' : 'bg-sage-alt text-ink-soft',
          )}
        >
          <IconRoom className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink">{room.name}</span>
            <Badge variant={statusVisual.badge}>{statusVisual.label}</Badge>
          </div>
          <p className="mt-1 text-[12px] text-ink-mute">{meta}</p>
        </div>

        {isSuggested && (
          <Button asChild variant="accent" size="sm">
            <Link
              href={`/app/dossiers/${encodeURIComponent(dossierId)}/mission?room=${encodeURIComponent(room.id)}`}
              aria-label={`Capturer la pièce ${room.name}`}
            >
              <Camera className="size-3.5" />
              <span>Capturer</span>
            </Link>
          </Button>
        )}
      </div>

      {room.diagnosticStatuses.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {room.diagnosticStatuses.map((s) => (
            <li key={`${room.id}-${s.diagnostic}`}>
              <DiagnosticMiniChip status={s} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function formatVisitedMeta(room: VisitedRoom): string {
  const parts: string[] = []
  if (room.photosCount > 0) {
    parts.push(`${room.photosCount} photo${room.photosCount > 1 ? 's' : ''}`)
  }
  if (room.durationMin > 0) {
    parts.push(`${room.durationMin} min`)
  }
  if (room.fieldsCount > 0) {
    parts.push(
      `${room.fieldsCount} champ${room.fieldsCount > 1 ? 's' : ''} collecté${room.fieldsCount > 1 ? 's' : ''}`,
    )
  }
  if (room.voiceNotesCount > 0) {
    parts.push(
      `${room.voiceNotesCount} note${room.voiceNotesCount > 1 ? 's' : ''} vocale${room.voiceNotesCount > 1 ? 's' : ''}`,
    )
  }
  return parts.length > 0 ? parts.join(' · ') : 'Pièce visitée'
}

interface ViewByRoomProps {
  dossierId: string
  visitedRooms: VisitedRoom[]
  suggestedRooms: SuggestedRoom[]
  className?: string
}

/**
 * Vue "par pièce" :
 * 1. Pièces visitées
 * 2. Séparateur "Pièces non visitées avec manques détectés" + bandeau info
 * 3. Pièces suggérées (CTA capturer)
 */
export function ViewByRoom({
  dossierId,
  visitedRooms,
  suggestedRooms,
  className,
}: ViewByRoomProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {visitedRooms.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {visitedRooms.map((room) => (
            <RoomRow key={room.id} dossierId={dossierId} room={room} />
          ))}
        </ul>
      ) : (
        <p className="rounded-md bg-sage-alt/60 px-3 py-2.5 text-sm text-ink-mute">
          Aucune pièce visitée pour le moment.
        </p>
      )}

      {suggestedRooms.length > 0 && (
        <>
          <div className="mt-2 flex items-start gap-2 rounded-md bg-blue-mist/60 px-3 py-2.5">
            <Info aria-hidden className="size-4 shrink-0 text-[#1E3A8A]" />
            <p className="text-[12px] text-[#1E3A8A]">
              <span className="font-semibold">Pièces non visitées avec manques détectés</span> ·
              Capturer ces pièces permet de compléter les diagnostics correspondants.
            </p>
          </div>
          <ul className="flex flex-col gap-1">
            {suggestedRooms.map((room) => (
              <RoomRow key={room.id} dossierId={dossierId} room={room} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
