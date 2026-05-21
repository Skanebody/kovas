'use client'

import { MissionTypeTag } from '@/components/ui/mission-type-tag'
import {
  type CalendarEvent,
  DAY_NAMES_SHORT,
  addDays,
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
    <div className="rounded-2xl border border-rule/70 bg-paper overflow-hidden">
      {/* Header noms de jours */}
      <div className="grid grid-cols-7 border-b border-rule/60 bg-sage-alt/30">
        {DAY_NAMES_SHORT.map((name) => (
          <div
            key={name}
            className="px-2 py-2 text-center text-[10px] uppercase tracking-wider font-semibold text-ink-mute"
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

          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={cn(
                'relative flex flex-col items-stretch text-left min-h-[88px] sm:min-h-[110px] p-1.5 border-r border-b border-rule/40 transition-colors',
                'hover:bg-[#0F1419]/[0.03]',
                !isInCurrentMonth && 'opacity-40',
                isToday && 'bg-chartreuse/[0.06]',
                idx % 7 === 6 && 'border-r-0',
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    'font-mono text-[11px] tabular-nums font-medium',
                    isToday ? 'text-ink' : 'text-ink-mute',
                  )}
                >
                  {day.getDate()}
                </span>
                {isToday && (
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full bg-chartreuse shadow-[0_0_4px_rgba(212,245,66,0.6)]"
                  />
                )}
              </div>

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
  const time = start.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
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
        <span className="text-[10px] text-ink truncate">
          {event.clientName ?? 'Sans client'}
        </span>
      )}
    </button>
  )
}
