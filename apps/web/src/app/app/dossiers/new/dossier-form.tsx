'use client'

import { Info, Loader2 } from 'lucide-react'
import { useActionState, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { type DossierFormState, createDossierAction } from '../actions'

interface DossierFormProps {
  properties: { id: string; address: string; city: string | null; postal_code: string | null; year_built: number | null }[]
  clients: { id: string; display_name: string }[]
  defaultPropertyId?: string
  defaultClientId?: string
}

interface DiagOption {
  value: string
  label: string
  hint?: string
  group: 'dpe' | 'amiante' | 'autres'
}

const DIAG_OPTIONS: DiagOption[] = [
  { value: 'dpe_vente', label: 'DPE vente', group: 'dpe', hint: 'Performance énergétique pour mise en vente' },
  { value: 'dpe_location', label: 'DPE location', group: 'dpe', hint: 'Performance énergétique pour mise en location' },
  { value: 'copropriete', label: 'DPE copropriété', group: 'dpe', hint: 'DPE à l\'échelle de l\'immeuble' },
  { value: 'amiante_vente', label: 'Amiante vente', group: 'amiante', hint: 'Bâti < 1997' },
  { value: 'amiante_avant_travaux', label: 'Amiante avant travaux', group: 'amiante' },
  { value: 'plomb_crep', label: 'Plomb CREP', group: 'autres', hint: 'Bâti < 1949' },
  { value: 'gaz', label: 'Gaz', group: 'autres', hint: 'Installation > 15 ans' },
  { value: 'electricite', label: 'Électricité', group: 'autres', hint: 'Installation > 15 ans' },
  { value: 'termites', label: 'Termites', group: 'autres', hint: 'Zone à risque préfectoral' },
  { value: 'carrez_boutin', label: 'Carrez / Boutin', group: 'autres', hint: 'Mesurage légal' },
  { value: 'erp', label: 'ERP', group: 'autres', hint: 'État des risques (gratuit Géorisques)' },
]

const GROUP_LABELS = {
  dpe: 'DPE',
  amiante: 'Amiante',
  autres: 'Autres diagnostics',
}

// Pack "vente avant 1949" : DPE + Amiante + Plomb (cas typique le plus complet)
const QUICK_PACKS = [
  {
    id: 'vente_avant_1949',
    label: 'Pack vente, bâti avant 1949',
    types: ['dpe_vente', 'amiante_vente', 'plomb_crep'],
  },
  {
    id: 'vente_1949_1997',
    label: 'Pack vente, bâti 1949-1997',
    types: ['dpe_vente', 'amiante_vente'],
  },
  {
    id: 'vente_recent',
    label: 'Pack vente, bâti récent',
    types: ['dpe_vente'],
  },
  {
    id: 'location',
    label: 'Pack location',
    types: ['dpe_location'],
  },
  {
    id: 'complet',
    label: 'Pack complet (DPE + Amiante + Plomb + Gaz + Élec)',
    types: ['dpe_vente', 'amiante_vente', 'plomb_crep', 'gaz', 'electricite'],
  },
]

export function DossierForm({
  properties,
  clients,
  defaultPropertyId,
  defaultClientId,
}: DossierFormProps) {
  const [state, formAction, pending] = useActionState<DossierFormState, FormData>(
    createDossierAction,
    undefined,
  )
  const [selected, setSelected] = useState<Set<string>>(new Set(['dpe_vente']))
  const [propertyId, setPropertyId] = useState<string>(defaultPropertyId ?? '')

  const selectedProperty = properties.find((p) => p.id === propertyId)
  const yearBuilt = selectedProperty?.year_built ?? null

  function toggleDiag(value: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  function applyPack(types: string[]) {
    setSelected(new Set(types))
  }

  // Suggestions auto selon l'année de construction
  const suggestions: string[] = []
  if (yearBuilt) {
    if (yearBuilt < 1949) suggestions.push('plomb_crep')
    if (yearBuilt < 1997) suggestions.push('amiante_vente')
  }

  const fieldErrors = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-6">
      <FormField label="Bien concerné" htmlFor="propertyId" required error={fieldErrors.propertyId}>
        <Select
          id="propertyId"
          name="propertyId"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          required
        >
          <option value="" disabled>— Sélectionnez un bien —</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.address}
              {p.city ? ` · ${p.postal_code ?? ''} ${p.city}`.trim() : ''}
              {p.year_built ? ` · ${p.year_built}` : ''}
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

      <div className="space-y-2">
        <label className="text-xs font-medium" htmlFor="quick-packs">
          Packs rapides
        </label>
        <div id="quick-packs" className="flex flex-wrap gap-2">
          {QUICK_PACKS.map((p) => (
            <Button
              key={p.id}
              type="button"
              variant="glass"
              size="sm"
              onClick={() => applyPack(p.types)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-xs font-medium">
          Diagnostics à effectuer <span className="text-accent-red">*</span>
        </legend>
        {fieldErrors.types && (
          <p className="text-sm text-accent-red" role="alert">{fieldErrors.types}</p>
        )}

        {suggestions.length > 0 && (
          <div className="rounded-md border border-accent-blue/40 bg-accent-blue/10 p-3 flex items-start gap-2 text-sm">
            <Info className="size-4 mt-0.5 text-accent-blue shrink-0" />
            <span>
              Vu l'année de construction ({yearBuilt}), pensez à cocher :{' '}
              <strong>
                {suggestions
                  .map((s) => DIAG_OPTIONS.find((d) => d.value === s)?.label)
                  .filter(Boolean)
                  .join(', ')}
              </strong>
            </span>
          </div>
        )}

        {(['dpe', 'amiante', 'autres'] as const).map((group) => (
          <div key={group} className="space-y-1.5">
            <h3 className="text-xs uppercase tracking-wider text-ink-mute font-semibold">
              {GROUP_LABELS[group]}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {DIAG_OPTIONS.filter((d) => d.group === group).map((d) => {
                const isChecked = selected.has(d.value)
                const isSuggested = suggestions.includes(d.value)
                return (
                  <label
                    key={d.value}
                    className={cn(
                      'flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors',
                      isChecked
                        ? 'border-rule bg-cream-deep/50'
                        : 'border-rule hover:bg-ink/5',
                    )}
                  >
                    <input
                      type="checkbox"
                      name="types"
                      value={d.value}
                      checked={isChecked}
                      onChange={() => toggleDiag(d.value)}
                      className="mt-0.5 accent-foreground"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{d.label}</span>
                        {isSuggested && <Badge variant="blue" className="text-[10px]">Suggéré</Badge>}
                      </div>
                      {d.hint && <p className="text-xs text-ink-mute">{d.hint}</p>}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        ))}

        <p className="text-xs text-ink-mute">
          {selected.size} diagnostic{selected.size > 1 ? 's' : ''} sélectionné
          {selected.size > 1 ? 's' : ''}.
        </p>
      </fieldset>

      <FormField
        label="Date prévue de visite"
        htmlFor="scheduledAt"
        hint="Laisser vide pour garder en brouillon"
      >
        <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
      </FormField>

      <FormField label="Notes internes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={3} />
      </FormField>

      {state?.error && (
        <p className="text-sm text-accent-red" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || selected.size === 0}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Créer le dossier ({selected.size} diag{selected.size > 1 ? 's' : ''})
        </Button>
      </div>
    </form>
  )
}
