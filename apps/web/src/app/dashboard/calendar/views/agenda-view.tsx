'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { MissionTypeTag } from '@/components/ui/mission-type-tag'
import {
  type CalendarEvent,
  DAY_NAMES_LONG,
  MONTH_NAMES,
  STATUS_LABELS,
  STATUS_VARIANT,
  formatTimeFR,
  isWeekend,
  sameDay,
} from '@/lib/calendar/shared'
import { cn } from '@/lib/utils'
import { CalendarPlus, ChevronRight, MapPin } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'

interface AgendaViewProps {
  /** Date pivot — la vue affiche typiquement la semaine ou le mois courant. */
  anchor: Date
  /** Plage de dates à inclure (par exemple semaine ou mois) — events seront filtrés. */
  rangeStart: Date
  rangeEnd: Date
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
}

export function AgendaView({ rangeStart, rangeEnd, events, onSelectEvent }: AgendaViewProps) {
  const today = new Date()

  // Filtrage + groupement par jour.
  const groupedDays = useMemo(() => {
    const filtered = events
      .filter((ev) => {
        const t = new Date(ev.scheduledAt).getTime()
        return t >= rangeStart.getTime() && t <= rangeEnd.getTime()
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

    const map: Map<string, { date: Date; events: CalendarEvent[] }> = new Map()
    for (const ev of filtered) {
      const d = new Date(ev.scheduledAt)
      const key = d.toDateString()
      if (!map.has(key)) {
        map.set(key, { date: d, events: [] })
      }
      map.get(key)?.events.push(ev)
    }
    return Array.from(map.values())
  }, [events, rangeStart, rangeEnd])

  if (groupedDays.length === 0) {
    return (
      <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-[#F5F7F4] overflow-hidden">
        <EmptyState
          icon={CalendarPlus}
          title="Agenda vide"
          description="Aucun rendez-vous sur la période sélectionnée. Élargis la fenêtre ou planifie un nouveau RDV."
          action={
            <Button asChild variant="accent" size="sm">
              <Link href="/dashboard/dossiers/new">
                <CalendarPlus className="size-4" /> Planifier un rendez-vous
              </Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper overflow-hidden">
      <div className="divide-y divide-[#0F1419]/[0.08]">
        {groupedDays.map(({ date, events: dayEvents }) => {
          const isToday = sameDay(date, today)
          const dayLabel = formatDayHeader(date, isToday)
          const showWeekendBadge = isWeekend(date)
          return (
            <section key={date.toISOString()}>
              <div
                className={cn(
                  'sticky top-0 z-10 px-3 sm:px-4 py-2 border-b border-[#0F1419]/[0.08] flex items-center justify-between gap-2 flex-wrap',
                  'bg-sage-alt/80 ',
                  isToday && 'bg-chartreuse/[0.12]',
                )}
              >
                <h3
                  className={cn(
                    'text-[13px] font-semibold capitalize',
                    isToday ? 'text-[#0F1419]' : 'text-[#0F1419]/82',
                  )}
                >
                  {dayLabel}
                </h3>
                <div className="flex items-center gap-2">
                  {showWeekendBadge && (
                    <Badge variant="amber" className="text-[9px]">
                      Weekend · majoration +50€
                    </Badge>
                  )}
                  <span className="text-[10px] font-mono text-[#0F1419]/72 tabular-nums">
                    {dayEvents.length} RDV
                  </span>
                </div>
              </div>
              <ul className="divide-y divide-[#0F1419]/[0.05]">
                {dayEvents.map((ev) => (
                  <AgendaRow key={ev.dossierId} event={ev} onClick={() => onSelectEvent(ev)} />
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function formatDayHeader(date: Date, isToday: boolean): string {
  const dayName = DAY_NAMES_LONG[date.getDay() === 0 ? 6 : date.getDay() - 1]
  const month = MONTH_NAMES[date.getMonth()]
  const base = `${dayName} ${date.getDate()} ${month}`
  if (isToday) return `${base} · Aujourd'hui`
  return base
}

interface AgendaRowProps {
  event: CalendarEvent
  onClick: () => void
}

function AgendaRow({ event, onClick }: AgendaRowProps) {
  const start = new Date(event.scheduledAt)
  const end = new Date(start.getTime() + event.durationMinutes * 60_000)
  const timeStart = formatTimeFR(start)
  const timeEnd = formatTimeFR(end)
  const addressLine = [event.address, event.city].filter(Boolean).join(', ')
  const isCancelled = event.status === 'cancelled'

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full text-left px-3 sm:px-4 py-3 hover:bg-[#0F1419]/[0.04] transition-colors',
          'flex items-start gap-3',
          isCancelled && 'opacity-60',
        )}
      >
        {/* Heure : pillule mono "08:30 → 10:00" avec séparateur · */}
        <div className="shrink-0 w-20 sm:w-24 pt-0.5">
          <div className="font-mono font-semibold tabular-nums text-[#0F1419] text-[12px] leading-tight">
            {timeStart}
          </div>
          <div className="font-mono tabular-nums text-[#0F1419]/55 text-[10px] leading-tight">
            → {timeEnd}
          </div>
        </div>

        {/* Séparateur visuel · */}
        <span aria-hidden className="text-[#0F1419]/40 text-[14px] leading-none select-none pt-0.5">
          ·
        </span>

        {/* Contenu central */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'font-semibold text-[#0F1419] text-[13px] truncate',
                isCancelled && 'line-through decoration-1',
              )}
            >
              {event.clientName ?? 'Sans client'}
            </span>
            <Badge
              variant={STATUS_VARIANT[event.status] ?? 'muted'}
              className="text-[9px] px-1.5 py-0 leading-tight"
            >
              {STATUS_LABELS[event.status] ?? event.status}
            </Badge>
          </div>

          {addressLine && (
            <div className="flex items-center gap-1 text-[11px] text-[#0F1419]/72">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{addressLine}</span>
            </div>
          )}

          {event.missionTypes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {event.missionTypes.map((t) => (
                <MissionTypeTag
                  key={t}
                  type={t}
                  size="short"
                  className="text-[9px] px-1.5 py-0.5"
                />
              ))}
            </div>
          )}

          <div className="font-mono text-[9px] text-[#0F1419]/55 uppercase tracking-wider">
            {event.reference}
          </div>
        </div>

        {/* Chevron */}
        <ChevronRight className="size-4 text-[#0F1419]/55 shrink-0 mt-1" aria-hidden />
      </button>
    </li>
  )
}
