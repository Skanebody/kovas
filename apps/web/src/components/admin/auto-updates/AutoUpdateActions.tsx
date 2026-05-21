'use client'

/**
 * Boutons d'action sur une auto-update système (approuver / rejeter / appliquer
 * / rollback) avec modal de confirmation + saisie de notes.
 *
 * V1 modal natif simple (dialog HTML) pour éviter d'introduire un Dialog complet
 * juste pour ça.
 */

import { Button } from '@/components/ui/button'
import type { AutoUpdateStatus } from '@/lib/regulatory/types'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

type ActionKind = 'approve' | 'reject' | 'apply' | 'rollback'

interface AutoUpdateActionsProps {
  id: string
  status: AutoUpdateStatus
}

const ACTION_LABEL: Record<ActionKind, string> = {
  approve: 'Approuver',
  reject: 'Rejeter',
  apply: 'Appliquer maintenant',
  rollback: 'Rollback',
}

const ACTION_VARIANT: Record<
  ActionKind,
  'default' | 'accent' | 'destructive' | 'outline' | 'ghost'
> = {
  approve: 'default',
  reject: 'destructive',
  apply: 'accent',
  rollback: 'outline',
}

const NOTES_REQUIRED: Record<ActionKind, boolean> = {
  approve: false,
  reject: true,
  apply: false,
  rollback: true,
}

export function AutoUpdateActions({ id, status }: AutoUpdateActionsProps) {
  const router = useRouter()
  const [pending, setPending] = useState<ActionKind | null>(null)
  const [confirming, setConfirming] = useState<ActionKind | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const close = (): void => {
    setConfirming(null)
    setNotes('')
    setError(null)
  }

  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (!confirming) return
    if (NOTES_REQUIRED[confirming] && notes.trim().length === 0) {
      setError('Une note est obligatoire.')
      return
    }
    setPending(confirming)
    setError(null)
    try {
      const r = await fetch(`/api/system/auto-updates/${id}/${confirming}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || undefined }),
      })
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string; detail?: string }
        throw new Error(j.detail ?? j.error ?? `Erreur ${r.status}`)
      }
      close()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setPending(null)
    }
  }

  const available: ActionKind[] = []
  if (status === 'pending_review') {
    available.push('approve', 'reject')
  } else if (status === 'approved') {
    available.push('apply', 'reject')
  } else if (status === 'applied') {
    available.push('rollback')
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {available.length === 0 && (
          <span className="text-[11px] text-ink-faint">Aucune action disponible</span>
        )}
        {available.map((a) => (
          <Button
            key={a}
            type="button"
            size="sm"
            variant={ACTION_VARIANT[a]}
            disabled={pending !== null}
            onClick={() => setConfirming(a)}
          >
            {pending === a ? <Loader2 className="size-3 animate-spin" /> : ACTION_LABEL[a]}
          </Button>
        ))}
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`auaction-${id}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) close()
          }}
        >
          <form
            onSubmit={submit}
            className="bg-paper rounded-xl shadow-lg w-full max-w-md p-5 space-y-4"
          >
            <div>
              <h2
                id={`auaction-${id}`}
                className="font-serif italic text-2xl text-ink leading-tight"
              >
                {ACTION_LABEL[confirming]}.
              </h2>
              <p className="text-[12px] text-ink-mute mt-1">
                {confirming === 'apply'
                  ? "L'action sera appliquée immédiatement et auditée."
                  : confirming === 'rollback'
                    ? 'Restaure l\'état antérieur. Action auditée.'
                    : 'Confirmation requise. Action auditée.'}
              </p>
            </div>
            <div>
              <label
                htmlFor={`notes-${id}`}
                className="text-[11px] uppercase tracking-[0.14em] text-ink-faint font-mono"
              >
                Note {NOTES_REQUIRED[confirming] ? '(obligatoire)' : '(facultative)'}
              </label>
              <textarea
                id={`notes-${id}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Contexte de la décision, références…"
                className="mt-1 w-full rounded-md border border-rule bg-paper px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-navy focus:ring-4 focus:ring-navy/10"
              />
            </div>
            {error && <p className="text-[12px] text-[#8B1414]">{error}</p>}
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close} disabled={pending !== null}>
                Annuler
              </Button>
              <Button
                type="submit"
                variant={ACTION_VARIANT[confirming]}
                disabled={pending !== null}
              >
                {pending !== null ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  ACTION_LABEL[confirming]
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
