'use client'

import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useActionState } from 'react'
import { type ClientFormState, createClientAction } from '../actions'
import { ClientFormFields } from '../client-form-fields'

export function ClientForm() {
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(
    createClientAction,
    undefined,
  )

  return (
    <form action={formAction} className="space-y-5">
      <ClientFormFields fieldErrors={state?.fieldErrors} />

      {state?.error && (
        <p className="text-sm text-accent-red" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Créer le client
        </Button>
      </div>
    </form>
  )
}
