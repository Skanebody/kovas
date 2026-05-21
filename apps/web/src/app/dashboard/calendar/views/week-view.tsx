'use client'

import { Badge } from '@/components/ui/badge'
import { MissionTypeTag } from '@/components/ui/mission-type-tag'
import {
  type CalendarEvent,
  DAY_NAMES_SHORT,
  STATUS_LABELS,
  STATUS_VARIANT,
  addDays,
  sameDay,
  startOfWeek,
} from '@/lib/calendar/shared'
import { cn } from '@/lib/utils'
import { useMemo, useState } from 'react'

interface WeekViewProps {
  /** Date pivot dans la semaine — la vue calcule lun → dim. */
  anchor: Date
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
  /** Bascule vers la vue Jour pour la date cliquée (header day). */
  onSelectDay: (date: Date) => void
}

const MAX_EVENTS_PER_DAY_COLLAPSED = 3

export function WeekView({ anchor, events, onSelectEvent, onSelectDay }: WeekViewProps) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const today = new Date()

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const eventsByDay = useMemo(() => {
    const byDay: Map<string, CalendarEvent[]> = new Map()
    for (const day of weekDays) {
      byDay.set(day.toDateString(), [])
    }
    for (const ev of events) {
      const d = new Date(ev.scheduledAt)
      const key = d.toDateString()
      const bucket = byDay.get(key)
      if (bucket) bucket.push(ev)
    }
    for (const arr of byDay.values()) {
      arr.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    }
    return byDay
  }, [events, weekDays])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
      {weekDays.map((day, idx) => {
        const isToday = sameDay(day, today)
        const dayKey = day.toDateString()
        const dayEvents = eventsByDay.get(dayKey) ?? []
        const isExpanded = expandedDay === dayKey
        const visibleEvents = isExpanded
          ? dayEvents
          : dayEvents.slice(0, MAX_EVENTS_PER_DAY_COLLAPSED)
        const hidden = dayEvents.length - visibleEvents.length

        return (
          <div
            key={day.toISOString()}
            className={cn(
              'rounded-lg border border-rule/80 bg-paper flex flex-col min-h-[180px] sm:min-h-[280px] lg:min-h-[420px]',
              isToday && 'ring-2 ring-[#0F1419]/30 bg-[#0F1419]/[0.03]',
            )}
          >
            {/* Header cliquable -> bascule vue Jour */}
            <button
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                'px-3 py-2 border-b border-rule text-center sticky top-0 bg-paper/80 backdrop-blur-md hover:bg-[#0F1419]/[0.05] transition-colors',
                isToday && 'bg-[#0F1419]/[0.06]',
              )}
              aria-label={`Voir la journée du ${day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
            >
              <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-mute">
                {DAY_NAMES_SHORT[idx]}
              </div>
              <div
                className={cn(
                  'text-base font-bold tracking-tight tabular-nums',
                  isToday && 'text-ink',
                )}
              >
                {day.getDate()}
              </div>
            </button>

            <div className="flex-1 p-1.5 space-y-1.5">
              {dayEvents.length === 0 ? (
                <p className="text-[11px] text-ink-mute/60 text-center pt-3 italic">—</p>
              ) : (
                <>
                  {visibleEvents.map((ev) => (
                    <WeekEventCard
                      key={ev.dossierId}
                      event={ev}
                      onClick={() => onSelectEvent(ev)}
                    />
                  ))}
                  {hidden > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedDay(dayKey)}
                      className="w-full text-[11px] text-ink-mute hover:text-ink rounded-md py-1 hover:bg-sage-alt/40 transition-colors font-medium"
                    >
                      + {hidden} autre{hidden > 1 ? 's' : ''}
                    </button>
                  )}
                  {isExpanded && dayEvents.length > MAX_EVENTS_PER_DAY_COLLAPSED && (
                    <button
                      type="button"
                      onClick={() => setExpandedDay(null)}
                      className="w-full text-[11px] text-ink-mute hover:text-ink rounded-md py-1 hover:bg-sage-alt/40 transition-colors"
                    >
                      Réduire
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Footer total */}
            <div className="px-3 py-1.5 border-t border-rule/40 text-center">
              <span className="text-[10px] font-mono text-ink-mute tabular-nums">
                {dayEvents.length} RDV
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface WeekEventCardProps {
  event: CalendarEvent
  onClick: () => void
}

function WeekEventCard({ event, onClick }: WeekEventCardProps) {
  const start = new Date(event.scheduledAt)
  const end = new Date(start.getTime() + event.durationMinutes * 60_000)
  const timeStart = start.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
  const timeEnd = end.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })

  const isCancelled = event.status === 'cancelled'
  const isDone = event.status === 'done' || event.status === 'archived'

  const addressLine = [event.address, event.city].filter(Boolean).join(', ')

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'block w-full text-left rounded-md p-2 text-[11px] hover:shadow-glass transition-all',
        'bg-[#0F1419]/[0.06] border-l-2 border-[#0F1419] hover:bg-[#0F1419]/[0.1] hover:-translate-y-px',
        isCancelled && 'opacity-60 line-through decoration-1',
        isDone && 'border-l-accent-green bg-accent-green/[0.06] hover:bg-accent-green/[0.1]',
      )}
    >
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <span className="font-mono font-semibold tabular-nums text-ink text-[11px]">
          {timeStart} → {timeEnd}
        </span>
        <Badge
          variant={STATUS_VARIANT[event.status] ?? 'muted'}
          className="text-[9px] px-1.5 py-0 leading-tight"
        >
          {STATUS_LABELS[event.status] ?? event.status}
        </Badge>
      </div>
      <div className="font-semibold text-ink truncate" title={event.clientName ?? undefined}>
        {event.clientName ?? 'Sans client'}
      </div>
      {addressLine && (
        <div className="text-ink-mute line-clamp-2 mt-0.5 leading-snug">{addressLine}</div>
      )}
      {event.missionTypes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {event.missionTypes.map((t) => (
            <MissionTypeTag key={t} type={t} size="short" className="text-[9px] px-1.5 py-0.5" />
          ))}
        </div>
      )}
    </button>
  )
}
