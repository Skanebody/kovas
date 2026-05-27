'use client'

/**
 * KOVAS — Formulaire de pré-validation DPE (wizard 3 étapes).
 *
 * Architecture :
 *   PrevalidationProgress (3 dots numérotés)
 *   ├── Step 1 — Le bien (4 champs)
 *   │     adresse BAN, type bâtiment (radio chips), année, surface
 *   ├── Step 2 — Résultats DPE prévus (4 champs)
 *   │     énergie chauffage, climatisation, étiquette DPE, étiquette GES
 *   └── Step 3 — Cohérence terrain (2 champs + récap + bouton Évaluer)
 *         conso 5 usages, méthode 3CL/factures
 *
 * Soumet à POST /api/ademe/prevalidate à la fin de l'étape 3 →
 * affiche <PrevalidationResult> avec verdict + détails.
 *
 * État géré par useState parent (pas de form HTML — chaque step contrôle
 * ses inputs et appelle onChange). Animation slide-in-from-right entre
 * étapes via tailwindcss-animate.
 */

import { useState } from 'react'

import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'

import { PrevalidationResult, type RiskVerdict } from './PrevalidationResult'
import { PrevalidationProgress } from './prevalidation-progress'
import {
  type BuildingType,
  PrevalidationStep1Property,
  type PropertyStepValues,
} from './prevalidation-step-1-property'
import {
  type Etiquette,
  PrevalidationStep2Results,
  type ResultsStepValues,
} from './prevalidation-step-2-results'
import {
  type DpeMethod,
  type MethodStepValues,
  PrevalidationStep3Method,
} from './prevalidation-step-3-method'

interface ApiResponse {
  prevalidationId: string | null
  verdict: RiskVerdict
  globalScore: number
  axisScores: {
    volume: number
    distance: number
    coherence: number
    statistical: number
    history: number
  }
  warnings: Array<{
    axis: string
    severity: 'info' | 'warning' | 'error' | 'blocking'
    code: string
    message: string
    suggested_fix?: string
  }>
}

/**
 * Valeurs initiales optionnelles pour pré-remplir le formulaire depuis un
 * dossier existant (cas d'usage : `/dashboard/dossiers/[id]/prevalidation` qui
 * charge les données déjà saisies sur le dossier).
 */
export interface PrevalidationInitialValues {
  address?: { label: string; latitude?: number; longitude?: number }
  type_batiment?: BuildingType
  annee_construction?: number
  surface_habitable_m2?: number
  type_energie_chauffage?: string
  type_climatisation?: string
  etiquette_dpe?: Etiquette
  etiquette_ges?: Etiquette
  conso_5_usages_par_m2_ep?: number
  /** Référence dossier source pour audit + redirect post-evaluation. */
  source_dossier_id?: string
}

interface PrevalidationFormProps {
  initialValues?: PrevalidationInitialValues
}

type StepNum = 1 | 2 | 3

export function PrevalidationForm({ initialValues }: PrevalidationFormProps = {}) {
  const [step, setStep] = useState<StepNum>(1)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ApiResponse | null>(null)

  // Step 1 — Le bien
  const [property, setProperty] = useState<PropertyStepValues>({
    address: initialValues?.address
      ? {
          label: initialValues.address.label,
          latitude: initialValues.address.latitude,
          longitude: initialValues.address.longitude,
        }
      : null,
    type_batiment: initialValues?.type_batiment ?? 'maison',
    annee_construction: initialValues?.annee_construction ?? null,
    surface_habitable_m2: initialValues?.surface_habitable_m2 ?? null,
  })

  // Step 2 — DPE prévu
  const [results, setResults] = useState<ResultsStepValues>({
    type_energie_chauffage: initialValues?.type_energie_chauffage ?? 'gaz',
    type_climatisation: initialValues?.type_climatisation ?? 'aucune',
    etiquette_dpe: initialValues?.etiquette_dpe ?? 'D',
    etiquette_ges: initialValues?.etiquette_ges ?? 'D',
  })

  // Step 3 — Cohérence
  const [method, setMethod] = useState<MethodStepValues>({
    conso_5_usages_par_m2_ep: initialValues?.conso_5_usages_par_m2_ep ?? null,
    methode: '3CL-2021' satisfies DpeMethod,
  })

  function patchProperty(patch: Partial<PropertyStepValues>) {
    setProperty((p) => ({ ...p, ...patch }))
  }
  function patchResults(patch: Partial<ResultsStepValues>) {
    setResults((r) => ({ ...r, ...patch }))
  }
  function patchMethod(patch: Partial<MethodStepValues>) {
    setMethod((m) => ({ ...m, ...patch }))
  }

  async function handleSubmit() {
    const addr = property.address
    const payload = {
      type_batiment: property.type_batiment,
      annee_construction: property.annee_construction ?? 0,
      surface_habitable_m2: property.surface_habitable_m2 ?? 0,
      type_energie_chauffage: results.type_energie_chauffage,
      type_climatisation: results.type_climatisation,
      etiquette_dpe: results.etiquette_dpe,
      etiquette_ges: results.etiquette_ges,
      conso_5_usages_par_m2_ep: method.conso_5_usages_par_m2_ep ?? 0,
      methode: method.methode,
      latitude: addr?.latitude,
      longitude: addr?.longitude,
      address_label: addr?.label,
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/ademe/prevalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const json = (await res.json()) as ApiResponse
      setResult(json)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Pré-validation impossible')
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setResult(null)
    setStep(1)
  }

  if (result) {
    return (
      <PrevalidationResult
        prevalidationId={result.prevalidationId}
        verdict={result.verdict}
        globalScore={result.globalScore}
        axisScores={result.axisScores}
        warnings={result.warnings}
        onReset={handleReset}
      />
    )
  }

  return (
    <div className="space-y-2">
      <PrevalidationProgress current={step} />

      <div className="relative">
        {step === 1 ? (
          <div
            key="step-1"
            className={cn('animate-in fade-in-0 slide-in-from-right-2 duration-300')}
          >
            <PrevalidationStep1Property
              values={property}
              onChange={patchProperty}
              onContinue={() => setStep(2)}
              initialAddressLabel={initialValues?.address?.label}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div
            key="step-2"
            className={cn('animate-in fade-in-0 slide-in-from-right-2 duration-300')}
          >
            <PrevalidationStep2Results
              values={results}
              onChange={patchResults}
              onBack={() => setStep(1)}
              onContinue={() => setStep(3)}
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div
            key="step-3"
            className={cn('animate-in fade-in-0 slide-in-from-right-2 duration-300')}
          >
            <PrevalidationStep3Method
              values={method}
              recap={{
                addressLabel: property.address?.label ?? '',
                typeBatiment: property.type_batiment,
                surface: property.surface_habitable_m2,
                annee: property.annee_construction,
                etiquetteDpe: results.etiquette_dpe,
                etiquetteGes: results.etiquette_ges,
              }}
              onChange={patchMethod}
              onBack={() => setStep(2)}
              onEditStep2={() => setStep(2)}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
