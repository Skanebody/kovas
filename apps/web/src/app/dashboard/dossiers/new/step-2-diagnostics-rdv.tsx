'use client'

import { AlternativeSuggestions } from '@/components/scheduling/AlternativeSuggestions'
import { ClusteringOpportunity as ClusteringOpportunityCard } from '@/components/scheduling/ClusteringOpportunity'
import { ConflictWarning } from '@/components/scheduling/ConflictWarning'
import { DpeQuotaWarning } from '@/components/scheduling/DpeQuotaWarning'
import { DurationEstimator } from '@/components/scheduling/DurationEstimator'
import { SlotSelector } from '@/components/scheduling/SlotSelector'
import { Badge } from '@/components/ui/badge'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { QuotaWarning } from '@/lib/admin/dpe-quota-tracker'
import type { Alternative } from '@/lib/scheduling/alternative-generator'
import type { ClusteringOpportunity } from '@/lib/scheduling/clustering-suggester'
import type { ConflictResult } from '@/lib/scheduling/conflict-detector'
import type { DurationEstimate } from '@/lib/scheduling/duration-estimator'
import type { SchedulingOwnership, SchedulingPropertyType } from '@/lib/scheduling/duration-schemas'
import { cn } from '@/lib/utils'
import { Info, Phone } from 'lucide-react'
import type { DossierFormData } from './dossier-wizard'

interface Step2Props {
  data: DossierFormData
  patch: (p: Partial<DossierFormData>) => void
  effectiveYear: number | null
  requiredByYear: string[]
  estimate: DurationEstimate | null
  estimateLoading: boolean
  effectiveDurationMin: number
  dpeQuota: QuotaWarning | null
  conflictResult: ConflictResult | null
  alternatives: Alternative[]
  alternativesLoading: boolean
  clusterOpportunity: ClusteringOpportunity | null
  onAcceptAlternative: (alt: Alternative) => void
  onForceOriginal: () => void
  fieldErrors: Record<string, string>
}

interface DiagOption {
  value: string
  label: string
  hint?: string
  group: 'dpe' | 'amiante' | 'autres'
}

const DIAG_OPTIONS: DiagOption[] = [
  {
    value: 'dpe_vente',
    label: 'DPE vente',
    group: 'dpe',
    hint: 'Performance énergétique pour mise en vente',
  },
  {
    value: 'dpe_location',
    label: 'DPE location',
    group: 'dpe',
    hint: 'Performance énergétique pour mise en location',
  },
  {
    value: 'copropriete',
    label: 'DPE copropriété',
    group: 'dpe',
    hint: "DPE à l'échelle de l'immeuble",
  },
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

const SCHEDULING_PROPERTY_OPTIONS: { value: SchedulingPropertyType; label: string }[] = [
  { value: 'studio', label: 'Studio' },
  { value: 'appartement', label: 'Appartement' },
  { value: 'maison_1_niveau', label: 'Maison plain-pied' },
  { value: 'maison_2_niveaux', label: 'Maison R+1' },
  { value: 'maison_3_plus', label: 'Maison R+2 ou plus' },
  { value: 'local', label: 'Local / bureau' },
]

const OWNERSHIP_OPTIONS: { value: SchedulingOwnership; label: string }[] = [
  { value: 'individuel', label: 'Individuel' },
  { value: 'copropriete', label: 'Copropriété' },
  { value: 'monopropriete', label: 'Monopropriété' },
]

// Packs rapides — choix en 1 clic
const QUICK_PACKS = [
  {
    id: 'vente_avant_1949',
    label: 'Vente · avant 1949',
    types: ['dpe_vente', 'amiante_vente', 'plomb_crep'],
  },
  {
    id: 'vente_1949_1997',
    label: 'Vente · 1949-1997',
    types: ['dpe_vente', 'amiante_vente'],
  },
  { id: 'vente_recent', label: 'Vente · récent', types: ['dpe_vente'] },
  { id: 'location', label: 'Location', types: ['dpe_location'] },
  {
    id: 'complet',
    label: 'Pack complet',
    types: ['dpe_vente', 'amiante_vente', 'plomb_crep', 'gaz', 'electricite'],
  },
]

/**
 * Étape 2 — Diagnostics & RDV.
 *
 * Multi-select diagnostics (8 standards), pack 1-clic, scheduling helpers,
 * date + slot selector, conflit / alternatives / clustering / quota DPE.
 *
 * Le calcul d'estimate + conflict est orchestré côté wizard (parent) — ce
 * composant reçoit l'état déjà calculé via props.
 */
export function Step2DiagnosticsRdv({
  data,
  patch,
  effectiveYear,
  requiredByYear,
  estimate,
  estimateLoading,
  effectiveDurationMin,
  dpeQuota,
  conflictResult,
  alternatives,
  alternativesLoading,
  clusterOpportunity,
  onAcceptAlternative,
  onForceOriginal,
  fieldErrors,
}: Step2Props) {
  function toggleDiag(value: string) {
    const next = new Set(data.selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    patch({ selected: next })
  }

  function applyPack(types: string[]) {
    patch({ selected: new Set(types) })
  }

  return (
    <div className="space-y-6">
      {/* 1. Quick packs */}
      <section className="space-y-2.5">
        <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute">
          Pack rapide — 1 clic
        </span>
        <div className="flex flex-wrap gap-2">
          {QUICK_PACKS.map((p) => {
            const isActive =
              p.types.length === data.selected.size && p.types.every((t) => data.selected.has(t))
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPack(p.types)}
                className={cn(
                  'rounded-pill px-3 py-1.5 text-xs font-medium transition-colors border',
                  isActive
                    ? 'bg-[#0F1419] text-paper border-[#0F1419]'
                    : 'bg-paper text-ink border-rule hover:border-[#0F1419]/40 hover:bg-sage-alt/40',
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* 2. Diagnostics détaillés */}
      <fieldset className="space-y-3">
        <legend className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute">
          Diagnostics à effectuer <span className="text-accent-red">*</span>
        </legend>
        {fieldErrors.types && (
          <p className="text-sm text-accent-red" role="alert">
            {fieldErrors.types}
          </p>
        )}

        {effectiveYear && requiredByYear.length > 2 && (
          <div className="rounded-md border border-accent-green/40 bg-accent-green/10 p-3 flex items-start gap-2 text-sm">
            <Info className="size-4 mt-0.5 text-accent-green shrink-0" />
            <span>
              Bâti {effectiveYear} — diagnostics obligatoires cochés automatiquement :{' '}
              <strong>
                {requiredByYear
                  .map((s) => DIAG_OPTIONS.find((d) => d.value === s)?.label)
                  .filter(Boolean)
                  .join(', ')}
              </strong>
              .
            </span>
          </div>
        )}

        {(['dpe', 'amiante', 'autres'] as const).map((group) => (
          <div key={group} className="space-y-1.5">
            <h3 className="text-[11px] uppercase tracking-wider text-ink-mute font-semibold">
              {GROUP_LABELS[group]}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {DIAG_OPTIONS.filter((d) => d.group === group).map((d) => {
                const isChecked = data.selected.has(d.value)
                const isRequired = requiredByYear.includes(d.value)
                return (
                  <label
                    key={d.value}
                    className={cn(
                      'flex items-start gap-3 rounded-md border p-2.5 cursor-pointer transition-colors',
                      isChecked
                        ? 'border-[#0F1419]/40 bg-[#0F1419]/5'
                        : 'border-rule hover:bg-ink/5',
                      isRequired && !isChecked && 'border-accent-red/40',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleDiag(d.value)}
                      className="mt-0.5 accent-foreground"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{d.label}</span>
                        {isRequired && (
                          <Badge variant="green" className="text-[10px]">
                            Obligatoire
                          </Badge>
                        )}
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
          {data.selected.size} diagnostic{data.selected.size > 1 ? 's' : ''} sélectionné
          {data.selected.size > 1 ? 's' : ''}.
        </p>
      </fieldset>

      {/* 3. Quota DPE */}
      {dpeQuota && <DpeQuotaWarning warning={dpeQuota} sticky />}

      {/* 4. Caractéristiques pour estimation durée */}
      <section className="space-y-2.5">
        <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute">
          Caractéristiques pour estimation durée
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Type de bien (granular)" htmlFor="schedulingPropertyType">
            <Select
              id="schedulingPropertyType"
              value={data.schedulingPropertyType}
              onChange={(e) =>
                patch({ schedulingPropertyType: e.target.value as SchedulingPropertyType })
              }
            >
              {SCHEDULING_PROPERTY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Régime de propriété" htmlFor="ownership">
            <Select
              id="ownership"
              value={data.ownership}
              onChange={(e) => patch({ ownership: e.target.value as SchedulingOwnership })}
            >
              {OWNERSHIP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="flex flex-wrap gap-4 text-[12px] text-ink">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.hasGarage}
              onChange={(e) => patch({ hasGarage: e.target.checked })}
              className="accent-foreground"
            />
            Garage
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.hasSousSol}
              onChange={(e) => patch({ hasSousSol: e.target.checked })}
              className="accent-foreground"
            />
            Sous-sol
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.hasComblesAmenagees}
              onChange={(e) => patch({ hasComblesAmenagees: e.target.checked })}
              className="accent-foreground"
            />
            Combles aménagées
          </label>
        </div>
      </section>

      {/* 5. Durée estimée */}
      <DurationEstimator
        estimate={estimate}
        loading={estimateLoading}
        forcedMinutes={data.forcedDurationMin}
        onForcedChange={(forced) => patch({ forcedDurationMin: forced })}
      />

      {/* 6. Date du RDV */}
      <section className="space-y-2.5">
        <label
          htmlFor="scheduledDate"
          className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute flex items-center gap-1.5"
        >
          <Phone className="size-3.5" /> Date du RDV <span className="text-accent-red">*</span>
        </label>
        <Input
          id="scheduledDate"
          type="date"
          value={data.scheduledDate}
          onChange={(e) =>
            patch({
              scheduledDate: e.target.value,
              scheduledTime: null,
              forcedOriginal: false,
            })
          }
        />
      </section>

      {/* 7. Slot selector */}
      {data.scheduledDate && effectiveDurationMin > 0 && (
        <SlotSelector
          date={data.scheduledDate}
          durationMin={effectiveDurationMin}
          selectedTime={data.scheduledTime}
          onSelect={(t) => patch({ scheduledTime: t, forcedOriginal: false })}
        />
      )}

      {/* 8. Conflit + alternatives */}
      {conflictResult?.hasConflict && (
        <ConflictWarning result={conflictResult} onForceOriginal={onForceOriginal} />
      )}

      {conflictResult?.hasConflict && (
        <AlternativeSuggestions
          alternatives={alternatives}
          loading={alternativesLoading}
          onAcceptAlternative={onAcceptAlternative}
        />
      )}

      {!conflictResult?.hasConflict && clusterOpportunity && (
        <ClusteringOpportunityCard opportunity={clusterOpportunity} />
      )}
    </div>
  )
}
