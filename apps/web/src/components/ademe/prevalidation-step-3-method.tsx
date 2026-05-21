'use client'

import { ArrowLeft, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import type { Etiquette } from './prevalidation-step-2-results'
import { FieldHint } from './field-hint'

export type DpeMethod = '3CL-2021' | 'factures'

export interface MethodStepValues {
  conso_5_usages_par_m2_ep: number | null
  methode: DpeMethod
}

interface RecapData {
  addressLabel: string
  typeBatiment: string
  surface: number | null
  annee: number | null
  etiquetteDpe: Etiquette
  etiquetteGes: Etiquette
}

interface Step3Props {
  values: MethodStepValues
  recap: RecapData
  onChange: (patch: Partial<MethodStepValues>) => void
  onBack: () => void
  onEditStep2: () => void
  onSubmit: () => void
  submitting: boolean
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

const BATIMENT_LABELS: Record<string, string> = {
  maison: 'Maison',
  appartement: 'Appartement',
  immeuble: 'Immeuble',
}

/**
 * Step 3 — Cohérence terrain + méthode + récap + bouton "Évaluer".
 * 2 champs : consommation 5 usages (kWh/m²/an), méthode de calcul.
 */
export function PrevalidationStep3Method({
  values,
  recap,
  onChange,
  onBack,
  onEditStep2,
  onSubmit,
  submitting,
}: Step3Props) {
  const canSubmit =
    values.conso_5_usages_par_m2_ep !== null &&
    values.conso_5_usages_par_m2_ep > 0 &&
    values.methode !== undefined

  return (
    <div className="space-y-5">
      <Card variant="opaque" padding="default" className="space-y-6">
        <div className="space-y-1">
          <h3 className="text-[15px] font-semibold text-ink">Cohérence terrain & méthode</h3>
          <p className="text-[11px] text-ink-mute">
            Dernières données nécessaires au scoring de risque ADEME.
          </p>
        </div>

        <FormField label="Consommation 5 usages (kWh/m²/an)" required>
          <Input
            name="conso_5_usages_par_m2_ep"
            type="number"
            min={0}
            max={1000}
            step="0.1"
            required
            value={values.conso_5_usages_par_m2_ep ?? ''}
            onChange={(e) =>
              onChange({
                conso_5_usages_par_m2_ep: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            placeholder="250"
          />
          <FieldHint tooltip="Cep (consommation d'énergie primaire 5 usages) : chauffage + ECS + refroidissement + auxiliaires + éclairage. Valeur affichée par votre logiciel de calcul.">
            Énergie primaire — visible sur votre logiciel de calcul.
          </FieldHint>
        </FormField>

        <FormField label="Méthode utilisée" required>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <MethodRadio
              value="3CL-2021"
              label="3CL-2021"
              caption="Méthode conventionnelle (logements résidentiels)"
              checked={values.methode === '3CL-2021'}
              onChange={() => onChange({ methode: '3CL-2021' })}
            />
            <MethodRadio
              value="factures"
              label="Factures réelles"
              caption="Tertiaire ou cas particuliers"
              checked={values.methode === 'factures'}
              onChange={() => onChange({ methode: 'factures' })}
            />
          </div>
          <FieldHint tooltip="Depuis l'arrêté du 31 mars 2021, la méthode 3CL est obligatoire pour les logements résidentiels neufs et existants. La méthode factures reste réservée aux cas spécifiques (tertiaire, logements impossibles à modéliser).">
            La méthode 3CL est obligatoire pour la majorité des logements résidentiels.
          </FieldHint>
        </FormField>
      </Card>

      {/* Récap visuel des étapes 1 + 2 */}
      <Card variant="opaque" padding="default" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-ink">Récapitulatif</h3>
          <button
            type="button"
            onClick={onEditStep2}
            className="text-[11px] font-medium text-ink-mute hover:text-ink underline-offset-2 hover:underline"
          >
            ← Modifier
          </button>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-[12px]">
          <div>
            <dt className="font-mono uppercase tracking-[0.08em] text-[10px] text-ink-faint">
              Adresse
            </dt>
            <dd className="mt-0.5 text-ink leading-snug">
              {recap.addressLabel || <span className="italic text-ink-faint">non saisie</span>}
            </dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-[0.08em] text-[10px] text-ink-faint">
              Type
            </dt>
            <dd className="mt-0.5 text-ink">
              {BATIMENT_LABELS[recap.typeBatiment] ?? recap.typeBatiment} ·{' '}
              {recap.surface !== null ? `${recap.surface} m²` : '—'} ·{' '}
              {recap.annee !== null ? recap.annee : '—'}
            </dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-[0.08em] text-[10px] text-ink-faint">
              Étiquette DPE
            </dt>
            <dd className="mt-0.5">
              <span
                className="inline-flex items-center justify-center rounded-sm px-2 py-0.5 font-serif italic text-base leading-none"
                style={{
                  color: LABEL_COLOR[recap.etiquetteDpe],
                  border: `1.5px solid ${LABEL_COLOR[recap.etiquetteDpe]}`,
                }}
              >
                {recap.etiquetteDpe}
              </span>
            </dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-[0.08em] text-[10px] text-ink-faint">
              Étiquette GES
            </dt>
            <dd className="mt-0.5">
              <span
                className="inline-flex items-center justify-center rounded-sm px-2 py-0.5 font-serif italic text-base leading-none"
                style={{
                  color: LABEL_COLOR[recap.etiquetteGes],
                  border: `1.5px solid ${LABEL_COLOR[recap.etiquetteGes]}`,
                }}
              >
                {recap.etiquetteGes}
              </span>
            </dd>
          </div>
        </dl>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={onBack}
          disabled={submitting}
        >
          <ArrowLeft className="size-4" />
          Retour
        </Button>
        <Button
          type="button"
          variant="accent"
          size="lg"
          disabled={!canSubmit || submitting}
          onClick={onSubmit}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Évaluation en cours…
            </>
          ) : (
            'Évaluer le risque ADEME'
          )}
        </Button>
      </div>
    </div>
  )
}

function MethodRadio({
  value,
  label,
  caption,
  checked,
  onChange,
}: {
  value: string
  label: string
  caption: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label
      className={cn(
        'cursor-pointer rounded-md border-2 px-3.5 py-3 transition-all',
        checked
          ? 'border-navy bg-navy/5 shadow-glass-sm'
          : 'border-rule bg-paper hover:border-ink/30',
      )}
    >
      <input
        type="radio"
        name="methode"
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className={cn(
            'mt-0.5 size-3.5 shrink-0 rounded-full border-2 transition-all',
            checked ? 'border-navy bg-navy' : 'border-ink-mute bg-transparent',
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-ink leading-tight">{label}</div>
          <div className="text-[11px] text-ink-mute mt-0.5 leading-snug">{caption}</div>
        </div>
      </div>
    </label>
  )
}
