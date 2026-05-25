'use client'

/**
 * Boutons client pour lancer les actions ponctuelles de refonte:
 *   - BackfillButton: A1.3.5 lead scoring
 *   - SeoAuditButton: A1.3.12 SEO quality batch audit
 *
 * Pattern minimal : useTransition + toast inline <output>.
 */

import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, FileSearch, Loader2, Sparkles } from 'lucide-react'
import { useState, useTransition } from 'react'
import { auditSeoPagesBatch, backfillLeadScores } from './actions'

interface ToastState {
  kind: 'ok' | 'err'
  message: string
}

function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null
  return (
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
  )
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
      <Toast toast={toast} />
    </div>
  )
}

export function SeoAuditButton(): React.ReactElement {
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<ToastState | null>(null)

  function handleClick(): void {
    if (
      !window.confirm(
        "Lancer l'audit A1.3.12 sur les pages SEO programmatiques ?\n\n" +
          'Batch maximum : 500 pages par exécution. Recompute quality_score + needs_refresh.',
      )
    ) {
      return
    }

    startTransition(async () => {
      const res = await auditSeoPagesBatch({ limit: 500 })
      if (res.ok) {
        setToast({
          kind: 'ok',
          message: `Audit terminé : ${res.scored} pages scorées · ${res.needs_refresh} à rafraîchir · ${res.unpublish_candidates} candidates dépublication · ${res.failed} échecs.`,
        })
      } else {
        setToast({ kind: 'err', message: res.error ?? 'Échec audit SEO' })
      }
      setTimeout(() => setToast(null), 10000)
    })
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={handleClick} disabled={pending}>
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <FileSearch className="size-3.5" aria-hidden />
        )}
        Audit SEO pages (A1.3.12)
      </Button>
      <Toast toast={toast} />
    </div>
  )
}
