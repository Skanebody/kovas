'use client'

import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useActionState } from 'react'
import { type ClientFormState, updateClientAction } from '../../actions'
import { type ClientFormDefaults, ClientFormFields } from '../../client-form-fields'

interface EditClientFormProps {
  client: ClientFormDefaults & { id: string }
}

export function EditClientForm({ client }: EditClientFormProps) {
  const boundAction = updateClientAction.bind(null, client.id)
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(
    boundAction,
    undefined,
  )

  return (
    <form action={formAction} className="space-y-5">
      <ClientFormFields defaults={client} fieldErrors={state?.fieldErrors} />

      {state?.error && (
        <p className="text-sm text-accent-red" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Enregistrer les modifications
        </Button>
      </div>
    </form>
  )
}
