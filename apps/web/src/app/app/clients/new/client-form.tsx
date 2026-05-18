'use client'

import { Loader2 } from 'lucide-react'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { type ClientFormState, createClientAction } from '../actions'

export function ClientForm() {
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(
    createClientAction,
    undefined,
  )

  const fieldErrors = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-5">
      <FormField label="Type" htmlFor="type" required error={fieldErrors.type}>
        <Select id="type" name="type" defaultValue="particulier" required>
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
        hint="Nom ou raison sociale tel qu'il apparaîtra sur les rapports"
        required
        error={fieldErrors.displayName}
      >
        <Input id="displayName" name="displayName" required placeholder="Pierre Martin" />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Prénom" htmlFor="firstName">
          <Input id="firstName" name="firstName" autoComplete="given-name" />
        </FormField>
        <FormField label="Nom" htmlFor="lastName">
          <Input id="lastName" name="lastName" autoComplete="family-name" />
        </FormField>
      </div>

      <FormField label="Société (si applicable)" htmlFor="companyName">
        <Input id="companyName" name="companyName" />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Email" htmlFor="email" error={fieldErrors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" />
        </FormField>
        <FormField label="Téléphone" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+33 6 12 34 56 78" />
        </FormField>
      </div>

      <FormField label="Notes internes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={3} />
      </FormField>

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
