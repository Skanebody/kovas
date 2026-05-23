'use client'

/**
 * KOVAS — Formulaire d'édition de la fiche publique diagnostiqueur.
 *
 * Champs édités :
 *  - bio_short (300 c. max) : tagline affichée dans les résultats
 *  - bio_long  (2000 c. max) : présentation détaillée
 *  - intervention_zones : liste virgule-séparée de communes (max 10)
 *  - opening_hours : 7 jours, slots open/close en HH:MM
 *  - specialties : 8 diagnostics standards (checkboxes)
 *
 * Server Action : updatePublicProfileAction (./actions.ts)
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2, Save } from 'lucide-react'
import { useActionState } from 'react'
import { type AnnuaireFormState, updatePublicProfileAction } from './actions'

const DAYS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'mon', label: 'Lundi' },
  { key: 'tue', label: 'Mardi' },
  { key: 'wed', label: 'Mercredi' },
  { key: 'thu', label: 'Jeudi' },
  { key: 'fri', label: 'Vendredi' },
  { key: 'sat', label: 'Samedi' },
  { key: 'sun', label: 'Dimanche' },
]

const SPECIALTIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'DPE', label: 'DPE' },
  { value: 'AMIANTE', label: 'Amiante' },
  { value: 'PLOMB', label: 'Plomb (CREP)' },
  { value: 'GAZ', label: 'Gaz' },
  { value: 'ELEC', label: 'Électricité' },
  { value: 'TERMITES', label: 'Termites' },
  { value: 'CARREZ', label: 'Carrez / Boutin' },
  { value: 'ERP', label: 'ERP' },
]

export interface AnnuaireInitialValues {
  bio_short: string
  bio_long: string
  intervention_zones: readonly string[]
  opening_hours: Record<string, { open: string; close: string }>
  specialties: readonly string[]
}

interface AnnuaireEditFormProps {
  initial: AnnuaireInitialValues
}

const initialState: AnnuaireFormState = undefined

export function AnnuaireEditForm({ initial }: AnnuaireEditFormProps) {
  const [state, formAction, pending] = useActionState(updatePublicProfileAction, initialState)

  return (
    <form action={formAction} className="space-y-6">
      <Card variant="flat" padding="sm">
        <h3 className="text-[13px] font-semibold text-ink mb-3">Présentation</h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="bio_short"
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute"
            >
              Bio courte (300 c. max)
            </label>
            <textarea
              id="bio_short"
              name="bio_short"
              defaultValue={initial.bio_short}
              maxLength={300}
              rows={2}
              className="w-full resize-none rounded-md border border-rule bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-navy focus:ring-4 focus:ring-navy/10"
              placeholder="Diagnostiqueur certifié COFRAC, 12 ans d'expérience à Paris et petite couronne."
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="bio_long"
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute"
            >
              Bio détaillée (2000 c. max)
            </label>
            <textarea
              id="bio_long"
              name="bio_long"
              defaultValue={initial.bio_long}
              maxLength={2000}
              rows={6}
              className="w-full resize-none rounded-md border border-rule bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-navy focus:ring-4 focus:ring-navy/10"
              placeholder="Décrivez votre parcours, vos certifications, vos zones d'intervention spécifiques…"
            />
          </div>
        </div>
      </Card>

      <Card variant="flat" padding="sm">
        <h3 className="text-[13px] font-semibold text-ink mb-3">Zones d'intervention</h3>
        <div className="space-y-1.5">
          <label
            htmlFor="intervention_zones"
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute"
          >
            Villes (séparées par des virgules, 10 max)
          </label>
          <input
            id="intervention_zones"
            name="intervention_zones"
            defaultValue={initial.intervention_zones.join(', ')}
            className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-navy focus:ring-4 focus:ring-navy/10"
            placeholder="Paris, Boulogne-Billancourt, Neuilly-sur-Seine"
          />
        </div>
      </Card>

      <Card variant="flat" padding="sm">
        <h3 className="text-[13px] font-semibold text-ink mb-3">Spécialités</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SPECIALTIES.map((s) => {
            const checked = initial.specialties.includes(s.value)
            return (
              <label
                key={s.value}
                className="flex items-center gap-2 rounded-md border border-rule/60 bg-paper/85 px-3 py-2 cursor-pointer hover:border-navy/30"
              >
                <input
                  type="checkbox"
                  name={`specialty_${s.value}`}
                  defaultChecked={checked}
                  className="size-3.5 rounded border-rule"
                />
                <span className="text-[12.5px] text-ink">{s.label}</span>
              </label>
            )
          })}
        </div>
      </Card>

      <Card variant="flat" padding="sm">
        <h3 className="text-[13px] font-semibold text-ink mb-3">Horaires d'ouverture</h3>
        <div className="space-y-2">
          {DAYS.map((d) => {
            const hours = initial.opening_hours[d.key]
            return (
              <div key={d.key} className="grid grid-cols-3 gap-2 items-center">
                <span className="text-[12.5px] text-ink-mute">{d.label}</span>
                <input
                  type="time"
                  name={`oh_${d.key}_open`}
                  defaultValue={hours?.open ?? ''}
                  className="rounded-md border border-rule bg-paper px-2 py-1.5 text-[12.5px] text-ink"
                />
                <input
                  type="time"
                  name={`oh_${d.key}_close`}
                  defaultValue={hours?.close ?? ''}
                  className="rounded-md border border-rule bg-paper px-2 py-1.5 text-[12.5px] text-ink"
                />
              </div>
            )
          })}
        </div>
      </Card>

      {state?.error && <p className="text-[12px] text-accent-red">Erreur : {state.error}</p>}
      {state?.success && (
        <p className="text-[12px] text-accent-green">
          Fiche mise à jour. Les modifications sont visibles immédiatement sur l'annuaire.
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Enregistrer la fiche
      </Button>
    </form>
  )
}
