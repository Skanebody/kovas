'use client'

/**
 * KOVAS — Calculateur DPE gratuit (Lot #143)
 *
 * Client Component principal :
 *  - Orchestre le stepper 8 questions
 *  - Sauvegarde localStorage (`kovas.dpe-calculator.draft`, TTL 24h)
 *  - Affiche progress bar + transition fade 200ms entre étapes
 *  - Loader 800ms avant affichage du résultat (effet "calcul")
 *  - Renvoie vers la ResultCard puis LeadForm
 *
 * Pas d'appel API tant que le LeadForm n'est pas soumis — l'estimation est
 * 100% client-side (transparent, RGPD-friendly).
 */

import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  areAllAnswersComplete,
  createEmptyAnswers,
  isAnswerComplete,
  QUESTION_ORDER,
  TOTAL_QUESTIONS,
  type CalculatorAnswers,
  type QuestionKey,
} from '@/lib/dpe-calculator/question-tree'
import { estimateEnergyClass } from '@/lib/dpe-calculator/estimation-engine'

import { LeadForm } from './lead-form'
import { QuestionStep } from './question-step'
import { ResultCard } from './result-card'

const DRAFT_STORAGE_KEY = 'kovas.dpe-calculator.draft'
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

interface DraftEnvelope {
  answers: CalculatorAnswers
  step: number
  savedAt: number
}

type Phase = 'stepper' | 'computing' | 'result' | 'lead' | 'success'

interface CalculatorClientProps {
  /** Ville détectée via header `x-vercel-ip-city` (peut être null). */
  detectedCity: string | null
  /** Code département détecté (2 premiers chiffres CP / dérivé IP). */
  detectedDepartment: string | null
}

export function CalculatorClient({
  detectedCity,
  detectedDepartment,
}: CalculatorClientProps) {
  const [answers, setAnswers] = useState<CalculatorAnswers>(() => createEmptyAnswers())
  const [stepIndex, setStepIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('stepper')
  const [transitionKey, setTransitionKey] = useState(0)
  const computingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 1. Restore draft on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
      if (!raw) return
      const env = JSON.parse(raw) as DraftEnvelope
      if (!env.savedAt || Date.now() - env.savedAt > DRAFT_TTL_MS) {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY)
        return
      }
      if (env.answers) setAnswers(env.answers)
      if (typeof env.step === 'number' && env.step >= 0 && env.step < TOTAL_QUESTIONS) {
        setStepIndex(env.step)
      }
    } catch {
      // Ignore — start fresh
    }
  }, [])

  // 2. Persist draft on change
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (phase !== 'stepper') return
    try {
      const env: DraftEnvelope = {
        answers,
        step: stepIndex,
        savedAt: Date.now(),
      }
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(env))
    } catch {
      // localStorage indisponible (private mode / quota) → silent
    }
  }, [answers, stepIndex, phase])

  // 3. Clean draft when finished
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (phase === 'success') {
      try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY)
      } catch {
        /* noop */
      }
    }
  }, [phase])

  const currentKey: QuestionKey = QUESTION_ORDER[stepIndex] ?? 'property_type'
  const canAdvance = isAnswerComplete(currentKey, answers)
  const progressPercent = useMemo(() => {
    if (phase === 'success') return 100
    if (phase === 'result' || phase === 'lead') return 100
    if (phase === 'computing') return 100
    return Math.round(((stepIndex + (canAdvance ? 1 : 0)) / TOTAL_QUESTIONS) * 100)
  }, [stepIndex, canAdvance, phase])

  const estimation = useMemo(() => {
    if (!areAllAnswersComplete(answers)) return null
    return estimateEnergyClass(answers)
  }, [answers])

  const onPatch = useCallback((patch: Partial<CalculatorAnswers>) => {
    setAnswers((prev) => ({ ...prev, ...patch }))
  }, [])

  const goNext = useCallback(() => {
    if (!canAdvance) return
    if (stepIndex < TOTAL_QUESTIONS - 1) {
      setStepIndex((s) => s + 1)
      setTransitionKey((k) => k + 1)
      return
    }
    // Dernière étape — passe en "computing" 800ms
    setPhase('computing')
    if (computingTimerRef.current) clearTimeout(computingTimerRef.current)
    computingTimerRef.current = setTimeout(() => setPhase('result'), 800)
  }, [canAdvance, stepIndex])

  const goPrevious = useCallback(() => {
    if (phase === 'lead') {
      setPhase('result')
      return
    }
    if (phase === 'result') {
      setPhase('stepper')
      setStepIndex(TOTAL_QUESTIONS - 1)
      return
    }
    if (stepIndex > 0) {
      setStepIndex((s) => s - 1)
      setTransitionKey((k) => k + 1)
    }
  }, [phase, stepIndex])

  // 4. Clavier : Enter = next, Esc = previous
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase !== 'stepper') return
      const target = e.target as HTMLElement | null
      // Ne pas intercepter dans un textarea (et input number conserve Enter)
      if (target?.tagName === 'TEXTAREA') return
      if (e.key === 'Enter' && canAdvance) {
        e.preventDefault()
        goNext()
      } else if (e.key === 'Escape' && stepIndex > 0) {
        e.preventDefault()
        goPrevious()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canAdvance, phase, stepIndex, goNext, goPrevious])

  // 5. Cleanup
  useEffect(
    () => () => {
      if (computingTimerRef.current) clearTimeout(computingTimerRef.current)
    },
    [],
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-12">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wide text-ink-mute">
          <span>
            Question {Math.min(stepIndex + 1, TOTAL_QUESTIONS)} sur {TOTAL_QUESTIONS}
          </span>
          <span>{progressPercent}%</span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-rule/60">
          <div
            className="h-full rounded-full bg-chartreuse-deep transition-[width] duration-base ease-spring"
            style={{ width: `${progressPercent}%` }}
            aria-hidden
          />
        </div>
      </div>

      <main
        className="rounded-xl border border-border bg-paper p-6 shadow-glass-sm sm:p-9"
        aria-live="polite"
      >
        {phase === 'stepper' ? (
          <div key={transitionKey} className="animate-in fade-in duration-200">
            <QuestionStep
              questionKey={currentKey}
              answers={answers}
              onChange={onPatch}
            />

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={goPrevious}
                disabled={stepIndex === 0}
              >
                <ArrowLeft className="size-4" />
                Précédent
              </Button>

              <Button
                type="button"
                variant="accent"
                size="default"
                onClick={goNext}
                disabled={!canAdvance}
              >
                {stepIndex === TOTAL_QUESTIONS - 1 ? 'Voir mon estimation' : 'Suivant'}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {phase === 'computing' ? (
          <div
            className="flex min-h-[280px] flex-col items-center justify-center gap-4 animate-in fade-in duration-200"
            role="status"
          >
            <Loader2 className="size-8 animate-spin text-chartreuse-deep" />
            <div className="text-center">
              <p className="font-display text-[18px] font-semibold text-ink">
                Calcul de votre estimation
              </p>
              <p className="mt-1 text-[13px] text-ink-mute">
                Analyse des 8 facteurs énergétiques.
              </p>
            </div>
          </div>
        ) : null}

        {phase === 'result' && estimation ? (
          <div className="animate-in fade-in duration-200">
            <ResultCard
              estimation={estimation}
              answers={answers}
              detectedCity={detectedCity}
              detectedDepartment={detectedDepartment}
              onRequestLeadForm={() => setPhase('lead')}
              onBack={goPrevious}
            />
          </div>
        ) : null}

        {phase === 'lead' && estimation ? (
          <div className="animate-in fade-in duration-200">
            <LeadForm
              answers={answers}
              detectedCity={detectedCity}
              detectedPostalCode={null}
              estimatedClass={estimation.estimatedClass}
              onCancel={() => setPhase('result')}
              onSuccess={() => setPhase('success')}
            />
          </div>
        ) : null}

        {phase === 'success' ? (
          <SuccessPanel detectedCity={detectedCity} />
        ) : null}
      </main>

      {/* Note de bas de page */}
      {phase === 'stepper' ? (
        <p className="mx-auto mt-5 max-w-md text-center text-[12px] leading-relaxed text-ink-mute">
          Estimation indicative — ne remplace pas un DPE officiel établi par un
          diagnostiqueur certifié.
        </p>
      ) : null}
    </div>
  )
}

function SuccessPanel({ detectedCity }: { detectedCity: string | null }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center animate-in fade-in duration-200">
      <div className="flex size-14 items-center justify-center rounded-full bg-chartreuse">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-ink"
          aria-hidden
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div>
        <h2 className="font-display text-[22px] font-bold text-ink">
          Votre demande est enregistrée
        </h2>
        <p className="mt-2 max-w-md text-[14px] leading-relaxed text-ink-mute">
          Vous allez recevoir votre estimation détaillée par email
          {detectedCity ? ` ainsi qu’une mise en relation avec des diagnostiqueurs certifiés à proximité de ${detectedCity}` : ' ainsi qu’une mise en relation avec des diagnostiqueurs certifiés près de chez vous'}
          . Réponse sous 24 à 48 heures ouvrées.
        </p>
      </div>
    </div>
  )
}
