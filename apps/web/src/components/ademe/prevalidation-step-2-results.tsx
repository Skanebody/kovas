'use client'

import { ArrowLeft, ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { FieldHint } from './field-hint'

export type Etiquette = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export interface ResultsStepValues {
  type_energie_chauffage: string
  type_climatisation: string
  etiquette_dpe: Etiquette
  etiquette_ges: Etiquette
}

interface Step2Props {
  values: ResultsStepValues
  onChange: (patch: Partial<ResultsStepValues>) => void
  onBack: () => void
  onContinue: () => void
}

const LABEL_COLOR: Record<Etiquette, string> = {
  A: '#319B41',
  B: '#33A357',
  C: '#79BA52',
  D: '#FFCE34',
  E: '#F69D27',
  F: '#E94B1B',
  G: '#D90B0E',
}

const CHAUFFAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'electricite', label: 'Électricité' },
  { value: 'gaz', label: 'Gaz naturel' },
  { value: 'fioul', label: 'Fioul' },
  { value: 'bois', label: 'Bois / biomasse' },
  { value: 'pac_air_air', label: 'PAC air/air' },
  { value: 'pac_air_eau', label: 'PAC air/eau' },
  { value: 'reseau_chaleur', label: 'Réseau de chaleur' },
  { value: 'autre', label: 'Autre' },
]

const CLIMATISATION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'aucune', label: 'Aucune' },
  { value: 'split_mobile', label: 'Split mobile' },
  { value: 'split_fixe', label: 'Split fixe' },
  { value: 'pac_air_air', label: 'PAC air/air réversible' },
  { value: 'centralisee', label: 'Centralisée' },
]

/**
 * Step 2 — Résultats DPE prévus issus du calcul Liciel (ou autre).
 * 4 champs : énergie chauffage, climatisation, étiquette DPE, étiquette GES.
 */
export function PrevalidationStep2Results({
  values,
  onChange,
  onBack,
  onContinue,
}: Step2Props) {
  // Champs select textuels : pré-remplis donc toujours définis ; validation sur étiquettes.
  const canContinue =
    values.type_energie_chauffage.length > 0 &&
    values.type_climatisation.length > 0 &&
    values.etiquette_dpe !== undefined &&
    values.etiquette_ges !== undefined

  const showCalibrationWarning =
    values.etiquette_dpe === 'F' ||
    values.etiquette_dpe === 'G' ||
    values.etiquette_ges === 'F' ||
    values.etiquette_ges === 'G'

  return (
    <Card variant="opaque" padding="default" className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold text-ink">Résultats DPE prévus</h3>
        <p className="text-[11px] text-ink-mute">
          Étiquettes et équipements tels que vous comptez les publier sur l&apos;ADEME.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="Énergie principale de chauffage" required>
          <Select
            name="type_energie_chauffage"
            required
            value={values.type_energie_chauffage}
            onChange={(e) => onChange({ type_energie_chauffage: e.target.value })}
          >
            {CHAUFFAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <FieldHint tooltip="Indiquer l'énergie qui couvre le plus grand pourcentage des besoins de chauffage (méthode 3CL-2021).">
            Doit correspondre à ce que vous publierez sur l&apos;ADEME.
          </FieldHint>
        </FormField>

        <FormField label="Climatisation">
          <Select
            name="type_climatisation"
            value={values.type_climatisation}
            onChange={(e) => onChange({ type_climatisation: e.target.value })}
          >
            {CLIMATISATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <FieldHint>État réel du bien le jour de la visite.</FieldHint>
        </FormField>
      </div>

      <FormField label="Étiquette DPE proposée" required>
        <LabelRadioGroup
          name="etiquette_dpe"
          value={values.etiquette_dpe}
          onChange={(v) => onChange({ etiquette_dpe: v })}
        />
        <FieldHint tooltip="Pour les étiquettes F et G (passoires thermiques), le contrôle ADEME est plus strict — vérifier soigneusement la cohérence avec les factures et la méthode 3CL.">
          Selon votre méthode 3CL-2021 ou les factures réelles.
        </FieldHint>
      </FormField>

      <FormField label="Étiquette GES proposée" required>
        <LabelRadioGroup
          name="etiquette_ges"
          value={values.etiquette_ges}
          onChange={(v) => onChange({ etiquette_ges: v })}
        />
        <FieldHint>
          GES = émissions de gaz à effet de serre. Souvent corrélée à l&apos;énergie de chauffage.
        </FieldHint>
      </FormField>

      {showCalibrationWarning ? (
        <div className="rounded-md border border-amber/30 bg-amber/5 p-3 text-[12px] text-ink leading-relaxed">
          <strong className="font-semibold">Étiquette F ou G détectée.</strong> Le contrôle
          ADEME est plus strict sur les passoires thermiques (arrêté du 31 mars 2021). Pensez à
          vérifier la cohérence des consommations avec les factures réelles avant publication.
        </div>
      ) : null}

      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="lg" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Retour
        </Button>
        <Button
          type="button"
          variant="accent"
          size="lg"
          disabled={!canContinue}
          onClick={onContinue}
        >
          Continuer
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </Card>
  )
}

function LabelRadioGroup({
  name,
  value,
  onChange,
}: {
  name: string
  value: Etiquette
  onChange: (v: Etiquette) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {(['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const).map((label) => {
        const selected = value === label
        return (
          <label
            key={label}
            className={cn(
              'relative cursor-pointer rounded-md border-2 px-2 py-3 text-center transition-all',
              selected ? 'shadow-glass-sm scale-[1.02]' : 'border-rule hover:border-ink/30',
            )}
            style={selected ? { borderColor: LABEL_COLOR[label] } : undefined}
          >
            <input
              type="radio"
              name={name}
              value={label}
              checked={selected}
              onChange={() => onChange(label)}
              className="sr-only"
            />
            <span
              className="block font-serif italic text-2xl leading-none"
              style={{ color: LABEL_COLOR[label] }}
            >
              {label}
            </span>
          </label>
        )
      })}
    </div>
  )
}
