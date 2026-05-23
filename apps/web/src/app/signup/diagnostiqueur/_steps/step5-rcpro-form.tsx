'use client'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Loader2, Sparkles } from 'lucide-react'
import { useActionState, useState } from 'react'
import { submitStep5Rcpro } from '../actions'

interface ExtractedRcpro {
  insurer?: string
  policy_number?: string
  valid_until?: string
  amount_per_claim?: number
  amount_per_year?: number
}

export function Step5RcproForm() {
  const [state, formAction, pending] = useActionState(submitStep5Rcpro, undefined)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedRcpro>({})
  const [extractError, setExtractError] = useState<string | null>(null)

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    setExtractError(null)

    try {
      const body = new FormData()
      body.append('attestation', file)
      const res = await fetch('/api/rcpro-ocr', { method: 'POST', body })
      if (!res.ok) throw new Error(await res.text())
      const data: ExtractedRcpro = await res.json()
      setExtracted(data)
    } catch (err) {
      setExtractError(
        err instanceof Error
          ? `Extraction OCR échouée : ${err.message}`
          : 'Extraction OCR échouée.',
      )
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#0F1419]/55 font-semibold">
          Étape 5 sur 7 — Assurance RC Pro
        </p>
        <h1 className="font-serif italic text-3xl text-[#0F1419] leading-tight">
          Votre attestation responsabilité civile.
        </h1>
        <p className="text-[14px] text-[#0F1419]/70">
          Téléversez votre attestation en cours de validité. Nous extrayons automatiquement les
          informations clés (compagnie, montants, échéance) — vous validez l&apos;exactitude.
        </p>
      </div>

      <form action={formAction} className="space-y-4" encType="multipart/form-data">
        <FormField
          label="Attestation RC Pro PDF"
          htmlFor="attestation"
          required
          hint="Document daté de moins de 12 mois (10 Mo max)"
        >
          <input
            type="file"
            id="attestation"
            name="attestation"
            required
            accept="application/pdf,image/jpeg,image/png"
            onChange={onFileChange}
            className="block w-full text-[13px] text-[#0F1419]/75 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-[#0F1419] file:text-white file:font-medium file:cursor-pointer hover:file:bg-[#0F1419]/85"
          />
        </FormField>

        {extracting && (
          <div className="flex items-center gap-2 rounded-md bg-[#F5F7F4] p-3 text-[13px] text-[#0F1419]/75">
            <Sparkles className="size-4 animate-pulse" />
            Extraction des données par Claude Vision...
          </div>
        )}

        {extractError && (
          <p className="text-[13px] text-amber-700 bg-amber-50 rounded-md p-3">
            {extractError} Vous pouvez remplir les champs manuellement.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Compagnie d&apos;assurance" htmlFor="insurer" required>
            <Input
              id="insurer"
              name="insurer"
              required
              defaultValue={extracted.insurer ?? ''}
              key={`insurer-${extracted.insurer ?? ''}`}
              placeholder="MMA, AXA, Allianz..."
            />
          </FormField>

          <FormField label="Numéro de police" htmlFor="policy_number" required>
            <Input
              id="policy_number"
              name="policy_number"
              required
              defaultValue={extracted.policy_number ?? ''}
              key={`policy-${extracted.policy_number ?? ''}`}
              placeholder="123 456 789"
            />
          </FormField>

          <FormField label="Date de fin de validité" htmlFor="valid_until" required>
            <Input
              id="valid_until"
              name="valid_until"
              type="date"
              required
              defaultValue={extracted.valid_until ?? ''}
              key={`valid-${extracted.valid_until ?? ''}`}
            />
          </FormField>

          <FormField label="Montant par sinistre (€)" htmlFor="amount_per_claim" required>
            <Input
              id="amount_per_claim"
              name="amount_per_claim"
              type="number"
              min={0}
              required
              defaultValue={extracted.amount_per_claim ?? ''}
              key={`apc-${extracted.amount_per_claim ?? ''}`}
              placeholder="500000"
            />
          </FormField>

          <FormField label="Montant par an (€)" htmlFor="amount_per_year" required>
            <Input
              id="amount_per_year"
              name="amount_per_year"
              type="number"
              min={0}
              required
              defaultValue={extracted.amount_per_year ?? ''}
              key={`apy-${extracted.amount_per_year ?? ''}`}
              placeholder="1000000"
            />
          </FormField>
        </div>

        {state?.error && (
          <p className="text-[13px] text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={pending || extracting}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Confirmer et continuer
        </Button>
      </form>
    </div>
  )
}
