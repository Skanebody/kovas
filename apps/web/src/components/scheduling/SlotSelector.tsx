'use client'

import { Card } from '@/components/ui/card'
import type { AvailableSlot } from '@/lib/scheduling/slot-finder'
import { cn } from '@/lib/utils'
import { CalendarCheck2, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface SlotSelectorProps {
  /** Format 'YYYY-MM-DD' (jour parisien). Si vide, on n'appelle rien. */
  date: string
  /** Durée mission utilisée pour calculer l'endTime de chaque slot. */
  durationMin: number
  /** Slot sélectionné (format 'HH:MM') ou null. */
  selectedTime: string | null
  /** Callback de sélection — null = désélection. */
  onSelect: (time: string | null) => void
  className?: string
}

const WEEKDAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

/**
 * Grille de créneaux 30 min entre 08:00 et 19:00 (Europe/Paris).
 *
 * Fetch `/api/scheduling/available-slots?date=&duration=` à chaque changement
 * de date/duration. Les slots indisponibles sont grisés avec tooltip.
 *
 * Le slot actif est mis en chartreuse (signature v5 — accent unique).
 */
export function SlotSelector({
  date,
  durationMin,
  selectedTime,
  onSelect,
  className,
}: SlotSelectorProps) {
  const [slots, setSlots] = useState<AvailableSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!date || !durationMin || durationMin <= 0) {
      setSlots([])
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetch(
      `/api/scheduling/available-slots?date=${encodeURIComponent(date)}&duration=${durationMin}`,
      { signal: controller.signal },
    )
      .then((r) => r.json())
      .then((data: AvailableSlot[] | { error?: string }) => {
        if (Array.isArray(data)) {
          setSlots(data)
        } else {
          setSlots([])
          setError(data.error ?? 'Erreur de chargement des créneaux')
        }
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return
        setError('Impossible de charger les créneaux')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [date, durationMin])

  const selectedSlot = slots.find((s) => s.startTime === selectedTime)
  const dayLabel = formatDayLabel(date)

  return (
    <Card variant="opaque" padding="sm" className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute flex items-center gap-1.5">
          <CalendarCheck2 className="size-3.5" /> Créneaux disponibles
        </span>
        {loading && <Loader2 className="size-3.5 animate-spin text-ink-faint" />}
      </div>

      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : slots.length === 0 && !loading ? (
        <p className="text-sm text-ink-mute">
          Choisissez une date pour voir les créneaux disponibles.
        </p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
          {slots.map((slot) => {
            const isActive = slot.startTime === selectedTime
            const disabled = !slot.available
            return (
              <button
                key={slot.startTime}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(isActive ? null : slot.startTime)}
                title={
                  disabled
                    ? slot.conflict
                      ? `Indisponible — ${slot.conflict.with}`
                      : 'Indisponible'
                    : `${slot.startTime} – ${slot.endTime}`
                }
                className={cn(
                  'rounded-md border px-2 py-2 text-[12px] font-mono tabular-nums transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30',
                  isActive &&
                    'bg-chartreuse border-chartreuse-deep text-ink shadow-[0_4px_12px_rgba(212,245,66,0.35)]',
                  !isActive &&
                    !disabled &&
                    'bg-paper border-rule text-ink hover:border-navy/40 hover:bg-cream-deep/40',
                  disabled && 'bg-paper/40 border-rule/60 text-ink-ghost cursor-not-allowed',
                )}
              >
                {slot.startTime}
              </button>
            )
          })}
        </div>
      )}

      {selectedSlot && dayLabel && (
        <p className="text-[12px] text-ink pt-1 border-t border-rule/60">
          RDV : <span className="font-medium">{dayLabel}</span>{' '}
          <span className="font-mono">
            {selectedSlot.startTime} – {selectedSlot.endTime}
          </span>
        </p>
      )}
    </Card>
  )
}

function formatDayLabel(ymd: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const [y, m, d] = ymd.split('-').map((n) => Number.parseInt(n, 10))
  if (!y || !m || !d) return null
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  const weekday = WEEKDAY_LABELS[date.getUTCDay()] ?? ''
  return `${weekday} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}
