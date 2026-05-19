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

export function CalendarWeekView({ events }: CalendarWeekViewProps) {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()))

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
      if (byDay.has(key)) {
        byDay.get(key)!.push(ev)
      }
    }
    // Trie par heure dans chaque jour
    for (const arr of byDay.values()) {
      arr.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    }
    return byDay
  }, [events, weekDays])

  const rangeEnd = addDays(weekStart, 6)

  return (
    <div className="space-y-4">
      {/* Header navigation */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(anchor, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(startOfWeek(new Date()))}>
            <CalendarDays className="size-4" /> Aujourd'hui
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(anchor, 7))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="text-sm font-medium capitalize">
          {formatRangeLabel(weekStart, rangeEnd)}
        </div>
        <Button size="sm" asChild>
          <Link href="/app/dossiers/new">
            <Plus className="size-4" /> Nouveau RDV
          </Link>
        </Button>
      </div>

      {/* Week grid */}
      <div className="overflow-x-auto -mx-2 px-2 pb-2">
        <div className="grid grid-cols-7 gap-2 min-w-[840px]">
          {weekDays.map((day, idx) => {
            const isToday = sameDay(day, today)
            const dayEvents = eventsByDay.get(day.toDateString()) ?? []
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'rounded-lg border border-cta/[0.08] bg-card/50 flex flex-col min-h-[400px]',
                  isToday && 'ring-2 ring-cta/30 bg-cta/[0.03]',
                )}
              >
                <div
                  className={cn(
                    'px-3 py-2 border-b border-cta/[0.06] text-center sticky top-0 bg-card/80 backdrop-blur-md',
                    isToday && 'bg-cta/[0.06]',
                  )}
                >
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                    {DAY_NAMES[idx]}
                  </div>
                  <div
                    className={cn(
                      'text-base font-bold tracking-tight tabular-nums',
                      isToday && 'text-cta',
                    )}
                  >
                    {day.getDate()}
                  </div>
                </div>
                <div className="flex-1 p-1.5 space-y-1.5">
                  {dayEvents.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/60 text-center pt-3 italic">
                      —
                    </p>
                  ) : (
                    dayEvents.map((ev) => {
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
                          href={`/app/dossiers/${ev.dossierId}`}
                          className={cn(
                            'block rounded-md p-2 text-[11px] hover:shadow-md transition-shadow',
                            'bg-cta/[0.08] border-l-2 border-cta hover:bg-cta/[0.12]',
                          )}
                        >
                          <div className="font-semibold tabular-nums text-cta">{time}</div>
                          <div className="font-medium truncate mt-0.5">
                            {ev.clientName ?? 'Sans client'}
                          </div>
                          <div className="text-muted-foreground truncate mt-0.5">
                            {typeShort}
                            {ev.city && ` · ${ev.city}`}
                          </div>
                        </Link>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
        <span>{events.length} RDV planifiés</span>
        <span className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full bg-cta" /> RDV KOVAS
          <Badge variant="muted" className="text-[10px] py-0">
            HEURES 7H → 19H
          </Badge>
        </span>
      </div>
    </div>
  )
}
