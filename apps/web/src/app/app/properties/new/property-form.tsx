'use client'

import { Building2, Loader2 } from 'lucide-react'
import { useState } from 'react'
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

/**
 * Types de biens pour lesquels les champs appartement/lot/étage/bât. sont affichés.
 * On les montre uniquement quand pertinent pour éviter d'encombrer le form maison.
 */
const COLLECTIVE_TYPES = new Set(['appartement', 'immeuble', 'local_commercial', 'bureau'])

export function PropertyForm({ clients }: PropertyFormProps) {
  const [state, formAction, pending] = useActionState<PropertyFormState, FormData>(
    createPropertyAction,
    undefined,
  )
  const [propertyType, setPropertyType] = useState<string>('')
  const showCollectiveFields = COLLECTIVE_TYPES.has(propertyType)

  const fieldErrors = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-5">
      <FormField label="Adresse" htmlFor="address" required error={fieldErrors.address}>
        <AddressAutocomplete name="address" required />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Type de bien" htmlFor="propertyType">
          <Select
            id="propertyType"
            name="propertyType"
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
          >
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
          <Input
            id="yearBuilt"
            name="yearBuilt"
            type="number"
            min={1000}
            max={2100}
            placeholder="1975"
          />
        </FormField>
      </div>

      <FormField label="Surface totale (m²)" htmlFor="surfaceTotal">
        <Input
          id="surfaceTotal"
          name="surfaceTotal"
          type="number"
          min={0}
          step="0.01"
          placeholder="85"
        />
      </FormField>

      {showCollectiveFields && (
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="size-4" /> Détails appartement / lot
          </div>

          <FormField
            label="Identification appartement"
            htmlFor="apartmentDetail"
            hint="Ex : « Apt 12B », « 3ème étage gauche », « Studio 04 »"
          >
            <Input
              id="apartmentDetail"
              name="apartmentDetail"
              type="text"
              maxLength={120}
              placeholder="Apt 12B"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Bâtiment" htmlFor="buildingLetter" hint="Ex : A, B, C">
              <Input id="buildingLetter" name="buildingLetter" type="text" maxLength={10} />
            </FormField>

            <FormField label="Étage" htmlFor="floorNumber" hint="0 = RDC, -1 = sous-sol">
              <Input
                id="floorNumber"
                name="floorNumber"
                type="number"
                min={-5}
                max={60}
                placeholder="3"
              />
            </FormField>

            <FormField
              label="N° lot copropriété"
              htmlFor="lotNumber"
              hint="Si connu (règlement copro)"
            >
              <Input id="lotNumber" name="lotNumber" type="text" maxLength={20} />
            </FormField>
          </div>
        </div>
      )}

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
