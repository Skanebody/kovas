'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { MissionTypeTag } from '@/components/ui/mission-type-tag'
import {
  type LatLon,
  estimateDriveMinutes,
  formatDistance,
  formatDriveMinutes,
  haversineKm,
} from '@/lib/calendar/distances'
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
  TIME_GUTTER_WIDTH_DESKTOP,
  TIME_GUTTER_WIDTH_MOBILE,
  endOfDay,
  formatTimeFR,
  pixelHeightForDuration,
  pixelOffsetForTime,
  sameDay,
  startOfDay,
} from '@/lib/calendar/shared'
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

/**
 * Vue Jour — grille horaire style Apple Calendar / Cron / Notion Calendar.
 *
 * Graduation :
 *   - heures pleines : label JetBrains Mono à gauche + ligne pleine `border-rule/60`
 *   - demi-heures : ligne pointillée discrète `border-dashed border-rule/30`
 *   - hauteur 48px par heure (24px par 30min) sur desktop, 40px mobile
 *
 * Ligne "heure courante" :
 *   - trait horizontal `bg-accent-red h-px` + cercle 12px à gauche dans le gutter
 *   - se met à jour toutes les 60s côté client (uniquement si on regarde aujourd'hui)
 */
export function DayView({ date, events, origin, onSelectEvent }: DayViewProps) {
  // Hauteur d'heure responsive : 40px mobile / 48px desktop.
  const [hourHeight, setHourHeight] = useState(HOUR_HEIGHT_DESKTOP)
  const [gutter, setGutter] = useState(TIME_GUTTER_WIDTH_DESKTOP)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(min-width: 640px)')
    const update = () => {
      const isDesktop = mql.matches
      setHourHeight(isDesktop ? HOUR_HEIGHT_DESKTOP : HOUR_HEIGHT_MOBILE)
      setGutter(isDesktop ? TIME_GUTTER_WIDTH_DESKTOP : TIME_GUTTER_WIDTH_MOBILE)
    }
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  // Now line — uniquement si on regarde aujourd'hui. Tick chaque minute.
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
      if (
        a?.latitude != null &&
        a.longitude != null &&
        b?.latitude != null &&
        b.longitude != null
      ) {
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
  const halfHourHeight = hourHeight / 2

  // Empty state — on garde la grille horaire visible en arrière-plan.
  const hasEvents = dayEvents.length > 0

  // Position de la now-line sur la timeline (uniquement si aujourd'hui).
  const nowOffset = isToday ? pixelOffsetForTime(now, hourHeight) : -1
  const nowVisible = nowOffset >= 0 && nowOffset <= timelineHeight

  return (
    <div className="rounded-2xl border border-rule/70 bg-sage overflow-hidden">
      <div className="relative flex" style={{ height: `${timelineHeight}px` }}>
        {/* Colonne gauche fixed : labels d'heure */}
        <div
          className="shrink-0 relative border-r border-rule/40 bg-sage"
          style={{ width: `${gutter}px` }}
          aria-hidden
        >
          {Array.from({ length: DAY_HOUR_COUNT }, (_, i) => {
            const hour = DAY_HOUR_START + i
            return (
              <div key={hour} className="relative" style={{ height: `${hourHeight}px` }}>
                {/* Label heure pleine — aligné sur la ligne (i.e. en haut de la cellule).
                    Pour la première heure, on évite que le label déborde du haut du conteneur. */}
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

        {/* Zone événements + graduation */}
        <div className="relative flex-1">
          {/* Graduation horaire (heures pleines = trait solide, demi-heures = pointillé) */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: DAY_HOUR_COUNT }, (_, i) => (
              <div
                key={`h-${DAY_HOUR_START + i}`}
                className="relative"
                style={{ height: `${hourHeight}px` }}
              >
                {/* Trait heure pleine en haut de la cellule (sauf la toute première) */}
                {i > 0 && (
                  <div
                    aria-hidden
                    className="absolute left-0 right-0 top-0 border-t border-rule/60"
                  />
                )}
                {/* Trait demi-heure pointillé au milieu */}
                <div
                  aria-hidden
                  className="absolute left-0 right-0 border-t border-dashed border-rule/30"
                  style={{ top: `${halfHourHeight}px` }}
                />
              </div>
            ))}
            {/* Trait final en bas */}
            <div aria-hidden className="absolute left-0 right-0 bottom-0 border-t border-rule/60" />
          </div>

          {/* Now line rouge — uniquement aujourd'hui */}
          {nowVisible && (
            <div
              className="absolute left-0 right-0 z-30 pointer-events-none"
              style={{ top: `${nowOffset}px` }}
            >
              <div className="relative flex items-center">
                {/* Cercle rouge dans le gutter (à gauche, sort du conteneur) */}
                <span
                  aria-hidden
                  className="absolute -left-[6px] -top-[5px] size-[10px] rounded-full bg-accent-red shadow-[0_0_0_2px_rgba(220,38,38,0.15)]"
                />
                {/* Trait fin rouge */}
                <span className="absolute left-0 right-0 h-px bg-accent-red" />
                {/* Pillule heure courante à droite du cercle, pos. absolue dans le gutter */}
                <span
                  className="absolute left-1 -top-2 font-mono text-[10px] text-accent-red tabular-nums font-semibold bg-sage px-1 rounded-sm"
                  style={{ transform: `translateX(${-gutter + 4}px)` }}
                >
                  {formatTimeFR(now)}
                </span>
              </div>
            </div>
          )}

          {/* Empty state OU couche events absolute */}
          {!hasEvents ? (
            <div className="absolute inset-0 flex items-center justify-center p-4 z-10">
              <EmptyState
                icon={CalendarPlus}
                title="Journée libre"
                description="Aucun rendez-vous prévu ce jour. Profitez-en pour traiter le back-office ou planifier de nouvelles missions."
                action={
                  <Button asChild variant="accent" size="sm">
                    <Link href="/dashboard/dossiers/new">
                      <CalendarPlus className="size-4" /> Planifier un rendez-vous
                    </Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="absolute inset-0 px-2 sm:px-3 z-10">
              {dayEvents.map((ev, idx) => {
                const start = new Date(ev.scheduledAt)
                const top = pixelOffsetForTime(start, hourHeight)
                const height = Math.max(
                  36,
                  pixelHeightForDuration(ev.durationMinutes, hourHeight) - 4,
                )
                const segmentBefore = segments.find((s) => s.toIdx === idx)
                return (
                  <div key={ev.dossierId}>
                    {/* Bloc trajet avant ce RDV */}
                    {segmentBefore && (
                      <TrajetBlock
                        km={segmentBefore.km}
                        minutes={segmentBefore.minutes}
                        top={Math.max(0, top - 18)}
                      />
                    )}
                    <EventBlock
                      event={ev}
                      top={top}
                      height={height}
                      onClick={() => onSelectEvent(ev)}
                    />
                  </div>
                )
              })}
            </div>
          )}
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
