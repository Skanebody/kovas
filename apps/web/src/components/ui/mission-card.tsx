import { cn } from '@/lib/utils'
import { MISSION_PASTEL_CLASS, MISSION_TYPE_LABEL } from '@/lib/mission-pastels'
import type { MissionType } from '@kovas/shared'
import { MapPin } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

interface MissionCardProps {
  /** Heure de la mission (format affichage : '11h00') */
  time: string
  /** Jour affiché en uppercase sous l'heure (ex: 'mardi') */
  day?: string
  /** Types de diagnostic (tags pastels colorés selon mission-pastels.ts) */
  types: MissionType[]
  /** Nom du client ou du dossier */
  name: string
  /** Adresse + métadonnées distance/durée (optionnel) */
  address: string
  /** Distance + durée trajet (format libre, ex: '4,2 km · 12 min') */
  travelMeta?: string
  /** Actions à droite (slot ouvert : icon-buttons, StatusPill, ou Button) */
  actions?: ReactNode
  /** Lien navigation au click sur le corps de la card */
  href?: string
  className?: string
}

/**
 * MissionCard — composant high-level Design System v2 (2026-05-19).
 * Pattern Ron Design Lab adapté : heure typographique grande, tags pastels
 * catégoriels, nom client en h3, adresse meta, slot actions droite.
 *
 * Densité optimale pour listes desktop + mobile. Hover suggère
 * l'interaction sans bruit visuel (border + lift -1px).
 */
export function MissionCard({
  time,
  day,
  types,
  name,
  address,
  travelMeta,
  actions,
  href,
  className,
}: MissionCardProps) {
  const cardClasses = cn(
    'rounded-xl border border-rule/80 glass-opaque shadow-glass-sm transition-all',
    'grid grid-cols-[auto_1fr_auto] gap-5 items-center p-6',
    href && 'hover:border-rule hover:shadow-glass hover:-translate-y-px cursor-pointer',
    className,
  )

  const content = (
    <>
      {/* Colonne 1 — Heure typographique */}
      <div className="flex flex-col gap-1 pr-5 border-r border-rule">
        <span className="font-mono text-2xl font-semibold tracking-tight text-ink">
          {time}
        </span>
        {day && (
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-mute">
            {day}
          </span>
        )}
      </div>

      {/* Colonne 2 — Info mission */}
      <div className="min-w-0">
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {types.map((type) => (
            <span
              key={type}
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-[10.5px] font-semibold uppercase tracking-wider',
                MISSION_PASTEL_CLASS[type],
              )}
            >
              {MISSION_TYPE_LABEL[type]}
            </span>
          ))}
        </div>
        <h3 className="text-lg font-bold tracking-tight text-ink mb-1 truncate">
          {name}
        </h3>
        <p className="text-sm text-ink-mute flex items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">
            {address}
            {travelMeta && <span className="text-ink-faint"> · {travelMeta}</span>}
          </span>
        </p>
      </div>

      {/* Colonne 3 — Actions */}
      {actions && <div className="flex gap-2 items-center shrink-0">{actions}</div>}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cardClasses}>
        {content}
      </Link>
    )
  }

  return <div className={cardClasses}>{content}</div>
}
