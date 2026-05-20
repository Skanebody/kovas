'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MissionTypeTag } from '@/components/ui/mission-type-tag'
import { cn } from '@/lib/utils'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { type CalendarEventDetail, EventDetailSheet } from './event-detail-sheet'

export interface CalendarEvent {
  dossierId: string
  reference: string
  scheduledAt: string // ISO
  durationMinutes: number
  clientName: string | null
  address: string | null
  city: string | null
  missionTypes: string[]
  status: string
}

interface CalendarWeekViewProps {
  events: CalendarEvent[]
}

const DAY_NAMES = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  scheduled: 'Planifié',
  on_site: 'Sur place',
  back_office: 'Au bureau',
  done: 'Terminé',
  archived: 'Archivé',
  cancelled: 'Annulé',
}

const STATUS_VARIANT: Record<string, 'muted' | 'blue' | 'green' | 'orange' | 'red'> = {
  draft: 'muted',
  scheduled: 'blue',
  on_site: 'orange',
  back_office: 'orange',
  done: 'green',
  archived: 'muted',
  cancelled: 'red',
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = sun, 1 = mon, ..., 6 = sat
  const diff = day === 0 ? -6 : 1 - day // back to monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatRangeLabel(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth()
  const startStr = start.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: sameMonth ? undefined : 'short',
  })
  const endStr = end.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${startStr} – ${endStr}`
}

/** input[type=date] format YYYY-MM-DD */
function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const MAX_EVENTS_PER_DAY_COLLAPSED = 3

export function CalendarWeekView({ events }: CalendarWeekViewProps) {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()))
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventDetail | null>(null)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )
  const today = new Date()

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
    // Trie par heure dans chaque jour
    for (const arr of byDay.values()) {
      arr.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    }
    return byDay
  }, [events, weekDays])

  // Événements de la semaine + breakdown par statut
  const weekEvents = useMemo(() => {
    const arr: CalendarEvent[] = []
    for (const list of eventsByDay.values()) arr.push(...list)
    return arr
  }, [eventsByDay])

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const ev of weekEvents) {
      counts[ev.status] = (counts[ev.status] ?? 0) + 1
    }
    return counts
  }, [weekEvents])

  const rangeEnd = addDays(weekStart, 6)

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

  function onDateInputChange(value: string) {
    if (!value) return
    const parts = value.split('-').map((s) => Number(s))
    if (parts.length !== 3) return
    const [y, m, d] = parts as [number, number, number]
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return
    setAnchor(startOfWeek(new Date(y, m - 1, d)))
  }

  return (
    <div className="space-y-4">
      {/* Header navigation */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="glass" size="sm" onClick={() => setAnchor(addDays(anchor, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="glass" size="sm" onClick={() => setAnchor(startOfWeek(new Date()))}>
            <CalendarDays className="size-4" /> Aujourd'hui
          </Button>
          <Button variant="glass" size="sm" onClick={() => setAnchor(addDays(anchor, 7))}>
            <ChevronRight className="size-4" />
          </Button>
          <label className="inline-flex items-center gap-1.5">
            <span className="sr-only">Aller à une date</span>
            <input
              type="date"
              value={toDateInputValue(weekStart)}
              onChange={(e) => onDateInputChange(e.target.value)}
              className="h-9 rounded-md border border-rule bg-paper/85 px-2 text-xs font-mono text-ink shadow-sm hover:bg-paper transition-colors"
            />
          </label>
        </div>
        <div className="text-sm font-medium capitalize">
          {formatRangeLabel(weekStart, rangeEnd)}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle — Mois désactivé (V2) */}
          <div className="hidden sm:flex gap-1 rounded-pill border border-rule bg-cream-deep/40 p-1">
            <span className="inline-flex items-center rounded-pill bg-paper px-3 py-1 text-[11px] font-medium text-ink shadow-sm">
              Semaine
            </span>
            <button
              type="button"
              disabled
              title="Vue mois — V2"
              className="inline-flex items-center rounded-pill px-3 py-1 text-[11px] font-medium text-ink-mute/60 cursor-not-allowed"
            >
              Mois
            </button>
          </div>
          <Button size="sm" variant="accent" asChild>
            <Link href="/app/dossiers/new">
              <Plus className="size-4" /> Nouveau RDV
            </Link>
          </Button>
        </div>
      </div>

      {/* Week grid */}
      <div className="overflow-x-auto -mx-2 px-2 pb-2">
        <div className="grid grid-cols-7 gap-2 min-w-[1080px]">
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
                  'rounded-lg border border-rule/80 glass-opaque flex flex-col min-h-[420px]',
                  isToday && 'ring-2 ring-navy/30 bg-navy/[0.03]',
                )}
              >
                <div
                  className={cn(
                    'px-3 py-2 border-b border-rule text-center sticky top-0 bg-paper/80 backdrop-blur-md',
                    isToday && 'bg-navy/[0.06]',
                  )}
                >
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-mute">
                    {DAY_NAMES[idx]}
                  </div>
                  <div
                    className={cn(
                      'text-base font-bold tracking-tight tabular-nums',
                      isToday && 'text-navy',
                    )}
                  >
                    {day.getDate()}
                  </div>
                </div>
                <div className="flex-1 p-1.5 space-y-1.5">
                  {dayEvents.length === 0 ? (
                    <p className="text-[11px] text-ink-mute/60 text-center pt-3 italic">—</p>
                  ) : (
                    <>
                      {visibleEvents.map((ev) => (
                        <EventCard key={ev.dossierId} event={ev} onClick={() => openEvent(ev)} />
                      ))}
                      {hidden > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedDay(dayKey)}
                          className="w-full text-[11px] text-ink-mute hover:text-ink rounded-md py-1 hover:bg-cream-deep/40 transition-colors font-medium"
                        >
                          + {hidden} autre{hidden > 1 ? 's' : ''}
                        </button>
                      )}
                      {isExpanded && dayEvents.length > MAX_EVENTS_PER_DAY_COLLAPSED && (
                        <button
                          type="button"
                          onClick={() => setExpandedDay(null)}
                          className="w-full text-[11px] text-ink-mute hover:text-ink rounded-md py-1 hover:bg-cream-deep/40 transition-colors"
                        >
                          Réduire
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Compteur + breakdown */}
      <div className="flex items-center justify-between text-xs text-ink-mute flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-ink">{weekEvents.length} RDV cette semaine</span>
          {Object.entries(statusBreakdown).map(([status, count]) => (
            <Badge key={status} variant={STATUS_VARIANT[status] ?? 'muted'} className="text-[10px]">
              {count} {STATUS_LABELS[status] ?? status}
            </Badge>
          ))}
        </div>
        <span className="italic">Cliquez un RDV pour voir les détails.</span>
      </div>

      {/* Sheet détail event */}
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

interface EventCardProps {
  event: CalendarEvent
  onClick: () => void
}

function EventCard({ event, onClick }: EventCardProps) {
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

  // Adresse compacte : rue + ville
  const addressLine = [event.address, event.city].filter(Boolean).join(', ')

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'block w-full text-left rounded-md p-2 text-[11px] hover:shadow-glass transition-all',
        'bg-navy/[0.08] border-l-2 border-navy hover:bg-navy/[0.12] hover:-translate-y-px',
        isCancelled && 'opacity-60 line-through decoration-1',
        isDone && 'border-l-accent-green bg-accent-green/[0.06] hover:bg-accent-green/[0.1]',
      )}
    >
      {/* Heure + statut */}
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <span className="font-mono font-semibold tabular-nums text-navy text-[11px]">
          {timeStart} → {timeEnd}
        </span>
        <Badge
          variant={STATUS_VARIANT[event.status] ?? 'muted'}
          className="text-[9px] px-1.5 py-0 leading-tight"
        >
          {STATUS_LABELS[event.status] ?? event.status}
        </Badge>
      </div>

      {/* Client */}
      <div className="font-semibold text-ink truncate" title={event.clientName ?? undefined}>
        {event.clientName ?? 'Sans client'}
      </div>

      {/* Adresse complète (2 lignes max) */}
      {addressLine && (
        <div className="text-ink-mute line-clamp-2 mt-0.5 leading-snug">{addressLine}</div>
      )}

      {/* Diagnostics : tous les types empilés en chips */}
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
