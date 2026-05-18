'use client'

import { Loader2 } from 'lucide-react'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { type MissionFormState, createMissionAction } from '../actions'

interface MissionFormProps {
  properties: { id: string; address: string; city: string | null; postal_code: string | null }[]
  clients: { id: string; display_name: string }[]
  defaultPropertyId?: string
  defaultClientId?: string
}

export function MissionForm({
  properties,
  clients,
  defaultPropertyId,
  defaultClientId,
}: MissionFormProps) {
  const [state, formAction, pending] = useActionState<MissionFormState, FormData>(
    createMissionAction,
    undefined,
  )

  const fieldErrors = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-5">
      <FormField label="Bien concerné" htmlFor="propertyId" required error={fieldErrors.propertyId}>
        <Select id="propertyId" name="propertyId" defaultValue={defaultPropertyId ?? ''} required>
          <option value="" disabled>
            — Sélectionnez un bien —
          </option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.address}
              {p.city ? ` · ${p.postal_code ?? ''} ${p.city}`.trim() : ''}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Client donneur d'ordre (optionnel)" htmlFor="clientId">
        <Select id="clientId" name="clientId" defaultValue={defaultClientId ?? ''}>
          <option value="">— Aucun client lié —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Type de diagnostic" htmlFor="type" required error={fieldErrors.type}>
        <Select id="type" name="type" defaultValue="dpe_vente" required>
          <optgroup label="DPE">
            <option value="dpe_vente">DPE vente</option>
            <option value="dpe_location">DPE location</option>
            <option value="copropriete">DPE copropriété</option>
          </optgroup>
          <optgroup label="Amiante">
            <option value="amiante_vente">Amiante vente</option>
            <option value="amiante_avant_travaux">Amiante avant travaux</option>
          </optgroup>
          <optgroup label="Autres diagnostics">
            <option value="plomb_crep">Plomb CREP</option>
            <option value="gaz">Gaz</option>
            <option value="electricite">Électricité</option>
            <option value="termites">Termites</option>
            <option value="carrez_boutin">Carrez / Boutin</option>
            <option value="erp">ERP</option>
          </optgroup>
        </Select>
      </FormField>

      <FormField
        label="Date prévue"
        htmlFor="scheduledAt"
        hint="Laisser vide pour garder en brouillon"
      >
        <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
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
          Créer la mission
        </Button>
      </div>
    </form>
  )
}
