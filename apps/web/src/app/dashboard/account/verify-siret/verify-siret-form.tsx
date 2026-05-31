'use client'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { useActionState } from 'react'
import { type VerifySiretState, verifyAndSaveSiretAction } from './actions'

export function VerifySiretForm() {
  const [state, formAction, pending] = useActionState<VerifySiretState, FormData>(
    verifyAndSaveSiretAction,
    undefined,
  )
  const errors = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-4">
      <FormField
        label="Numéro SIRET du cabinet"
        htmlFor="siret"
        required
        hint="14 chiffres — celui de ton cabinet de diagnostic immobilier"
        error={errors.siret}
      >
        <Input
          id="siret"
          name="siret"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required
          maxLength={17}
          pattern="[\d\s]{14,17}"
          placeholder="123 456 789 00012"
        />
      </FormField>

      {state?.error && (
        <p className="text-sm text-accent-red" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Valider mon SIRET et activer mon compte
      </Button>
    </form>
  )
}
