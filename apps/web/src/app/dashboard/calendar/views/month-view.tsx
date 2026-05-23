'use client'

import { MissionTypeTag } from '@/components/ui/mission-type-tag'
import {
  type CalendarEvent,
  DAY_NAMES_SHORT,
  addDays,
  formatTimeFR,
  sameDay,
  startOfMonth,
  startOfWeek,
} from '@/lib/calendar/shared'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'

interface MonthViewProps {
  /** Date pivot dans le mois — on calcule grille 7×6 incluant overflow voisins. */
  anchor: Date
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
  /** Bascule en vue Jour pour la date cliquée. */
  onSelectDay: (date: Date) => void
}

const MAX_EVENTS_PER_CELL = 3

/**
 * Vue Mois — grille 7×6 cases jour entier (pas de timeline horaire).
 *
 * Layout :
 *   - Header bandeau navy 28px de haut avec noms de jours JetBrains Mono uppercase
 *   - Cellules min-height 96px desktop, padding 8px
 *   - Numéro du jour en haut à gauche ; aujourd'hui = cercle navy 24px cream
 *   - Max 3 événements visibles + "+N autres"
 *   - Hover lift léger
 */
export function MonthView({ anchor, events, onSelectEvent, onSelectDay }: MonthViewProps) {
  const today = new Date()
  const monthStart = useMemo(() => startOfMonth(anchor), [anchor])
  const currentMonth = monthStart.getMonth()

  // Grille 6 semaines × 7 jours = 42 cases (couvre tous les mois possibles).
  const gridStart = useMemo(() => startOfWeek(monthStart), [monthStart])
  const cells = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)),
    [gridStart],
  )

  // Groupement events par jour pour la grille.
  const eventsByDay = useMemo(() => {
    const map: Map<string, CalendarEvent[]> = new Map()
    for (const ev of events) {
      const d = new Date(ev.scheduledAt)
      const key = d.toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)?.push(ev)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    }
    return map
  }, [events])

  // Compteur events du mois actif pour la légende bas.
  const monthEventCount = useMemo(() => {
    return events.filter((ev) => new Date(ev.scheduledAt).getMonth() === currentMonth).length
  }, [events, currentMonth])

  return (
    <div className="rounded-2xl border border-rule/70 bg-paper overflow-hidden shadow-glass-sm">
      {/* Header bandeau navy noms de jours */}
      <div className="grid grid-cols-7 bg-[#0F1419] h-7">
        {DAY_NAMES_SHORT.map((name) => (
          <div
            key={name}
            className="flex items-center justify-center text-center font-mono text-[10px] uppercase tracking-[0.12em] font-semibold text-sage/90"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Grille 6×7 */}
      <div className="grid grid-cols-7 grid-rows-6">
        {cells.map((day, idx) => {
          const isToday = sameDay(day, today)
          const isInCurrentMonth = day.getMonth() === currentMonth
          const dayEvents = eventsByDay.get(day.toDateString()) ?? []
          const visibleEvents = dayEvents.slice(0, MAX_EVENTS_PER_CELL)
          const overflow = dayEvents.length - visibleEvents.length
          const isLastCol = idx % 7 === 6
          const isLastRow = idx >= 35

          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={cn(
                'relative flex flex-col items-stretch text-left min-h-[88px] sm:min-h-[96px] p-2 border-r border-b border-rule/40 transition-all',
                'hover:bg-sage-alt/40 hover:shadow-glass-sm hover:z-10',
                !isInCurrentMonth && 'opacity-50 bg-sage-alt/20',
                isToday && 'bg-chartreuse/[0.08]',
                isLastCol && 'border-r-0',
                isLastRow && 'border-b-0',
              )}
            >
              {/* En-tête cellule : numéro jour + badge today */}
              <div className="flex items-center justify-between mb-1.5">
                {isToday ? (
                  <span
                    aria-hidden
                    className="inline-flex items-center justify-center size-6 rounded-full bg-ink text-sage font-mono text-[11px] font-semibold tabular-nums"
                  >
                    {day.getDate()}
                  </span>
                ) : (
                  <span
                    className={cn(
                      'font-mono text-[11px] tabular-nums font-medium leading-none pl-0.5',
                      isInCurrentMonth ? 'text-ink' : 'text-ink-mute',
                    )}
                  >
                    {day.getDate()}
                  </span>
                )}
                {dayEvents.length > 0 && (
                  <span className="text-[9px] font-mono text-ink-mute tabular-nums leading-none pr-0.5">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* Liste events compacts */}
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {visibleEvents.map((ev) => (
                  <MonthEventPill
                    key={ev.dossierId}
                    event={ev}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectEvent(ev)
                    }}
                  />
                ))}
                {overflow > 0 && (
                  <div className="text-[10px] font-mono text-ink-mute px-1 pt-0.5">
                    +{overflow} autre{overflow > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Légende basse */}
      <div className="px-3 py-2 border-t border-rule/60 bg-sage-alt/30 flex items-center justify-between flex-wrap gap-2">
        <span className="text-[11px] font-mono text-ink-mute tabular-nums">
          {monthEventCount} RDV ce mois-ci
        </span>
        <span className="text-[10px] text-ink-mute italic">
          Cliquez sur un jour pour voir le détail.
        </span>
      </div>
    </div>
  )
}

interface MonthEventPillProps {
  event: CalendarEvent
  onClick: (e: React.MouseEvent) => void
}

function MonthEventPill({ event, onClick }: MonthEventPillProps) {
  const start = new Date(event.scheduledAt)
  const time = formatTimeFR(start)
  const mainType = event.missionTypes[0]
  const isCancelled = event.status === 'cancelled'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 w-full text-left rounded-sm px-1 py-0.5',
        'hover:bg-[#0F1419]/10 transition-colors',
        isCancelled && 'opacity-50 line-through decoration-1',
      )}
      title={`${time} — ${event.clientName ?? 'Sans client'}`}
    >
      <span className="font-mono text-[10px] tabular-nums text-ink-mute shrink-0">{time}</span>
      {mainType ? (
        <MissionTypeTag
          type={mainType}
          size="short"
          className="text-[8px] px-1 py-0 rounded-sm truncate"
        />
      ) : (
        <span className="text-[10px] text-ink truncate">{event.clientName ?? 'Sans client'}</span>
      )}
    </button>
  )
}
