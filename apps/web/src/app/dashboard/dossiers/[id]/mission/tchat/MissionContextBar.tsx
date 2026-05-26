'use client'

/**
 * KOVAS — Context bar persistante mode mission tchat (lot MISSION-A).
 *
 * Ligne discrète sticky en haut du chat qui ne disparaît jamais. Donne au
 * diagnostiqueur un récapitulatif synthétique du contexte mission (client,
 * bien, progression) + statut connectivité.
 *
 * Hauteur : 40px desktop, 36px mobile.
 * Fond : paper sobre + border-b légère V5.
 * Typo : font-mono 12px, séparateurs `·` en ink-mute.
 * Si offline : badge ambre discret "Hors ligne" + icône WifiOff.
 *
 * Authority : CLAUDE.md §3 (mode mission) + spec MISSION-A.
 */

import { cn } from '@/lib/utils'
import { WifiOff } from 'lucide-react'

interface MissionContextBarProps {
  client: { name: string }
  property: {
    type: string
    constructionYear: number | null
    surfaceSqm: number | null
  }
  rooms: {
    total: number
    completed: number
  }
  photosCount: number
  isOffline: boolean
  /** Bouton optionnel pour toggle la sidebar pièces sur mobile (slot droit). */
  onToggleRoomsSidebar?: () => void
  isRoomsSidebarOpen?: boolean
}

export function MissionContextBar({
  client,
  property,
  rooms,
  photosCount,
  isOffline,
  onToggleRoomsSidebar,
  isRoomsSidebarOpen,
}: MissionContextBarProps): React.ReactElement {
  // Compose le résumé bien : "Maison 1985 · 110m²"
  const propertySummary = [
    property.type,
    property.constructionYear,
    property.surfaceSqm ? `${property.surfaceSqm}m²` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section
      aria-label="Contexte mission"
      className={cn(
        'flex h-9 md:h-10 items-center gap-2 sm:gap-3 shrink-0',
        'border-b border-[#0F1419]/[0.06] bg-paper',
        'px-3 sm:px-5 z-[5]',
      )}
    >
      {/* Logo discret KOVAS */}
      <span
        aria-hidden
        className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#0F1419]/55 shrink-0"
      >
        <span className="size-1.5 rounded-full bg-chartreuse-deep" />
        KOVAS
      </span>

      {/* Données mission séparées par "·" */}
      <div
        className={cn(
          'flex flex-1 min-w-0 items-center gap-1.5 sm:gap-2',
          'font-mono text-[11px] sm:text-[12px] text-[#0F1419] truncate',
        )}
      >
        <span className="truncate font-medium" title={client.name}>
          {client.name}
        </span>
        {propertySummary ? (
          <>
            <Separator />
            <span className="hidden sm:inline truncate text-[#0F1419]/82">{propertySummary}</span>
          </>
        ) : null}
        <Separator />
        <span aria-live="polite" className="shrink-0 text-[#0F1419]/82">
          {rooms.completed}/{rooms.total} pièce{rooms.total > 1 ? 's' : ''}
        </span>
        <Separator />
        <span aria-live="polite" className="shrink-0 text-[#0F1419]/82">
          {photosCount} photo{photosCount > 1 ? 's' : ''}
        </span>
      </div>

      {/* Status connectivité + toggle sidebar mobile */}
      <div className="flex items-center gap-2 shrink-0">
        {isOffline ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-pill',
              'bg-accent-warm-soft px-2 py-0.5',
              'font-mono text-[10px] uppercase tracking-wide text-accent-warm',
            )}
            title="Hors ligne — messages mis en file d'attente"
          >
            <WifiOff className="size-3" aria-hidden />
            <span className="hidden sm:inline">Hors ligne</span>
          </span>
        ) : null}

        {onToggleRoomsSidebar ? (
          <button
            type="button"
            onClick={onToggleRoomsSidebar}
            aria-pressed={isRoomsSidebarOpen ?? false}
            aria-label={
              isRoomsSidebarOpen ? 'Masquer la liste des pièces' : 'Afficher la liste des pièces'
            }
            className={cn(
              'lg:hidden inline-flex items-center gap-1 rounded-pill',
              'border border-[#0F1419]/[0.08] bg-paper hover:bg-sage-alt',
              'px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[#0F1419]/82',
              'transition-colors',
            )}
          >
            <span aria-hidden>≡</span>
            Pièces
          </button>
        ) : null}
      </div>
    </section>
  )
}

function Separator(): React.ReactElement {
  return (
    <span aria-hidden className="text-[#0F1419]/40 select-none">
      ·
    </span>
  )
}
