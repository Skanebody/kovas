'use client'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { useActionState } from 'react'
import { submitStep4Cofrac } from '../actions'

const COFRAC_BODIES = [
  'Bureau Veritas Certification',
  'Apave Certification',
  'Dekra Certification',
  'SOCOTEC',
  'Qualibat',
  'autre',
] as const

export function Step4CofracForm() {
  const [state, formAction, pending] = useActionState(submitStep4Cofrac, undefined)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#0F1419]/55 font-semibold">
          Étape 4 sur 7 — Certification COFRAC
        </p>
        <h1 className="font-serif italic text-3xl text-[#0F1419] leading-tight">
          Renseigne ta certification.
        </h1>
        <p className="text-[14px] text-[#0F1419]/70">
          Ton numéro de certification est croisé avec l&apos;annuaire COFRAC et l&apos;annuaire de
          ton organisme certificateur.
        </p>
      </div>

      <form action={formAction} className="space-y-4" encType="multipart/form-data">
        <FormField
          label="Numéro de certification COFRAC"
          htmlFor="cofrac_number"
          required
          hint="Format : COFRAC-XXX-NNNNN (visible sur ton certificat)"
        >
          <Input
            id="cofrac_number"
            name="cofrac_number"
            type="text"
            required
            pattern="COFRAC-\d{3}-\d{5}"
            placeholder="COFRAC-123-45678"
          />
        </FormField>

        <FormField label="Organisme certificateur" htmlFor="certifying_body" required>
          <select
            id="certifying_body"
            name="certifying_body"
            required
            className="w-full h-10 px-3 rounded-md border border-[#0F1419]/[0.12] bg-white text-[14px] text-[#0F1419] focus:border-[#0F1419] focus:outline-none"
            defaultValue=""
          >
            <option value="" disabled>
              Sélectionne ton organisme
            </option>
            {COFRAC_BODIES.map((body) => (
              <option key={body} value={body}>
                {body}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Certificat de certification PDF"
          htmlFor="certificate"
          required
          hint="Document officiel délivré par ton organisme (10 Mo max)"
        >
          <input
            type="file"
            id="certificate"
            name="certificate"
            required
            accept="application/pdf"
            className="block w-full text-[13px] text-[#0F1419]/75 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-[#0F1419] file:text-white file:font-medium file:cursor-pointer hover:file:bg-[#0F1419]/85"
          />
        </FormField>

        {state?.error && (
          <p className="text-[13px] text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <div className="rounded-md bg-[#F5F7F4] p-3 text-[12px] text-[#0F1419]/70">
          Vérification automatique en cours via API COFRAC. Réponse définitive sous 48 h maximum.
          Vous pouvez continuer sans attendre.
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Continuer
        </Button>
      </form>
    </div>
  )
}
