'use client'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { useActionState } from 'react'
import { resubmitCofrac } from '../actions'

const COFRAC_BODIES = [
  'Bureau Veritas Certification',
  'Apave Certification',
  'Dekra Certification',
  'SOCOTEC',
  'Qualibat',
  'autre',
] as const

interface CofracResubmitFormProps {
  currentNumber: string | null
  currentBody: string | null
}

export function CofracResubmitForm({ currentNumber, currentBody }: CofracResubmitFormProps) {
  const [state, formAction, pending] = useActionState(resubmitCofrac, undefined)

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      <FormField
        label="Numéro de certification COFRAC"
        htmlFor="cofrac_number"
        required
        hint="Format : COFRAC-XXX-NNNNN (visible sur le certificat)"
      >
        <Input
          id="cofrac_number"
          name="cofrac_number"
          type="text"
          required
          pattern="COFRAC-\d{3}-\d{5}"
          placeholder="COFRAC-123-45678"
          defaultValue={currentNumber ?? ''}
        />
      </FormField>

      <FormField label="Organisme certificateur" htmlFor="certifying_body" required>
        <select
          id="certifying_body"
          name="certifying_body"
          required
          className="w-full h-10 px-3 rounded-md border border-[#0F1419]/[0.12] bg-white text-[14px] text-[#0F1419] focus:border-[#0F1419] focus:outline-none"
          defaultValue={currentBody ?? ''}
        >
          <option value="" disabled>
            Sélectionne l&apos;organisme
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
        hint="Document officiel délivré par l'organisme (10 Mo max). Re-téléverse même si déjà fourni."
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
        Vérification automatique relancée via API COFRAC. Réponse définitive sous 48 h maximum.
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Re-soumettre
      </Button>
    </form>
  )
}
