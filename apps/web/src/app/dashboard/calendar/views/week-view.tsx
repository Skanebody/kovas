'use client'

import { Badge } from '@/components/ui/badge'
import { MissionTypeTag } from '@/components/ui/mission-type-tag'
import {
  type CalendarEvent,
  DAY_HOUR_COUNT,
  DAY_HOUR_START,
  DAY_NAMES_SHORT,
  HOUR_HEIGHT_DESKTOP,
  HOUR_HEIGHT_MOBILE,
  STATUS_LABELS,
  STATUS_VARIANT,
  TIME_GUTTER_WIDTH_DESKTOP,
  TIME_GUTTER_WIDTH_MOBILE,
  addDays,
  formatTimeFR,
  pixelHeightForDuration,
  pixelOffsetForTime,
  sameDay,
  startOfWeek,
} from '@/lib/calendar/shared'
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useState } from 'react'

interface WeekViewProps {
  /** Date pivot dans la semaine — la vue calcule lun → dim. */
  anchor: Date
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
  /** Bascule vers la vue Jour pour la date cliquée (header day). */
  onSelectDay: (date: Date) => void
}

/**
 * Vue Semaine — grille horaire 7 jours × graduation heures (Apple Calendar style).
 *
 * Layout :
 *   - Header sticky avec 7 boutons jour (cercle navy pour aujourd'hui)
 *   - Colonne gauche fixe = labels d'heure (gutter 60px desktop / 44px mobile)
 *   - 7 colonnes flex 1 partagent la zone événements
 *   - Lignes pleines aux heures pleines, pointillé aux demi-heures
 *   - Ligne current-time rouge si "aujourd'hui" tombe dans la semaine
 *
 * Mobile : passage en layout liste (1 colonne par jour) sous 640px via media query.
 */
export function WeekView({ anchor, events, onSelectEvent, onSelectDay }: WeekViewProps) {
  const [hourHeight, setHourHeight] = useState(HOUR_HEIGHT_DESKTOP)
  const [gutter, setGutter] = useState(TIME_GUTTER_WIDTH_DESKTOP)
  const [isDesktop, setIsDesktop] = useState(true)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(min-width: 768px)')
    const update = () => {
      const desktop = mql.matches
      setIsDesktop(desktop)
      setHourHeight(desktop ? HOUR_HEIGHT_DESKTOP : HOUR_HEIGHT_MOBILE)
      setGutter(desktop ? TIME_GUTTER_WIDTH_DESKTOP : TIME_GUTTER_WIDTH_MOBILE)
    }
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  // Now line tick chaque minute
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const today = useMemo(() => new Date(), [])

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

  const timelineHeight = DAY_HOUR_COUNT * hourHeight
  const halfHourHeight = hourHeight / 2

  // Now line uniquement si "today" est dans la semaine
  const todayInWeek = weekDays.findIndex((d) => sameDay(d, today))
  const nowOffset = todayInWeek >= 0 ? pixelOffsetForTime(now, hourHeight) : -1
  const nowVisible = nowOffset >= 0 && nowOffset <= timelineHeight

  // ---------------------------------------------------------------------------
  // Mobile fallback : liste agenda compacte par jour (pas de grille).
  // ---------------------------------------------------------------------------
  if (!isDesktop) {
    return (
      <div className="space-y-2">
        {weekDays.map((day, idx) => {
          const isToday = sameDay(day, today)
          const dayEvents = eventsByDay.get(day.toDateString()) ?? []
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'rounded-lg border border-rule/80 bg-paper overflow-hidden',
                isToday && 'ring-2 ring-[#0F1419]/30',
              )}
            >
              <button
                type="button"
                onClick={() => onSelectDay(day)}
                className={cn(
                  'w-full px-3 py-2 border-b border-rule flex items-center justify-between',
                  'hover:bg-sage-alt/40 transition-colors',
                  isToday && 'bg-sage-alt/60',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-ink-mute">
                    {DAY_NAMES_SHORT[idx]}
                  </span>
                  <span
                    className={cn(
                      'text-base font-bold tabular-nums',
                      isToday &&
                        'inline-flex items-center justify-center size-7 rounded-full bg-ink text-sage',
                    )}
                  >
                    {day.getDate()}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-ink-mute tabular-nums">
                  {dayEvents.length} RDV
                </span>
              </button>
              <div className="p-1.5 space-y-1.5">
                {dayEvents.length === 0 ? (
                  <p className="text-[11px] text-ink-mute/60 text-center py-3 italic">—</p>
                ) : (
                  dayEvents.map((ev) => (
                    <WeekEventCard
                      key={ev.dossierId}
                      event={ev}
                      onClick={() => onSelectEvent(ev)}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Desktop : grille horaire 7 colonnes + gutter heures.
  // ---------------------------------------------------------------------------
  return (
    <div className="rounded-2xl border border-rule/70 bg-sage overflow-hidden">
      {/* Header sticky : 7 jours */}
      <div className="sticky top-0 z-20 flex bg-paper/95 backdrop-blur-md border-b border-rule/60">
        {/* Spacer aligné sur le gutter */}
        <div className="shrink-0 border-r border-rule/40" style={{ width: `${gutter}px` }} />
        {weekDays.map((day, idx) => {
          const isToday = sameDay(day, today)
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2 border-r border-rule/30 last:border-r-0',
                'hover:bg-sage-alt/40 transition-colors',
              )}
              aria-label={`Voir la journée du ${day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
            >
              <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-ink-mute">
                {DAY_NAMES_SHORT[idx]}
              </span>
              <span
                className={cn(
                  'inline-flex items-center justify-center size-7 rounded-full text-[14px] font-semibold tabular-nums',
                  isToday ? 'bg-ink text-sage' : 'text-ink',
                )}
              >
                {day.getDate()}
              </span>
            </button>
          )
        })}
      </div>

      {/* Body : gutter heures + 7 colonnes */}
      <div className="relative flex" style={{ height: `${timelineHeight}px` }}>
        {/* Gutter heures */}
        <div
          className="shrink-0 relative border-r border-rule/40 bg-sage"
          style={{ width: `${gutter}px` }}
          aria-hidden
        >
          {Array.from({ length: DAY_HOUR_COUNT }, (_, i) => {
            const hour = DAY_HOUR_START + i
            return (
              <div key={hour} className="relative" style={{ height: `${hourHeight}px` }}>
                <span
                  className={cn(
                    'absolute right-2 font-mono text-[11px] text-ink-mute tabular-nums',
                    i === 0 ? 'top-1' : '-top-2 bg-sage px-1',
                  )}
                >
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
            )
          })}
        </div>

        {/* 7 colonnes jour */}
        <div className="flex-1 relative flex">
          {/* Graduation horaire commune (couche au-dessus du fond, sous les events) */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: DAY_HOUR_COUNT }, (_, i) => (
              <div
                key={`h-${DAY_HOUR_START + i}`}
                className="relative"
                style={{ height: `${hourHeight}px` }}
              >
                {i > 0 && (
                  <div
                    aria-hidden
                    className="absolute left-0 right-0 top-0 border-t border-rule/60"
                  />
                )}
                <div
                  aria-hidden
                  className="absolute left-0 right-0 border-t border-dashed border-rule/30"
                  style={{ top: `${halfHourHeight}px` }}
                />
              </div>
            ))}
            <div aria-hidden className="absolute left-0 right-0 bottom-0 border-t border-rule/60" />
          </div>

          {/* Now line — full-width sur les 7 colonnes (jour actuel uniquement) */}
          {nowVisible && (
            <div
              className="absolute left-0 right-0 z-30 pointer-events-none"
              style={{ top: `${nowOffset}px` }}
            >
              <div className="relative">
                {/* Le cercle rouge est placé sur la colonne du jour courant uniquement */}
                <span
                  aria-hidden
                  className="absolute -top-[5px] size-[10px] rounded-full bg-accent-red shadow-[0_0_0_2px_rgba(220,38,38,0.15)]"
                  style={{ left: `calc((100% / 7) * ${todayInWeek} - 5px)` }}
                />
                <span className="absolute left-0 right-0 h-px bg-accent-red" />
                <span
                  className="absolute -top-2 font-mono text-[10px] text-accent-red tabular-nums font-semibold bg-sage px-1 rounded-sm"
                  style={{ left: `calc((100% / 7) * ${todayInWeek} + 8px)` }}
                >
                  {formatTimeFR(now)}
                </span>
              </div>
            </div>
          )}

          {weekDays.map((day) => {
            const dayEvents = eventsByDay.get(day.toDateString()) ?? []
            const isToday = sameDay(day, today)
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'flex-1 relative border-r border-rule/30 last:border-r-0',
                  isToday && 'bg-chartreuse/[0.04]',
                )}
              >
                <div className="absolute inset-0 px-1 z-10">
                  {dayEvents.map((ev) => {
                    const start = new Date(ev.scheduledAt)
                    const top = pixelOffsetForTime(start, hourHeight)
                    const height = Math.max(
                      28,
                      pixelHeightForDuration(ev.durationMinutes, hourHeight) - 2,
                    )
                    return (
                      <WeekTimelineBlock
                        key={ev.dossierId}
                        event={ev}
                        top={top}
                        height={height}
                        onClick={() => onSelectEvent(ev)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Bloc événement positionné sur la grille horaire (desktop).
// =============================================================================

interface WeekTimelineBlockProps {
  event: CalendarEvent
  top: number
  height: number
  onClick: () => void
}

function WeekTimelineBlock({ event, top, height, onClick }: WeekTimelineBlockProps) {
  const start = new Date(event.scheduledAt)
  const timeStart = formatTimeFR(start)
  const isCancelled = event.status === 'cancelled'
  const isDone = event.status === 'done' || event.status === 'archived'
  const isCompact = height < 40

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ top: `${top}px`, height: `${height}px` }}
      className={cn(
        'absolute left-0 right-0 text-left rounded-md px-1.5 py-1 transition-all',
        'bg-[#0F1419]/[0.06] border-l-2 border-[#0F1419] hover:bg-[#0F1419]/[0.1] hover:-translate-y-px overflow-hidden',
        isCancelled && 'opacity-60 line-through decoration-1',
        isDone && 'bg-accent-green/[0.08] border-l-accent-green hover:bg-accent-green/[0.15]',
      )}
      title={`${timeStart} — ${event.clientName ?? 'Sans client'}`}
    >
      <div className="font-mono text-[10px] tabular-nums font-semibold text-ink leading-tight">
        {timeStart}
      </div>
      {!isCompact && (
        <div className="text-[11px] font-medium text-ink truncate leading-tight">
          {event.clientName ?? 'Sans client'}
        </div>
      )}
    </button>
  )
}

// =============================================================================
// Carte événement mobile (fallback < 768px).
// =============================================================================

interface WeekEventCardProps {
  event: CalendarEvent
  onClick: () => void
}

function WeekEventCard({ event, onClick }: WeekEventCardProps) {
  const start = new Date(event.scheduledAt)
  const end = new Date(start.getTime() + event.durationMinutes * 60_000)
  const timeStart = formatTimeFR(start)
  const timeEnd = formatTimeFR(end)

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
