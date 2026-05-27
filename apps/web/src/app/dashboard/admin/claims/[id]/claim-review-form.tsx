'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  claimId: string
  diagnosticianId: string
  reviewerEmail: string
  diagnosticianEmail: string | null
}

/**
 * Formulaire admin de décision KYC (refonte Doctolib 2026-05-27).
 *
 * Permet de trancher Approuver / Rejeter avec notes texte.
 * Appelle POST /api/admin/claims/[id]/review qui :
 *   - UPDATE claim_requests (trigger applique status=approved/rejected)
 *   - Notifie diagnostiqueur par email Resend (template décision)
 *   - Si approuvé : prépare le link signup (le diag suit le lien dans email)
 */
export function ClaimReviewForm({
  claimId,
  diagnosticianId,
  reviewerEmail,
  diagnosticianEmail,
}: Props) {
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(decision: 'approved' | 'rejected') {
    if (!notes.trim() && decision === 'rejected') {
      setError('Notes obligatoires pour un refus (le diagnostiqueur doit savoir pourquoi).')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/claims/${claimId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes: notes.trim() || null, diagnosticianId }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Échec de l'enregistrement de la décision.")
        return
      }
      router.refresh()
    } catch {
      setError('Erreur réseau. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card variant="flat" padding="default">
      <h3 className="text-[14px] font-semibold text-ink mb-3">Décision admin</h3>
      <p className="text-[11px] font-mono uppercase tracking-wider text-ink-mute mb-4">
        Reviewer : {reviewerEmail} · Diag email cible : {diagnosticianEmail ?? '—'}
      </p>

      <div>
        <Label htmlFor="review-notes">Notes (obligatoire si refus)</Label>
        <textarea
          id="review-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Ex: Document expiré, demander un nouveau scan."
          className="mt-2 w-full rounded-md border border-rule bg-paper px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-navy/20 placeholder:text-ink-faint"
        />
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-md bg-danger/10 border border-danger/30 text-[12px] text-danger">
          {error}
        </div>
      )}

      <div className="mt-5 flex gap-3">
        <Button type="button" onClick={() => submit('approved')} disabled={loading}>
          Approuver
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => submit('rejected')}
          disabled={loading}
        >
          Rejeter
        </Button>
      </div>
    </Card>
  )
}
