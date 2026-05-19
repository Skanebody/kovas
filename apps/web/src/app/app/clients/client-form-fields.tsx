'use client'

import { Building2 } from 'lucide-react'
import { useState } from 'react'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { isBusinessClientType, type ClientType } from '@/lib/validation/client'

export type ClientFormDefaults = {
  type?: string
  display_name?: string
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  postal_code?: string | null
  city?: string | null
  apartment_detail?: string | null
  building_letter?: string | null
  floor_number?: number | null
  address_complement?: string | null
  siret?: string | null
  notes?: string | null
}

type ClientFormFieldsProps = {
  defaults?: ClientFormDefaults
  fieldErrors?: Record<string, string>
}

export function ClientFormFields({ defaults, fieldErrors = {} }: ClientFormFieldsProps) {
  const [type, setType] = useState<ClientType>((defaults?.type as ClientType) ?? 'particulier')
  const [postalCode, setPostalCode] = useState(defaults?.postal_code ?? '')
  const [city, setCity] = useState(defaults?.city ?? '')
  const business = isBusinessClientType(type)

  return (
    <>
      <FormField label="Type" htmlFor="type" required error={fieldErrors.type}>
        <Select
          id="type"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as ClientType)}
          required
        >
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
        hint="Nom ou raison sociale tel qu'il apparaîtra sur les dossiers et rapports"
        required
        error={fieldErrors.displayName}
      >
        <Input
          id="displayName"
          name="displayName"
          required
          placeholder={business ? 'Cabinet Martin Immobilier' : 'Pierre Martin'}
          defaultValue={defaults?.display_name ?? ''}
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Prénom" htmlFor="firstName" error={fieldErrors.firstName}>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            defaultValue={defaults?.first_name ?? ''}
          />
        </FormField>
        <FormField label="Nom" htmlFor="lastName" error={fieldErrors.lastName}>
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            defaultValue={defaults?.last_name ?? ''}
          />
        </FormField>
      </div>

      {business ? (
        <>
          <FormField
            label="Raison sociale"
            htmlFor="companyName"
            required
            error={fieldErrors.companyName}
          >
            <Input
              id="companyName"
              name="companyName"
              required
              placeholder="SARL Diagnostic Martin"
              defaultValue={defaults?.company_name ?? ''}
            />
          </FormField>

          <FormField
            label="SIRET"
            htmlFor="siret"
            hint="14 chiffres — facturation et mandats professionnels"
            error={fieldErrors.siret}
          >
            <Input
              id="siret"
              name="siret"
              inputMode="numeric"
              autoComplete="off"
              maxLength={17}
              placeholder="123 456 789 00012"
              defaultValue={defaults?.siret ?? ''}
            />
          </FormField>
        </>
      ) : (
        <FormField label="Société (si applicable)" htmlFor="companyName" error={fieldErrors.companyName}>
          <Input id="companyName" name="companyName" defaultValue={defaults?.company_name ?? ''} />
        </FormField>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Email"
          htmlFor="email"
          hint="Au moins email ou téléphone"
          error={fieldErrors.email}
        >
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={defaults?.email ?? ''}
          />
        </FormField>
        <FormField label="Téléphone" htmlFor="phone" hint="Au moins email ou téléphone" error={fieldErrors.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+33 6 12 34 56 78"
            defaultValue={defaults?.phone ?? ''}
          />
        </FormField>
      </div>

      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">Adresse du cabinet (facturation)</legend>
        <p className="text-xs text-ink-mute -mt-2">
          Voie, numéro, appartement, bâtiment — l&apos;adresse du bien diagnostiqué est sur chaque dossier.
        </p>

        <FormField
          label="Voie et numéro"
          htmlFor="address"
          error={fieldErrors.address}
          hint="Recherche BAN — ex. 12 rue de Rivoli, 75001 Paris"
        >
          <AddressAutocomplete
            name="address"
            defaultValue={defaults?.address ?? ''}
            placeholder="12 rue de Rivoli, 75001 Paris"
            onSelect={(v) => {
              if (v.postalCode) setPostalCode(v.postalCode)
              if (v.city) setCity(v.city)
            }}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Code postal" htmlFor="postalCode" error={fieldErrors.postalCode}>
            <Input
              id="postalCode"
              name="postalCode"
              autoComplete="postal-code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </FormField>
          <FormField label="Ville" htmlFor="city" error={fieldErrors.city}>
            <Input
              id="city"
              name="city"
              autoComplete="address-level2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </FormField>
        </div>

        <div className="rounded-xl border border-border bg-paper/50 p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="size-4" /> Complément d&apos;adresse
          </div>

          <FormField
            label="Appartement / local / porte"
            htmlFor="apartmentDetail"
            hint='Ex : « Apt 12B », « 3ème étage gauche », « Local 204 »'
            error={fieldErrors.apartmentDetail}
          >
            <Input
              id="apartmentDetail"
              name="apartmentDetail"
              type="text"
              maxLength={120}
              placeholder="Apt 12B, Porte gauche"
              defaultValue={defaults?.apartment_detail ?? ''}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              label="Bâtiment / entrée"
              htmlFor="buildingLetter"
              hint="Ex : A, B, Entrée 2"
              error={fieldErrors.buildingLetter}
            >
              <Input
                id="buildingLetter"
                name="buildingLetter"
                type="text"
                maxLength={10}
                placeholder="Bât. A"
                defaultValue={defaults?.building_letter ?? ''}
              />
            </FormField>

            <FormField label="Étage" htmlFor="floorNumber" hint="0 = RDC, -1 = sous-sol" error={fieldErrors.floorNumber}>
              <Input
                id="floorNumber"
                name="floorNumber"
                type="number"
                min={-5}
                max={60}
                placeholder="3"
                defaultValue={defaults?.floor_number ?? ''}
              />
            </FormField>
          </div>

          <FormField
            label="Autre complément"
            htmlFor="addressComplement"
            hint="Résidence, BP, digicode courrier, nom sur l'interphone…"
            error={fieldErrors.addressComplement}
          >
            <Input
              id="addressComplement"
              name="addressComplement"
              type="text"
              maxLength={200}
              placeholder="Résidence Les Oliviers, BP 42"
              defaultValue={defaults?.address_complement ?? ''}
            />
          </FormField>
        </div>
      </fieldset>

      <FormField label="Notes internes" htmlFor="notes" error={fieldErrors.notes}>
        <Textarea id="notes" name="notes" rows={3} defaultValue={defaults?.notes ?? ''} />
      </FormField>
    </>
  )
}
