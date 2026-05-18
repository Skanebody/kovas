'use client'

import { Loader2 } from 'lucide-react'
import { useActionState } from 'react'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { type PropertyFormState, createPropertyAction } from '../actions'

interface PropertyFormProps {
  clients: { id: string; display_name: string }[]
}

export function PropertyForm({ clients }: PropertyFormProps) {
  const [state, formAction, pending] = useActionState<PropertyFormState, FormData>(
    createPropertyAction,
    undefined,
  )

  const fieldErrors = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-5">
      <FormField label="Adresse" htmlFor="address" required error={fieldErrors.address}>
        <AddressAutocomplete name="address" required />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Type de bien" htmlFor="propertyType">
          <Select id="propertyType" name="propertyType" defaultValue="">
            <option value="">Non précisé</option>
            <option value="maison">Maison</option>
            <option value="appartement">Appartement</option>
            <option value="immeuble">Immeuble</option>
            <option value="local_commercial">Local commercial</option>
            <option value="bureau">Bureau</option>
            <option value="autre">Autre</option>
          </Select>
        </FormField>

        <FormField label="Année de construction" htmlFor="yearBuilt">
          <Input id="yearBuilt" name="yearBuilt" type="number" min={1000} max={2100} placeholder="1975" />
        </FormField>
      </div>

      <FormField label="Surface totale (m²)" htmlFor="surfaceTotal">
        <Input id="surfaceTotal" name="surfaceTotal" type="number" min={0} step="0.01" placeholder="85" />
      </FormField>

      <FormField label="Client donneur d'ordre (optionnel)" htmlFor="clientId">
        <Select id="clientId" name="clientId" defaultValue="">
          <option value="">— Aucun client lié pour le moment —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Notes" htmlFor="notes">
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
          Créer le bien
        </Button>
      </div>
    </form>
  )
}
