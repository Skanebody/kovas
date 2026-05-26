'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import { cn } from '@/lib/utils'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

export interface CalendarEvent {
  dossierId: string
  reference: string
  scheduledAt: string // ISO
  durationMinutes: number
  clientName: string | null
  city: string | null
  missionTypes: string[]
  status: string
}

interface CalendarWeekViewProps {
  events: CalendarEvent[]
}

const DAY_NAMES = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']

// Plage horaire affichée (8h → 20h inclusivement = 13 lignes de séparation)
const HOUR_START = 8
const HOUR_END = 20
// Hauteur d'un créneau d'1h (px). 1 minute = HOUR_HEIGHT / 60 px.
const HOUR_HEIGHT = 60

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

/**
 * Position verticale d'un événement (en px) dans la grille horaire.
 * Retourne null si l'événement est hors de la plage [HOUR_START, HOUR_END].
 */
function computeEventGeometry(
  scheduledAt: string,
  durationMinutes: number,
): { top: number; height: number } | null {
  const d = new Date(scheduledAt)
  const minutesFromStart = (d.getHours() - HOUR_START) * 60 + d.getMinutes()
  if (minutesFromStart < 0) return null
  const top = (minutesFromStart * HOUR_HEIGHT) / 60
  const totalHeightPx = (HOUR_END - HOUR_START) * HOUR_HEIGHT
  if (top >= totalHeightPx) return null
  const rawHeight = Math.max(28, (durationMinutes * HOUR_HEIGHT) / 60)
  const height = Math.min(rawHeight, totalHeightPx - top)
  return { top, height }
}

export function CalendarWeekView({ events }: CalendarWeekViewProps) {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()))

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )
  const today = new Date()

  const hours = useMemo(() => {
    const out: number[] = []
    for (let h = HOUR_START; h <= HOUR_END; h += 1) out.push(h)
    return out
  }, [])

  const eventsByDay = useMemo(() => {
    const byDay: Map<string, CalendarEvent[]> = new Map()
    for (const day of weekDays) {
      byDay.set(day.toDateString(), [])
    }
    for (const ev of events) {
      const d = new Date(ev.scheduledAt)
      const key = d.toDateString()
      if (byDay.has(key)) {
        byDay.get(key)?.push(ev)
      }
    }
    // Trie par heure dans chaque jour
    for (const arr of byDay.values()) {
      arr.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    }
    return byDay
  }, [events, weekDays])

  const rangeEnd = addDays(weekStart, 6)
  const gridHeight = (HOUR_END - HOUR_START) * HOUR_HEIGHT

  return (
    <div className="space-y-4">
      {/* Header navigation */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="glass"
            size="sm"
            onClick={() => setAnchor(addDays(anchor, -7))}
            aria-label="Semaine précédente"
            className="h-10 md:h-8"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="glass"
            size="sm"
            onClick={() => setAnchor(startOfWeek(new Date()))}
            className="h-10 md:h-8"
          >
            <CalendarDays className="size-4" /> Aujourd&apos;hui
          </Button>
          <Button
            variant="glass"
            size="sm"
            onClick={() => setAnchor(addDays(anchor, 7))}
            aria-label="Semaine suivante"
            className="h-10 md:h-8"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="text-sm font-medium capitalize">
          {formatRangeLabel(weekStart, rangeEnd)}
        </div>
        <Button size="sm" variant="accent" asChild className="h-10 md:h-8">
          <Link href="/dashboard/dossiers/new">
            <Plus className="size-4" /> Nouveau RDV
          </Link>
        </Button>
      </div>

      {/* Grille horaire semaine */}
      <div className="overflow-x-auto -mx-2 px-2 pb-2">
        <div className="min-w-[840px] rounded-xl border border-rule/80 glass-opaque overflow-hidden">
          {/* En-têtes jours (sticky) */}
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-rule">
            <div aria-hidden className="bg-paper/60" />
            {weekDays.map((day, idx) => {
              const isToday = sameDay(day, today)
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'px-2 py-3 text-center border-l border-rule/60',
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
              )
            })}
          </div>

          {/* Corps : rail heures + colonnes jours */}
          <div
            className="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]"
            style={{ height: gridHeight }}
          >
            {/* Colonne labels heures */}
            <div className="relative bg-paper/60 border-r border-rule/60">
              {hours.map((h, idx) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 -translate-y-1/2 pr-2 text-right font-mono text-[10px] uppercase tracking-wider text-ink-mute select-none"
                  style={{ top: idx * HOUR_HEIGHT }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Colonnes jours avec traits horaires + événements */}
            {weekDays.map((day) => {
              const isToday = sameDay(day, today)
              const dayEvents = eventsByDay.get(day.toDateString()) ?? []
              return (
                <div
                  key={day.toISOString()}
                  className={cn('relative border-l border-rule/60', isToday && 'bg-navy/[0.03]')}
                >
                  {/* Traits horaires pleins (chaque heure pleine, sauf la première qui est sous le header) */}
                  {hours.map((h, idx) => (
                    <div
                      key={`hour-${h}`}
                      className="absolute left-0 right-0 h-px bg-rule/40 pointer-events-none"
                      style={{ top: idx * HOUR_HEIGHT, minHeight: '1px' }}
                      aria-hidden
                    />
                  ))}
                  {/* Traits demi-heure discrets (dashed, opacity 20%) */}
                  {hours.slice(0, -1).map((h, idx) => (
                    <div
                      key={`half-${h}`}
                      className="absolute left-0 right-0 h-px pointer-events-none border-t border-dashed border-rule/30"
                      style={{ top: idx * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                      aria-hidden
                    />
                  ))}

                  {/* Événements positionnés en absolu */}
                  {dayEvents.map((ev) => {
                    const geom = computeEventGeometry(ev.scheduledAt, ev.durationMinutes)
                    if (!geom) return null
                    const time = new Date(ev.scheduledAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Europe/Paris',
                    })
                    const typeShort =
                      ev.missionTypes
                        .map((t) => MISSION_TYPE_LABELS[t]?.split(' ')[0] ?? t)
                        .slice(0, 2)
                        .join(' · ') || 'Diag.'
                    return (
                      <Link
                        key={ev.dossierId}
                        href={`/dashboard/dossiers/${ev.dossierId}`}
                        className={cn(
                          'absolute left-1 right-1 rounded-md p-1.5 text-[11px] overflow-hidden',
                          'bg-navy/[0.08] border-l-2 border-navy hover:bg-navy/[0.14] hover:shadow-glass transition-all',
                        )}
                        style={{ top: geom.top, height: geom.height }}
                      >
                        <div className="font-semibold tabular-nums text-navy leading-tight">
                          {time}
                        </div>
                        {geom.height >= 44 && (
                          <div className="font-medium truncate mt-0.5 leading-tight">
                            {ev.clientName ?? 'Sans client'}
                          </div>
                        )}
                        {geom.height >= 64 && (
                          <div className="text-ink-mute truncate mt-0.5 leading-tight">
                            {typeShort}
                            {ev.city && ` · ${ev.city}`}
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-xs text-ink-mute flex-wrap gap-2">
        <span>{events.length} RDV planifiés</span>
        <span className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full bg-navy" /> RDV KOVAS
          <Badge variant="muted" className="text-[10px] py-0">
            HEURES {HOUR_START}H → {HOUR_END}H
          </Badge>
        </span>
      </div>
    </div>
  )
}
