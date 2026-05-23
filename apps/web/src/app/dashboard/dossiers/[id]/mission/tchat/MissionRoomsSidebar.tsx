'use client'

/**
 * KOVAS — Sidebar pièces "read-mostly" mode mission tchat (lot MISSION-A).
 *
 * Panneau vertical 280px desktop affichant l'état de complétude de chaque pièce
 * du bien. Inspiré du panneau Cursor (état de fichiers à droite du chat).
 *
 *   - Avatar circulaire icône par type de pièce
 *   - Nom + surface si déjà saisie
 *   - Anneau ring de progression 3 états : empty / partial / complete
 *   - Compteur "X/Y" (champs saisis sur requis 3CL)
 *   - Tap → filtre le chat (passe activeRoomId au parent)
 *   - Bouton "+ Ajouter une pièce" en haut
 *   - Indicateur "X/Y pièces complétées" + barre globale chartreuse en bas
 *
 * Sur mobile : exposé via BottomSheet (slide-up) — toggle depuis MissionContextBar.
 *
 * Authority : CLAUDE.md §3 features 4+5+10 + spec MISSION-A.
 */

import type { RoomType } from '@/lib/mission/room-completion'
import { cn } from '@/lib/utils'
import {
  ArchiveRestore,
  Bath,
  Bed,
  BookOpen,
  Briefcase,
  Car,
  CheckCircle2,
  ChefHat,
  Circle,
  CircleDot,
  CornerDownRight,
  Home,
  Layers,
  Plus,
  Sofa,
  Toilet,
  Warehouse,
} from 'lucide-react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface MissionSidebarRoom {
  id: string
  name: string
  type: RoomType
  surfaceSqm?: number | null
  requiredFields: number
  filledFields: number
  completionStatus: 'empty' | 'partial' | 'complete'
}

interface MissionRoomsSidebarProps {
  rooms: readonly MissionSidebarRoom[]
  activeRoomId: string | null
  onSelectRoom: (roomId: string) => void
  onAddRoom: () => void
  /** Variant mobile (rendu BottomSheet sans le wrapper aside). */
  variant?: 'desktop' | 'mobile'
}

// -----------------------------------------------------------------------------
// Mapping icônes par type pièce
// -----------------------------------------------------------------------------

const ROOM_ICON_BY_TYPE: Record<RoomType, typeof Sofa> = {
  living: Sofa,
  kitchen: ChefHat,
  bedroom: Bed,
  bathroom: Bath,
  office: Briefcase,
  wc: Toilet,
  corridor: CornerDownRight,
  storage: ArchiveRestore,
  basement: Warehouse,
  attic: Layers,
  garage: Car,
  other: BookOpen,
}

// -----------------------------------------------------------------------------
// Composant principal
// -----------------------------------------------------------------------------

export function MissionRoomsSidebar({
  rooms,
  activeRoomId,
  onSelectRoom,
  onAddRoom,
  variant = 'desktop',
}: MissionRoomsSidebarProps): React.ReactElement {
  const completedCount = rooms.filter((r) => r.completionStatus === 'complete').length
  const totalCount = rooms.length
  const ratio = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)

  const containerClass =
    variant === 'desktop'
      ? cn(
          'hidden lg:flex flex-col shrink-0',
          'w-[280px] border-l border-rule/40 bg-paper/70 backdrop-blur-sm',
        )
      : 'flex flex-col w-full bg-paper'

  return (
    <aside aria-label="Liste des pièces du bien" className={containerClass}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-rule/40 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Home className="size-4 text-ink-mute shrink-0" aria-hidden />
          <h2 className="text-[13px] font-semibold text-ink truncate">Pièces du bien</h2>
        </div>
        <button
          type="button"
          onClick={onAddRoom}
          aria-label="Ajouter une pièce"
          className={cn(
            'inline-flex items-center gap-1 rounded-pill',
            'border border-rule/60 bg-paper px-2 py-1',
            'text-[11px] font-medium text-ink-soft',
            'hover:bg-sage-alt hover:border-ink/30 hover:text-ink',
            'transition-colors',
          )}
        >
          <Plus className="size-3" aria-hidden />
          Ajouter
        </button>
      </div>

      {/* Liste pièces — scrollable */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {rooms.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-ink-mute">
            Aucune pièce — démarrez en dictant la première au tchat.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {rooms.map((room) => (
              <RoomListItem
                key={room.id}
                room={room}
                isActive={activeRoomId === room.id}
                onSelect={() => onSelectRoom(room.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer — progression globale */}
      <div className="border-t border-rule/40 px-4 py-3 shrink-0 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-ink-mute">
          <span aria-live="polite">
            {completedCount}/{totalCount} pièce{totalCount > 1 ? 's' : ''} complétée
            {completedCount > 1 ? 's' : ''}
          </span>
          <span className="text-ink-soft tabular-nums">{ratio}%</span>
        </div>
        {/* Barre de progression purement visuelle — l'info textuelle au-dessus
            (aria-live="polite") est lue par les screen readers. */}
        <div aria-hidden className="h-1 w-full overflow-hidden rounded-pill bg-sage-alt">
          <div
            className="h-full rounded-pill bg-chartreuse-deep transition-all duration-300"
            style={{ width: `${ratio}%` }}
          />
        </div>
      </div>
    </aside>
  )
}

// -----------------------------------------------------------------------------
// RoomListItem
// -----------------------------------------------------------------------------

interface RoomListItemProps {
  room: MissionSidebarRoom
  isActive: boolean
  onSelect: () => void
}

function RoomListItem({ room, isActive, onSelect }: RoomListItemProps): React.ReactElement {
  const Icon = ROOM_ICON_BY_TYPE[room.type] ?? BookOpen

  // Choix des couleurs d'anneau selon statut.
  // empty -> rule/30 ; partial -> amber ; complete -> chartreuse-deep
  const ringClass =
    room.completionStatus === 'complete'
      ? 'ring-2 ring-chartreuse-deep ring-offset-2 ring-offset-paper'
      : room.completionStatus === 'partial'
        ? 'ring-2 ring-status-amber ring-offset-2 ring-offset-paper'
        : 'ring-1 ring-rule/40'

  const statusIcon =
    room.completionStatus === 'complete' ? (
      <CheckCircle2 className="size-3 text-chartreuse-deep" aria-hidden />
    ) : room.completionStatus === 'partial' ? (
      <CircleDot className="size-3 text-status-amber" aria-hidden />
    ) : (
      <Circle className="size-3 text-ink-ghost" aria-hidden />
    )

  const statusLabel =
    room.completionStatus === 'complete'
      ? 'complétée'
      : room.completionStatus === 'partial'
        ? 'partielle'
        : 'à saisir'

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isActive}
        aria-label={`${room.name} — ${room.filledFields} champ${room.filledFields > 1 ? 's' : ''} sur ${room.requiredFields} (${statusLabel})`}
        className={cn(
          'w-full flex items-center gap-3 rounded-md px-2 py-2',
          'text-left transition-all duration-200',
          isActive
            ? 'bg-sage-alt border border-ink/20'
            : 'border border-transparent hover:bg-sage-alt/60',
        )}
      >
        {/* Avatar circulaire 32px avec icône type */}
        <div
          className={cn(
            'shrink-0 size-8 rounded-full bg-paper flex items-center justify-center',
            ringClass,
            'transition-shadow duration-200',
          )}
          aria-hidden
        >
          <Icon className="size-4 text-ink-soft" />
        </div>

        {/* Info pièce */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[13px] font-medium text-ink truncate">{room.name}</span>
            {room.surfaceSqm != null ? (
              <span className="text-[11px] font-mono text-ink-mute shrink-0">
                · {room.surfaceSqm}m²
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {statusIcon}
            <span className="text-[11px] font-mono text-ink-mute tabular-nums">
              {room.filledFields}/{room.requiredFields}
            </span>
          </div>
        </div>
      </button>
    </li>
  )
}
