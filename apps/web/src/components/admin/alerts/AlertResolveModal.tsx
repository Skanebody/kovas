'use client'

/**
 * Modal de confirmation pour résoudre une alerte.
 * Champs : note (optionnel, max 500 chars) + bouton confirm.
 *
 * POST /api/admin/alerts/[id]/resolve
 */

import type { AlertEventDto } from '@/app/api/admin/alerts/route'
import { X } from 'lucide-react'
import { useState } from 'react'

interface AlertResolveModalProps {
  event: AlertEventDto | null
  onClose: () => void
  onResolved: () => void
}

export function AlertResolveModal({ event, onClose, onResolved }: AlertResolveModalProps) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!event) return null

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/alerts/${event.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      onResolved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4"
      // biome-ignore lint/a11y/useSemanticElements: <dialog> natif gère mal le backdrop + click outside.
      role="dialog"
      aria-modal="true"
      aria-label="Résoudre l'alerte"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-paper text-ink shadow-2xl border border-rule/60 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule/60">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              Résoudre l'alerte
            </p>
            <h2 className="text-[14px] font-semibold tracking-tight text-ink mt-0.5">
              {event.rule_name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-mute hover:text-ink"
            aria-label="Fermer"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="px-5 py-5 space-y-3">
          {event.target_label ? (
            <div className="text-[12px] text-ink-mute">
              Cible : <span className="text-ink">{event.target_label}</span>
            </div>
          ) : null}

          <label className="block">
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-1.5">
              Note de résolution (optionnel)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Ex : faux positif suite à test load · pic confirmé après campagne"
              className="w-full rounded-md border border-rule/60 bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-chartreuse/40"
            />
            <span className="block text-[10px] text-ink-faint mt-1 text-right">
              {note.length}/500
            </span>
          </label>

          {error ? (
            <p className="text-[12px] text-accent-red" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-sage/40 border-t border-rule/60">
          <button
            type="button"
            onClick={onClose}
            className="rounded-pill px-3 py-1.5 text-[12px] text-ink-mute hover:text-ink"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-pill bg-ink text-paper hover:bg-ink/85 disabled:opacity-50 px-4 py-1.5 text-[12px] font-medium transition-colors"
          >
            {submitting ? 'Résolution…' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}
