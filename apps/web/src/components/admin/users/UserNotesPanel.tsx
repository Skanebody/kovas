'use client'

/**
 * Panneau des notes admin internes (lecture + ajout).
 *
 * Submit POST /api/admin/users/[id]/note + router.refresh() pour recharger les
 * données du server component parent.
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import type { AdminNoteItem } from '@/lib/admin/users-types'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

interface UserNotesPanelProps {
  userId: string
  notes: AdminNoteItem[]
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function UserNotesPanel({ userId, notes }: UserNotesPanelProps) {
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/users/${userId}/note`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: trimmed }),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          setError(data.error ?? `HTTP ${res.status}`)
          return
        }
        setDraft('')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur réseau')
      }
    })
  }

  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Notes internes</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          {notes.length} note{notes.length !== 1 ? 's' : ''}
        </span>
      </div>

      <form onSubmit={submit} className="space-y-2 mb-5">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Note interne (visible admins uniquement)…"
          rows={3}
          aria-label="Ajouter une note interne"
          maxLength={5000}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-ink-faint">{draft.length}/5000 caractères</p>
          <Button type="submit" variant="default" size="sm" disabled={!draft.trim() || isPending}>
            {isPending ? 'Enregistrement…' : 'Ajouter'}
          </Button>
        </div>
        {error ? (
          <p className="text-[12px] text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-ink-mute py-2">Aucune note pour cet utilisateur.</p>
      ) : (
        <ul className="space-y-2.5" aria-label="Liste des notes">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border border-rule/60 bg-cream-deep/30 p-3">
              <p className="text-[13px] text-ink whitespace-pre-wrap">{n.note}</p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                {n.created_by_email ?? 'admin'} · {formatDateTime(n.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
