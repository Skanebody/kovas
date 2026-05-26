'use client'

import { AddressAutocomplete, type AddressValue } from '@/components/ui/address-autocomplete'
import { BuildingPrefillCard } from '@/components/ui/building-prefill-card'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { PrefillResult } from '@/lib/data-gouv/rnb-bdnb'
import { Building2, Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { useActionState } from 'react'
import { type PropertyFormState, createPropertyAction } from '../actions'
import { lookupBuildingAction } from './actions-prefill'

interface PropertyFormProps {
  clients: { id: string; display_name: string }[]
}

/**
 * Types de biens pour lesquels les champs appartement/lot/étage/bât. sont affichés.
 * On les montre uniquement quand pertinent pour éviter d'encombrer le form maison.
 */
const COLLECTIVE_TYPES = new Set(['appartement', 'immeuble', 'local_commercial', 'bureau'])

/**
 * Seuil de confiance au-dessus duquel on pré-remplit automatiquement le champ.
 * Sous ce seuil, le champ reste vide et le BuildingPrefillCard affiche la valeur
 * comme une suggestion grisée (utilisateur peut copier manuellement).
 */
const PREFILL_CONFIDENCE_THRESHOLD = 0.8

function applyPrefillIfConfident<T>(field?: { value: T; confidence: number }): T | undefined {
  if (!field) return undefined
  return field.confidence >= PREFILL_CONFIDENCE_THRESHOLD ? field.value : undefined
}

export function PropertyForm({ clients }: PropertyFormProps) {
  const [state, formAction, pending] = useActionState<PropertyFormState, FormData>(
    createPropertyAction,
    undefined,
  )

  // Inputs contrôlés pour permettre le pré-remplissage RNB+BDNB (sinon
  // defaultValue ne se rafraîchit pas après la sélection BAN).
  const [propertyType, setPropertyType] = useState<string>('')
  const [yearBuilt, setYearBuilt] = useState<string>('')
  const [surfaceTotal, setSurfaceTotal] = useState<string>('')

  // État du lookup RNB+BDNB (cf. audit data.gouv Top 5 #1)
  const [prefillLoading, startPrefillTransition] = useTransition()
  const [prefill, setPrefill] = useState<PrefillResult | null>(null)
  const [prefillAttempted, setPrefillAttempted] = useState<boolean>(false)

  const showCollectiveFields = COLLECTIVE_TYPES.has(propertyType)
  const fieldErrors = state?.fieldErrors ?? {}

  function handleAddressSelected(value: AddressValue) {
    // Pas de lookup RNB si on n'a pas de coordonnées (cas rare BAN sans geoloc)
    if (typeof value.longitude !== 'number' || typeof value.latitude !== 'number') {
      return
    }

    startPrefillTransition(async () => {
      setPrefillAttempted(true)
      const result = await lookupBuildingAction({
        longitude: value.longitude as number,
        latitude: value.latitude as number,
        label: value.label,
        ...(value.insee ? { insee: value.insee } : {}),
      })

      if (!result.ok || !result.prefill) {
        setPrefill(null)
        return
      }

      const p = result.prefill
      setPrefill(p)

      // Pré-remplissage automatique pour les 3 champs principaux si confiance ≥ 0.8.
      // L'utilisateur peut écraser à tout moment (inputs contrôlés).
      const year = applyPrefillIfConfident(p.year_built)
      if (typeof year === 'number') setYearBuilt(String(year))

      const surface = applyPrefillIfConfident(p.surface_total)
      if (typeof surface === 'number') setSurfaceTotal(String(surface))

      const type = applyPrefillIfConfident(p.property_type)
      if (typeof type === 'string') setPropertyType(type)
    })
  }

  return (
    <form action={formAction} className="space-y-5">
      <FormField label="Adresse" htmlFor="address" required error={fieldErrors.address}>
        <AddressAutocomplete name="address" required onSelect={handleAddressSelected} />
      </FormField>

      {/* Encart RNB + BDNB — visible dès qu'une adresse BAN avec geoloc est
          sélectionnée. États : loading / trouvé / aucune donnée / down. */}
      {prefillAttempted ? (
        <BuildingPrefillCard
          loading={prefillLoading}
          prefill={prefill}
          attempted={prefillAttempted}
        />
      ) : null}

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
            value={yearBuilt}
            onChange={(e) => setYearBuilt(e.target.value)}
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
          value={surfaceTotal}
          onChange={(e) => setSurfaceTotal(e.target.value)}
        />
      </FormField>

      {showCollectiveFields && (
        <div className="rounded-xl border border-rule/80 glass-opaque p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Building2 className="size-4" /> Détails appartement / lot
          </div>

          <FormField
            label="Identification appartement"
            htmlFor="apartmentDetail"
            hint="Ex : Apt 12B, Studio 04"
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
