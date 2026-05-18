'use client'

import { Loader2 } from 'lucide-react'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { type ClientFormState, updateClientAction } from '../../actions'

interface EditClientFormProps {
  client: {
    id: string
    type: string
    display_name: string
    first_name: string | null
    last_name: string | null
    company_name: string | null
    email: string | null
    phone: string | null
    notes: string | null
  }
}

export function EditClientForm({ client }: EditClientFormProps) {
  const boundAction = updateClientAction.bind(null, client.id)
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(
    boundAction,
    undefined,
  )

  const fieldErrors = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-5">
      <FormField label="Type" htmlFor="type" required error={fieldErrors.type}>
        <Select id="type" name="type" defaultValue={client.type} required>
          <option value="particulier">Particulier</option>
          <option value="agence">Agence immobilière</option>
          <option value="notaire">Notaire</option>
          <option value="syndic">Syndic de copropriété</option>
          <option value="entreprise">Entreprise</option>
          <option value="collectivite">Collectivité</option>
        </Select>
      </FormField>

      <FormField
        label="Nom affiché"
        htmlFor="displayName"
        required
        error={fieldErrors.displayName}
      >
        <Input
          id="displayName"
          name="displayName"
          required
          defaultValue={client.display_name}
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Prénom" htmlFor="firstName">
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            defaultValue={client.first_name ?? ''}
          />
        </FormField>
        <FormField label="Nom" htmlFor="lastName">
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            defaultValue={client.last_name ?? ''}
          />
        </FormField>
      </div>

      <FormField label="Société (si applicable)" htmlFor="companyName">
        <Input id="companyName" name="companyName" defaultValue={client.company_name ?? ''} />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Email" htmlFor="email" error={fieldErrors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={client.email ?? ''}
          />
        </FormField>
        <FormField label="Téléphone" htmlFor="phone">
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={client.phone ?? ''}
          />
        </FormField>
      </div>

      <FormField label="Notes internes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={3} defaultValue={client.notes ?? ''} />
      </FormField>

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
