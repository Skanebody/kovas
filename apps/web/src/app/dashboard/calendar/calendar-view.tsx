'use client'

import { Button } from '@/components/ui/button'
import {
  type CalendarEvent,
  DAY_NAMES_LONG,
  MONTH_NAMES,
  addDays,
  addMonths,
  endOfDay,
  type OriginCoords,
  sameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from '@/lib/calendar/shared'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { type CalendarEventDetail, EventDetailSheet } from './event-detail-sheet'
import { ViewSwitcher, type CalendarViewMode } from './view-switcher'
import { AgendaView } from './views/agenda-view'
import { DayView } from './views/day-view'
import { MonthView } from './views/month-view'
import { WeekView } from './views/week-view'

interface CalendarViewProps {
  events: CalendarEvent[]
  origin: OriginCoords | null
}

const LOCALSTORAGE_KEY = 'kovas:calendar:view'

/**
 * `<CalendarView>` — composant racine du calendrier KOVAS style iOS.
 *
 * Orchestrateur : tient le viewMode (Day / Week / Month / Agenda), la date pivot
 * (`anchor`), et le RDV sélectionné. Délègue le rendu aux sous-vues.
 *
 * Persistance : viewMode mémorisé en localStorage (re-hydraté après mount pour
 * éviter mismatch SSR).
 */
export function CalendarView({ events, origin }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week')
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventDetail | null>(null)

  // Hydratation viewMode depuis localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = window.localStorage.getItem(LOCALSTORAGE_KEY)
      if (saved === 'day' || saved === 'week' || saved === 'month' || saved === 'agenda') {
        setViewMode(saved)
      }
    } catch {
      // localStorage indisponible (mode privé) — fallback default
    }
  }, [])

  const handleViewChange = useCallback((mode: CalendarViewMode) => {
    setViewMode(mode)
    try {
      window.localStorage.setItem(LOCALSTORAGE_KEY, mode)
    } catch {
      // silencieux
    }
  }, [])

  // Navigation : pas d'incrément selon viewMode.
  const goPrev = useCallback(() => {
    setAnchor((curr) => {
      if (viewMode === 'day') return addDays(curr, -1)
      if (viewMode === 'week') return addDays(curr, -7)
      if (viewMode === 'month') return addMonths(curr, -1)
      // agenda = navigue par semaine
      return addDays(curr, -7)
    })
  }, [viewMode])

  const goNext = useCallback(() => {
    setAnchor((curr) => {
      if (viewMode === 'day') return addDays(curr, 1)
      if (viewMode === 'week') return addDays(curr, 7)
      if (viewMode === 'month') return addMonths(curr, 1)
      return addDays(curr, 7)
    })
  }, [viewMode])

  const goToday = useCallback(() => setAnchor(new Date()), [])

  // Titre période selon viewMode.
  const periodLabel = useMemo(() => formatPeriodLabel(anchor, viewMode), [anchor, viewMode])

  // Aujourd'hui actif ?
  const today = useMemo(() => new Date(), [])
  const isOnToday = useMemo(() => {
    if (viewMode === 'day') return sameDay(anchor, today)
    if (viewMode === 'week') {
      const wStart = startOfWeek(anchor)
      const wEnd = addDays(wStart, 6)
      return today.getTime() >= wStart.getTime() && today.getTime() <= endOfDay(wEnd).getTime()
    }
    if (viewMode === 'month') {
      return anchor.getMonth() === today.getMonth() && anchor.getFullYear() === today.getFullYear()
    }
    // agenda = semaine
    const wStart = startOfWeek(anchor)
    const wEnd = addDays(wStart, 6)
    return today.getTime() >= wStart.getTime() && today.getTime() <= endOfDay(wEnd).getTime()
  }, [anchor, today, viewMode])

  function openEvent(ev: CalendarEvent) {
    setSelectedEvent({
      dossierId: ev.dossierId,
      reference: ev.reference,
      scheduledAt: ev.scheduledAt,
      durationMinutes: ev.durationMinutes,
      clientName: ev.clientName,
      address: ev.address,
      city: ev.city,
      missionTypes: ev.missionTypes,
      status: ev.status,
    })
  }

  function jumpToDay(date: Date) {
    setAnchor(date)
    setViewMode('day')
    try {
      window.localStorage.setItem(LOCALSTORAGE_KEY, 'day')
    } catch {}
  }

  // Agenda : range = semaine (lundi → dimanche).
  const agendaRange = useMemo(() => {
    const start = startOfWeek(anchor)
    return { start, end: endOfDay(addDays(start, 6)) }
  }, [anchor])

  return (
    <div className="space-y-4">
      {/* Header sticky : période + switcher + nav */}
      <div
        className={cn(
          'sticky top-2 z-20 rounded-pill border border-rule/70 bg-paper/90 backdrop-blur-md shadow-glass-sm',
          'px-3 py-2 flex items-center justify-between gap-3 flex-wrap',
        )}
      >
        {/* Gauche : titre période */}
        <div className="min-w-0 flex-1 sm:flex-initial">
          <h2 className="text-[13px] sm:text-[14px] font-semibold text-ink capitalize truncate">
            {periodLabel}
          </h2>
        </div>

        {/* Centre : view switcher */}
        <ViewSwitcher value={viewMode} onChange={handleViewChange} />

        {/* Droite : nav + nouveau */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goToday}
            disabled={isOnToday}
            title="Revenir à aujourd'hui"
          >
            Aujourd'hui
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goPrev}
            aria-label="Période précédente"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goNext}
            aria-label="Période suivante"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button size="sm" variant="accent" asChild>
            <Link href="/dashboard/dossiers/new">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nouveau dossier</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Body : rendu conditionnel */}
      {viewMode === 'day' && (
        <DayView
          date={startOfDay(anchor)}
          events={events}
          origin={origin}
          onSelectEvent={openEvent}
        />
      )}

      {viewMode === 'week' && (
        <WeekView
          anchor={anchor}
          events={events}
          onSelectEvent={openEvent}
          onSelectDay={jumpToDay}
        />
      )}

      {viewMode === 'month' && (
        <MonthView
          anchor={anchor}
          events={events}
          onSelectEvent={openEvent}
          onSelectDay={jumpToDay}
        />
      )}

      {viewMode === 'agenda' && (
        <AgendaView
          anchor={anchor}
          rangeStart={agendaRange.start}
          rangeEnd={agendaRange.end}
          events={events}
          onSelectEvent={openEvent}
        />
      )}

      {/* Détail RDV */}
      <EventDetailSheet
        event={selectedEvent}
        open={selectedEvent !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null)
        }}
      />
    </div>
  )
}

// =============================================================================
// Helpers titre période.
// =============================================================================

function formatPeriodLabel(anchor: Date, mode: CalendarViewMode): string {
  if (mode === 'day') {
    const dayIdx = anchor.getDay() === 0 ? 6 : anchor.getDay() - 1
    const dayName = DAY_NAMES_LONG[dayIdx]
    const month = MONTH_NAMES[anchor.getMonth()]
    return `${dayName} ${anchor.getDate()} ${month} ${anchor.getFullYear()}`
  }
  if (mode === 'week' || mode === 'agenda') {
    const start = startOfWeek(anchor)
    const end = addDays(start, 6)
    const sameMonth = start.getMonth() === end.getMonth()
    const startStr = sameMonth
      ? String(start.getDate())
      : `${start.getDate()} ${MONTH_NAMES[start.getMonth()]}`
    const endStr = `${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`
    return `${startStr} – ${endStr}`
  }
  if (mode === 'month') {
    const m = startOfMonth(anchor)
    return `${MONTH_NAMES[m.getMonth()]} ${m.getFullYear()}`
  }
  return ''
}
