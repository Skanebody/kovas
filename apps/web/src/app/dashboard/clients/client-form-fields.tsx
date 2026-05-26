'use client'

import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { type ClientType, isBusinessClientType } from '@/lib/validation/client'
import { Building2, CheckCircle2, Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { verifyClientSiretAction } from './actions-sirene'

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

  // SIRET / companyName contrôlés pour permettre le pré-remplissage SIRENE.
  const [siret, setSiret] = useState(defaults?.siret ?? '')
  const [companyName, setCompanyName] = useState(defaults?.company_name ?? '')
  const [sirenePending, startSireneTransition] = useTransition()
  const [sireneInfo, setSireneInfo] = useState<{
    found: boolean
    isActive: boolean
    nafLabel: string | null
    error: string | null
  } | null>(null)

  function handleSiretBlur() {
    const cleaned = siret.replace(/\s/g, '')
    if (!/^\d{14}$/.test(cleaned)) {
      setSireneInfo(null)
      return
    }
    startSireneTransition(async () => {
      const result = await verifyClientSiretAction(cleaned)
      if (!result.ok) {
        setSireneInfo({ found: false, isActive: false, nafLabel: null, error: result.error })
        return
      }
      // Pré-remplit le nom de société uniquement si vide (l'utilisateur reste maître).
      if (result.found && result.companyName && !companyName.trim()) {
        setCompanyName(result.companyName)
      }
      setSireneInfo({
        found: result.found,
        isActive: result.isActive,
        nafLabel: result.nafLabel,
        error: null,
      })
    })
  }

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
        hint="Visible sur dossiers et rapports"
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
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </FormField>

          <FormField
            label="SIRET"
            htmlFor="siret"
            hint="14 chiffres — vérifié au registre SIRENE"
            error={fieldErrors.siret}
          >
            <div className="relative">
              <Input
                id="siret"
                name="siret"
                inputMode="numeric"
                autoComplete="off"
                maxLength={17}
                placeholder="123 456 789 00012"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                onBlur={handleSiretBlur}
              />
              {sirenePending ? (
                <Loader2
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-ink-mute animate-spin"
                  aria-label="Vérification SIRENE en cours"
                />
              ) : sireneInfo?.found && sireneInfo.isActive ? (
                <CheckCircle2
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-accent-green"
                  aria-label="SIRET vérifié au registre SIRENE"
                />
              ) : null}
            </div>
            {sireneInfo && !sirenePending ? (
              <p
                className={`mt-1.5 text-xs ${
                  sireneInfo.error
                    ? 'text-ink-mute'
                    : sireneInfo.found && sireneInfo.isActive
                      ? 'text-accent-green'
                      : 'text-accent-red'
                }`}
              >
                {sireneInfo.error
                  ? sireneInfo.error
                  : !sireneInfo.found
                    ? 'SIRET inconnu au registre SIRENE'
                    : !sireneInfo.isActive
                      ? 'Établissement fermé au registre SIRENE'
                      : `Vérifié — ${sireneInfo.nafLabel ?? 'activité enregistrée'}`}
              </p>
            ) : null}
          </FormField>
        </>
      ) : (
        <FormField
          label="Société (si applicable)"
          htmlFor="companyName"
          error={fieldErrors.companyName}
        >
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
        <FormField
          label="Téléphone"
          htmlFor="phone"
          hint="Au moins email ou téléphone"
          error={fieldErrors.phone}
        >
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

      <fieldset className="space-y-4 rounded-xl border border-rule/80 glass-opaque p-4">
        <legend className="px-1 text-sm font-medium text-ink">
          Adresse du cabinet (facturation)
        </legend>
        <p className="text-xs text-ink-mute -mt-2">
          Voie, numéro, appartement, bâtiment — l&apos;adresse du bien diagnostiqué est sur chaque
          dossier.
        </p>

        <FormField
          label="Voie et numéro"
          htmlFor="address"
          error={fieldErrors.address}
          hint="Recherche BAN"
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

        <div className="rounded-xl border border-rule/80 glass-opaque p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Building2 className="size-4" /> Complément d&apos;adresse
          </div>

          <FormField
            label="Appartement / local / porte"
            htmlFor="apartmentDetail"
            hint="Ex : Apt 12B, Local 204"
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

            <FormField
              label="Étage"
              htmlFor="floorNumber"
              hint="0 = RDC, -1 = sous-sol"
              error={fieldErrors.floorNumber}
            >
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
            hint="Résidence, BP, digicode, interphone"
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
