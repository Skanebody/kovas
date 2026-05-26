'use client'

import { updateDossierInfoAction } from '@/app/dashboard/dossiers/[id]/actions'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Check, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface NotesSectionProps {
  dossierId: string
  initialNotes: string | null
}

/**
 * Section 9 — Notes personnelles.
 * Auto-save 3s debounce + indicateur "Sauvegardé il y a Xs".
 */
export function NotesSection({ dossierId, initialNotes }: NotesSectionProps) {
  const [value, setValue] = useState(initialNotes ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(initialNotes ? Date.now() : null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSent = useRef<string>(initialNotes ?? '')

  // Debounced autosave
  useEffect(() => {
    if (value === lastSent.current) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void save(value)
    }, 3000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  async function save(next: string) {
    setStatus('saving')
    try {
      await updateDossierInfoAction(dossierId, { notes: next })
      lastSent.current = next
      setLastSavedAt(Date.now())
      setStatus('saved')
    } catch {
      setStatus('idle')
    }
  }

  // "il y a Xs" — update toutes les 10s
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  const relativeSaved = lastSavedAt ? formatRelative(Date.now() - lastSavedAt) : null

  return (
    <Card variant="flat" padding="default" id="notes" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[#0F1419]">Notes personnelles</h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/55">
          Section 09
        </p>
      </div>

      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Vos notes internes sur ce dossier (visibles uniquement par vous)…"
        rows={5}
        className="resize-y"
      />

      <div className="flex items-center gap-2 text-[12px] text-[#0F1419]/72 h-5">
        {status === 'saving' ? (
          <>
            <Loader2 className="size-3 animate-spin" /> Sauvegarde…
          </>
        ) : status === 'saved' && relativeSaved ? (
          <>
            <Check className="size-3 text-success" /> Sauvegardé {relativeSaved}
          </>
        ) : lastSavedAt && relativeSaved ? (
          <span>Sauvegardé {relativeSaved}</span>
        ) : (
          <span>Auto-sauvegarde après 3 secondes d&apos;inactivité.</span>
        )}
      </div>
    </Card>
  )
}

function formatRelative(deltaMs: number): string {
  const s = Math.round(deltaMs / 1000)
  if (s < 60) return `il y a ${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.round(m / 60)
  return `il y a ${h} h`
}
