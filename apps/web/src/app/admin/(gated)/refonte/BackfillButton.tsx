'use client'

/**
 * Bouton client pour lancer le backfill des intent_score sur les leads
 * existants. Pattern minimal : useTransition + toast inline.
 */

import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { useState, useTransition } from 'react'
import { backfillLeadScores } from './actions'

interface ToastState {
  kind: 'ok' | 'err'
  message: string
}

export function BackfillButton(): React.ReactElement {
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<ToastState | null>(null)

  function handleClick(): void {
    if (
      !window.confirm(
        'Lancer le backfill A1.3.5 sur les leads existants sans intent_score ?\n\n' +
          'Batch maximum : 200 leads par exécution. Relancer si besoin.',
      )
    ) {
      return
    }

    startTransition(async () => {
      const res = await backfillLeadScores({ limit: 200 })
      if (res.ok) {
        setToast({
          kind: 'ok',
          message: `Backfill terminé : ${res.scored} scorés, ${res.skipped} ignorés, ${res.failed} échecs.`,
        })
      } else {
        setToast({ kind: 'err', message: res.error ?? 'Échec du backfill' })
      }
      setTimeout(() => setToast(null), 8000)
    })
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={handleClick} disabled={pending}>
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-3.5" aria-hidden />
        )}
        Backfill intent_score (A1.3.5)
      </Button>
      {toast ? (
        <output
          className={`block flex items-start gap-2 rounded-md border px-3 py-2 text-[12px] ${
            toast.kind === 'ok'
              ? 'border-accent-green/30 bg-pastel-lime text-ink'
              : 'border-accent-red/30 bg-pastel-peach text-ink'
          }`}
        >
          {toast.kind === 'ok' ? (
            <CheckCircle2 className="size-3.5 mt-0.5 shrink-0" aria-hidden />
          ) : (
            <AlertCircle className="size-3.5 mt-0.5 shrink-0" aria-hidden />
          )}
          <p>{toast.message}</p>
        </output>
      ) : null}
    </div>
  )
}
