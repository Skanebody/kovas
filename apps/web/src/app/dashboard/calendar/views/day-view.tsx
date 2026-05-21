'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { MissionTypeTag } from '@/components/ui/mission-type-tag'
import {
  type CalendarEvent,
  DAY_HOUR_COUNT,
  DAY_HOUR_START,
  HOUR_HEIGHT_DESKTOP,
  HOUR_HEIGHT_MOBILE,
  type OriginCoords,
  STATUS_BORDER_COLOR,
  STATUS_LABELS,
  STATUS_VARIANT,
  endOfDay,
  formatTimeFR,
  pixelHeightForDuration,
  pixelOffsetForTime,
  sameDay,
  startOfDay,
} from '@/lib/calendar/shared'
import {
  estimateDriveMinutes,
  formatDistance,
  formatDriveMinutes,
  haversineKm,
  type LatLon,
} from '@/lib/calendar/distances'
import { cn } from '@/lib/utils'
import { CalendarPlus, Car } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

interface DayViewProps {
  /** Date du jour à afficher (sera ramené à startOfDay). */
  date: Date
  events: CalendarEvent[]
  /** Coordonnées d'origine de tournée (cabinet/domicile). */
  origin: OriginCoords | null
  onSelectEvent: (event: CalendarEvent) => void
}

export function DayView({ date, events, origin, onSelectEvent }: DayViewProps) {
  // Hauteur d'heure responsive : 40px mobile / 60px desktop.
  const [hourHeight, setHourHeight] = useState(HOUR_HEIGHT_DESKTOP)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(min-width: 640px)')
    const update = () => setHourHeight(mql.matches ? HOUR_HEIGHT_DESKTOP : HOUR_HEIGHT_MOBILE)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  // Now line — uniquement si on regarde aujourd'hui.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const isToday = sameDay(date, now)

  const dayStart = useMemo(() => startOfDay(date), [date])
  const dayEnd = useMemo(() => endOfDay(date), [date])

  // Events du jour triés par heure début.
  const dayEvents = useMemo(() => {
    return events
      .filter((ev) => {
        const t = new Date(ev.scheduledAt).getTime()
        return t >= dayStart.getTime() && t <= dayEnd.getTime()
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  }, [events, dayStart, dayEnd])

  // Trajets entre RDV consécutifs (et entre origin → premier RDV si origin set).
  const segments = useMemo(() => {
    const out: { fromIdx: number; toIdx: number; km: number; minutes: number }[] = []
    if (origin && dayEvents.length > 0) {
      const first = dayEvents[0]
      if (first?.latitude != null && first.longitude != null) {
        const km = haversineKm(
          { lat: origin.lat, lon: origin.lon },
          { lat: first.latitude, lon: first.longitude },
        )
        if (Number.isFinite(km) && km > 0.1) {
          out.push({ fromIdx: -1, toIdx: 0, km, minutes: estimateDriveMinutes(km) })
        }
      }
    }
    for (let i = 0; i < dayEvents.length - 1; i++) {
      const a = dayEvents[i]
      const b = dayEvents[i + 1]
      if (a?.latitude != null && a.longitude != null && b?.latitude != null && b.longitude != null) {
        const fromCoords: LatLon = { lat: a.latitude, lon: a.longitude }
        const toCoords: LatLon = { lat: b.latitude, lon: b.longitude }
        const km = haversineKm(fromCoords, toCoords)
        if (Number.isFinite(km) && km > 0.1) {
          out.push({ fromIdx: i, toIdx: i + 1, km, minutes: estimateDriveMinutes(km) })
        }
      }
    }
    return out
  }, [dayEvents, origin])

  const timelineHeight = DAY_HOUR_COUNT * hourHeight

  // Empty state
  if (dayEvents.length === 0) {
    return (
      <div className="rounded-2xl border border-rule/70 bg-[#F5F7F4] overflow-hidden">
        <EmptyState
          icon={CalendarPlus}
          title="Journée libre"
          description="Aucun rendez-vous prévu ce jour-là. Profitez-en pour traiter le back-office ou planifier de nouvelles missions."
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

  // Position de la now-line sur la timeline (uniquement si aujourd'hui).
  const nowOffset = isToday ? pixelOffsetForTime(now, hourHeight) : -1
  const nowVisible = nowOffset >= 0 && nowOffset <= timelineHeight

  return (
    <div className="rounded-2xl border border-rule/70 bg-[#F5F7F4] overflow-hidden">
      <div className="relative" style={{ height: `${timelineHeight}px` }}>
        {/* Grille heures (background + labels gauche) */}
        <div className="absolute inset-0 grid" style={{ gridTemplateRows: `repeat(${DAY_HOUR_COUNT}, ${hourHeight}px)` }}>
          {Array.from({ length: DAY_HOUR_COUNT }, (_, i) => {
            const hour = DAY_HOUR_START + i
            return (
              <div
                key={hour}
                className="relative border-b border-[#0F1419]/[0.06]"
              >
                <span className="absolute -top-2 left-1 sm:left-3 font-mono text-[11px] text-ink-mute tabular-nums bg-[#F5F7F4] px-1">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
            )
          })}
        </div>

        {/* Now line rouge animée (aujourd'hui uniquement) */}
        {nowVisible && (
          <div
            className="absolute left-12 sm:left-16 right-2 sm:right-4 z-30 pointer-events-none"
            style={{ top: `${nowOffset}px` }}
          >
            <div className="relative flex items-center">
              <span
                aria-hidden
                className="absolute -left-1.5 size-3 rounded-full bg-accent-red animate-pulse-soft"
              />
              <span className="h-px w-full bg-accent-red/80" />
              <span className="absolute -left-12 sm:-left-14 -top-2 font-mono text-[10px] text-accent-red tabular-nums font-semibold bg-[#F5F7F4] px-1">
                {formatTimeFR(now)}
              </span>
            </div>
          </div>
        )}

        {/* Couche events positionnée en absolute */}
        <div className="absolute inset-0 pl-12 sm:pl-16 pr-2 sm:pr-4 z-10">
          {dayEvents.map((ev, idx) => {
            const start = new Date(ev.scheduledAt)
            const top = pixelOffsetForTime(start, hourHeight)
            const height = Math.max(40, pixelHeightForDuration(ev.durationMinutes, hourHeight) - 4)
            const segmentBefore = segments.find((s) => s.toIdx === idx)
            return (
              <div key={ev.dossierId}>
                {/* Bloc trajet avant ce RDV */}
                {segmentBefore && (
                  <TrajetBlock
                    km={segmentBefore.km}
                    minutes={segmentBefore.minutes}
                    top={top - 20}
                  />
                )}
                <EventBlock event={ev} top={top} height={height} onClick={() => onSelectEvent(ev)} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Bloc événement (iOS-style border-left colorée selon statut).
// =============================================================================

interface EventBlockProps {
  event: CalendarEvent
  top: number
  height: number
  onClick: () => void
}

function EventBlock({ event, top, height, onClick }: EventBlockProps) {
  const start = new Date(event.scheduledAt)
  const end = new Date(start.getTime() + event.durationMinutes * 60_000)
  const timeStart = formatTimeFR(start)
  const timeEnd = formatTimeFR(end)
  const addressLine = [event.address, event.city].filter(Boolean).join(', ')
  const isCancelled = event.status === 'cancelled'
  const borderColor = STATUS_BORDER_COLOR[event.status] ?? 'border-l-[#9CA3AF]'
  const isCompact = height < 56

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ top: `${top}px`, height: `${height}px` }}
      className={cn(
        'absolute left-0 right-0 text-left rounded-md p-2 sm:p-3 transition-all',
        'bg-paper border border-rule/60 border-l-[3px] shadow-glass-sm',
        'hover:shadow-glass hover:-translate-y-px',
        borderColor,
        isCancelled && 'opacity-60',
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="font-mono font-semibold tabular-nums text-ink text-[11px] sm:text-[12px]">
          {timeStart} → {timeEnd}
        </span>
        <Badge
          variant={STATUS_VARIANT[event.status] ?? 'muted'}
          className="text-[9px] px-1.5 py-0 leading-tight shrink-0"
        >
          {STATUS_LABELS[event.status] ?? event.status}
        </Badge>
      </div>
      <div
        className={cn(
          'font-semibold text-ink truncate text-[12px] sm:text-[13px]',
          isCancelled && 'line-through decoration-1',
        )}
        title={event.clientName ?? undefined}
      >
        {event.clientName ?? 'Sans client'}
      </div>
      {!isCompact && addressLine && (
        <div className="text-[11px] text-ink-mute line-clamp-1 mt-0.5">{addressLine}</div>
      )}
      {!isCompact && event.missionTypes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {event.missionTypes.slice(0, 4).map((t) => (
            <MissionTypeTag key={t} type={t} size="short" className="text-[9px] px-1.5 py-0.5" />
          ))}
          {event.missionTypes.length > 4 && (
            <span className="text-[9px] text-ink-mute font-mono px-1 py-0.5">
              +{event.missionTypes.length - 4}
            </span>
          )}
        </div>
      )}
      <div className="absolute bottom-1 right-2 font-mono text-[9px] text-ink-mute/60 uppercase tracking-wider">
        {event.reference}
      </div>
    </button>
  )
}

// =============================================================================
// Bloc trajet entre deux RDV.
// =============================================================================

interface TrajetBlockProps {
  km: number
  minutes: number
  top: number
}

function TrajetBlock({ km, minutes, top }: TrajetBlockProps) {
  return (
    <div
      style={{ top: `${top}px` }}
      className={cn(
        'absolute left-0 right-0 h-5 flex items-center gap-1.5 px-2',
        'text-[10px] font-mono text-ink-mute/80 italic z-0',
      )}
      aria-hidden
    >
      <Car className="size-3 shrink-0" />
      <span className="truncate">
        Trajet {formatDistance(km)} · {formatDriveMinutes(minutes)}
      </span>
    </div>
  )
}
