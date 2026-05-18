'use client'

import { Building2, Loader2 } from 'lucide-react'
import { useActionState, useState } from 'react'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { type PropertyFormState, updatePropertyAction } from '../../actions'

interface EditPropertyFormProps {
  property: {
    id: string
    address: string | null
    postal_code: string | null
    city: string | null
    insee_code: string | null
    property_type: string | null
    year_built: number | null
    surface_total: number | null
    apartment_detail: string | null
    building_letter: string | null
    floor_number: number | null
    lot_number: string | null
    client_id: string | null
    notes: string | null
  }
  clients: { id: string; display_name: string }[]
}

const COLLECTIVE_TYPES = new Set(['appartement', 'immeuble', 'local_commercial', 'bureau'])

export function EditPropertyForm({ property, clients }: EditPropertyFormProps) {
  // Bind propertyId pour le server action
  const boundAction = updatePropertyAction.bind(null, property.id)
  const [state, formAction, pending] = useActionState<PropertyFormState, FormData>(
    boundAction,
    undefined,
  )
  const [propertyType, setPropertyType] = useState<string>(property.property_type ?? '')
  const showCollectiveFields = COLLECTIVE_TYPES.has(propertyType)

  const fieldErrors = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-5">
      <FormField label="Adresse" htmlFor="address" required error={fieldErrors.address}>
        <AddressAutocomplete name="address" required defaultValue={property.address ?? ''} />
      </FormField>

      {/* Conserve city/postal_code en hidden si pas modifié via autocomplete */}
      <input type="hidden" name="city" value={property.city ?? ''} />
      <input type="hidden" name="postalCode" value={property.postal_code ?? ''} />

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
            defaultValue={property.year_built ?? ''}
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
          defaultValue={property.surface_total ?? ''}
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
            hint='Ex : « Apt 12B », « 3ème étage gauche »'
          >
            <Input
              id="apartmentDetail"
              name="apartmentDetail"
              type="text"
              maxLength={120}
              defaultValue={property.apartment_detail ?? ''}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Bâtiment" htmlFor="buildingLetter" hint="Ex : A, B">
              <Input
                id="buildingLetter"
                name="buildingLetter"
                type="text"
                maxLength={10}
                defaultValue={property.building_letter ?? ''}
              />
            </FormField>

            <FormField label="Étage" htmlFor="floorNumber" hint="0 = RDC">
              <Input
                id="floorNumber"
                name="floorNumber"
                type="number"
                min={-5}
                max={60}
                defaultValue={property.floor_number ?? ''}
              />
            </FormField>

            <FormField label="N° lot copropriété" htmlFor="lotNumber">
              <Input
                id="lotNumber"
                name="lotNumber"
                type="text"
                maxLength={20}
                defaultValue={property.lot_number ?? ''}
              />
            </FormField>
          </div>
        </div>
      )}

      <FormField label="Client donneur d'ordre" htmlFor="clientId">
        <Select id="clientId" name="clientId" defaultValue={property.client_id ?? ''}>
          <option value="">— Aucun client lié —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={3} defaultValue={property.notes ?? ''} />
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
