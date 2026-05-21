'use client'

/**
 * KOVAS — Actions sur un litige existant.
 *
 * - "Générer / régénérer le brouillon de réponse IA" (POST /api/litigation/draft-response/:id)
 * - "Marquer résolu" + "Escalader au tribunal" (PATCH /api/litigation/:id)
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Gavel, Loader2, RefreshCcw, Scale, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'

export interface LitigationActionsProps {
  litigationId: string
  status: string
  hasDraft: boolean
}

export function LitigationActions({ litigationId, status, hasDraft }: LitigationActionsProps) {
  const [pending, setPending] = useState<string | null>(null)
  const router = useRouter()

  async function generateDraft() {
    setPending('draft')
    try {
      const res = await fetch(`/api/litigation/draft-response/${litigationId}`, { method: 'POST' })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      toast.success('Brouillon généré')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Génération impossible')
    } finally {
      setPending(null)
    }
  }

  async function updateStatus(next: 'resolved' | 'court' | 'closed') {
    setPending(next)
    try {
      const res = await fetch(`/api/litigation/${litigationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      toast.success(
        next === 'resolved' ? 'Litige résolu' : next === 'court' ? 'Escalade au tribunal' : 'Litige clos',
      )
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mise à jour impossible')
    } finally {
      setPending(null)
    }
  }

  const isTerminal = status === 'resolved' || status === 'closed'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={hasDraft ? 'outline' : 'accent'}
        size="default"
        onClick={generateDraft}
        disabled={pending !== null || isTerminal}
      >
        {pending === 'draft' ? (
          <Loader2 className="size-4 animate-spin" />
        ) : hasDraft ? (
          <RefreshCcw className="size-4" />
        ) : (
          <Scale className="size-4" />
        )}
        {hasDraft ? 'Régénérer la réponse IA' : 'Générer la réponse IA'}
      </Button>

      {!isTerminal ? (
        <>
          <Button
            variant="default"
            size="default"
            onClick={() => updateStatus('resolved')}
            disabled={pending !== null}
          >
            <ShieldCheck className="size-4" /> Marquer résolu
          </Button>
          <Button
            variant="ghost"
            size="default"
            onClick={() => updateStatus('court')}
            disabled={pending !== null}
          >
            <Gavel className="size-4" /> Escalader au tribunal
          </Button>
        </>
      ) : null}
    </div>
  )
}
