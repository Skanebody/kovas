'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Textarea } from '@/components/ui/textarea'
import { createCreditNoteAction } from '../../actions'

export interface CreditNoteFormProps {
  invoiceId: string
  /** Montant TTC de la facture d'origine — pour affichage uniquement (V1 = avoir total). */
  amountTtc: number
}

const REASON_PRESETS = [
  'Erreur de facturation',
  'Annulation de la prestation',
  'Geste commercial / remise',
  'Litige client',
  'Autre',
]

export function CreditNoteForm({ invoiceId, amountTtc: _amountTtc }: CreditNoteFormProps) {
  const router = useRouter()
  const [reason, setReason] = useState<string>(REASON_PRESETS[0] ?? '')
  const [customReason, setCustomReason] = useState<string>('')
  const [cancelOriginal, setCancelOriginal] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const finalReason = reason === 'Autre' ? customReason.trim() : reason
    if (!finalReason) {
      setError('Motif requis')
      return
    }
    startTransition(async () => {
      const result = await createCreditNoteAction({
        invoiceId,
        reason: finalReason,
        cancelOriginal,
      })
      if (result.error || !result.creditNoteId) {
        setError(result.error ?? 'Erreur création avoir')
        return
      }
      router.push(`/app/factures/${result.creditNoteId}`)
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormField label="Motif" htmlFor="reason" required>
        <select
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-[10px] border border-rule bg-paper px-3 py-2 text-[13px] text-ink"
        >
          {REASON_PRESETS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </FormField>

      {reason === 'Autre' ? (
        <FormField label="Motif détaillé" htmlFor="customReason" required>
          <Textarea
            id="customReason"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            rows={3}
            placeholder="Précisez le motif…"
          />
        </FormField>
      ) : null}

      <label className="flex items-start gap-3 text-[13px] cursor-pointer">
        <input
          type="checkbox"
          checked={cancelOriginal}
          onChange={(e) => setCancelOriginal(e.target.checked)}
          className="mt-1"
        />
        <span>
          <strong className="text-ink">Annuler la facture d'origine</strong>
          <br />
          <span className="text-ink-mute">
            La facture passera au statut "Annulée" (avoir total — montant équivalent).
          </span>
        </span>
      </label>

      {error ? (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Annuler
        </Button>
        <Button type="submit" variant="accent" disabled={isPending}>
          {isPending ? 'Création…' : 'Créer l\'avoir'}
        </Button>
      </div>
    </form>
  )
}
