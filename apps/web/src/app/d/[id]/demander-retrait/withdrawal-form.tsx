'use client'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'

interface WithdrawalFormProps {
  diagId: string
}

export function WithdrawalForm({ diagId }: WithdrawalFormProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const resp = await fetch(`/api/diagnostiqueurs/${diagId}/demander-retrait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || null }),
      })
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Une erreur est survenue. Réessayez.')
        return
      }
      setDone(true)
    } catch {
      setError('Erreur réseau. Réessayez dans un instant.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-3 text-center py-4">
        <CheckCircle2 className="size-10 mx-auto text-success" />
        <h2 className="font-display text-lg font-semibold text-ink">Demande enregistrée</h2>
        <p className="text-[13px] text-ink-mute leading-relaxed">
          Ta fiche sera dépubliée sous 72&nbsp;heures et tes données seront supprimées
          définitivement. Tu recevras un email de confirmation lorsque le retrait sera effectif.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="reason" className="block text-[13px] font-medium text-ink">
          Motif (facultatif)
        </label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="Si tu souhaites nous expliquer ta raison, tes retours nous aident à améliorer notre approche."
          maxLength={1000}
        />
        <p className="text-[11px] text-ink-faint">
          Ce champ est optionnel. Aucun motif n&apos;est requis pour exercer ton droit au retrait.
        </p>
      </div>

      {error ? (
        <p className="text-[13px] text-danger bg-danger/5 border border-danger/20 rounded-md px-3 py-2">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="default" size="lg" disabled={submitting} className="w-full">
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Traitement…
          </>
        ) : (
          'Confirmer le retrait de ma fiche'
        )}
      </Button>

      <p className="text-[11px] text-ink-faint text-center">
        En confirmant, vous exercez votre droit à l&apos;effacement (article 17 du RGPD).
      </p>
    </form>
  )
}
