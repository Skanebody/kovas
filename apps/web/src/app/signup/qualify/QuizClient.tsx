'use client'

/**
 * QuizClient — composant client du quiz qualification Tugan.
 *
 * 3 questions, state local, soumission → /signup/recommendation avec
 * les réponses encodées dans les searchParams (commitment progressif :
 * pas de DB / pas d'email collecté avant que le user voie son ROI).
 *
 * UX :
 *   - Une seule question à l'écran à la fois
 *   - Indicateur progression dots en haut (3 dots)
 *   - Bouton "Continuer" désactivé tant que la question n'a pas de réponse
 *   - Retour arrière possible (← / Précédent)
 *   - Animation fade smooth entre questions (CSS transition)
 *
 * Authority : docs Tugan §6 Étape 2.
 */

import { Button } from '@/components/ui/button'
import {
  type CurrentEditor,
  type QuizAnswers,
  type TeamSizeBand,
  encodeQuizAnswersToSearchParams,
} from '@/lib/signup/qualify-recommend'
import { ArrowLeft, ArrowRight, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface TeamOption {
  value: TeamSizeBand
  label: string
  hint: string
}

const TEAM_OPTIONS: ReadonlyArray<TeamOption> = [
  { value: 'solo', label: 'Solo', hint: '1 personne' },
  { value: 'small_cabinet', label: 'Petit cabinet', hint: '2 à 5 personnes' },
  { value: 'structured_cabinet', label: 'Cabinet structuré', hint: '6 à 15 personnes' },
  { value: 'network', label: 'Franchise ou réseau', hint: '15+ personnes' },
]

interface EditorOption {
  value: CurrentEditor
  label: string
}

const EDITOR_OPTIONS: ReadonlyArray<EditorOption> = [
  { value: 'liciel', label: 'Liciel' },
  { value: 'obbc', label: 'OBBC' },
  { value: 'analysimmo', label: 'AnalysImmo' },
  { value: 'other', label: 'Un autre éditeur' },
  { value: 'none', label: 'Aucun (je démarre)' },
]

export function QuizClient(): React.ReactElement {
  const router = useRouter()
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [teamSize, setTeamSize] = useState<TeamSizeBand | null>(null)
  const [monthlyMissions, setMonthlyMissions] = useState<number>(30)
  const [currentEditor, setCurrentEditor] = useState<CurrentEditor | null>(null)

  const canContinue =
    (step === 0 && teamSize !== null) ||
    (step === 1 && monthlyMissions > 0) ||
    (step === 2 && currentEditor !== null)

  function goNext() {
    if (step < 2) {
      setStep((step + 1) as 0 | 1 | 2)
      return
    }
    // Step 2 = dernière question, on submit
    if (teamSize === null || currentEditor === null) return
    const answers: QuizAnswers = { teamSize, monthlyMissions, currentEditor }
    const qs = encodeQuizAnswersToSearchParams(answers)
    router.push(`/signup/recommendation?${qs}`)
  }

  function goBack() {
    if (step === 0) return
    setStep((step - 1) as 0 | 1 | 2)
  }

  return (
    <div className="space-y-10 animate-fade-in motion-reduce:animate-none">
      {/* Logo + intro */}
      <div className="text-center space-y-3">
        <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-[#0F1419]/55">
          K · O · V · A · S
        </p>
        <h1
          className="font-sans font-medium tracking-tight text-[#0F1419] leading-tight"
          style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}
        >
          En 3 questions, on identifie le{' '}
          <span className="font-serif italic font-normal">plan parfait</span> pour toi.
        </h1>
      </div>

      {/* Indicateur progression dots */}
      <div className="flex justify-center gap-2" aria-label={`Question ${step + 1} sur 3`}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={[
              'block h-1.5 rounded-full transition-all duration-300',
              i === step ? 'w-8 bg-[#0F1419]' : 'w-1.5 bg-[#0F1419]/20',
            ].join(' ')}
          />
        ))}
      </div>

      {/* Step 0 — Taille équipe */}
      {step === 0 && (
        <fieldset className="space-y-4">
          <legend className="text-[18px] font-semibold text-[#0F1419] leading-tight">
            Tu es&hellip;
          </legend>
          <div className="space-y-2">
            {TEAM_OPTIONS.map((opt) => {
              const active = teamSize === opt.value
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setTeamSize(opt.value)}
                  className={[
                    'w-full flex items-center justify-between gap-3 rounded-xl border px-5 py-4 text-left transition-all',
                    active
                      ? 'border-[#0F1419] bg-[#0F1419] text-paper'
                      : 'border-[#0F1419]/[0.12] bg-paper text-[#0F1419] hover:border-[#0F1419]/40',
                  ].join(' ')}
                  aria-pressed={active}
                >
                  <div>
                    <p className="font-medium text-[15px]">{opt.label}</p>
                    <p
                      className={[
                        'text-[12px]',
                        active ? 'text-paper/72' : 'text-[#0F1419]/55',
                      ].join(' ')}
                    >
                      {opt.hint}
                    </p>
                  </div>
                  <Users className="size-4 shrink-0 opacity-50" aria-hidden />
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      {/* Step 1 — Volume mensuel */}
      {step === 1 && (
        <fieldset className="space-y-6">
          <legend className="text-[18px] font-semibold text-[#0F1419] leading-tight">
            Combien de missions tu fais par mois&nbsp;?
          </legend>
          <div className="rounded-xl border border-[#0F1419]/[0.08] bg-paper p-6 space-y-5">
            <div className="text-center">
              <div
                className="font-serif italic font-normal text-[#0F1419] leading-none"
                style={{ fontSize: 'clamp(56px, 8vw, 88px)' }}
              >
                {monthlyMissions}
              </div>
              <p className="font-mono text-[12px] uppercase tracking-wider text-[#0F1419]/55 mt-2">
                missions / mois
              </p>
            </div>
            <input
              type="range"
              min={5}
              max={500}
              step={5}
              value={monthlyMissions}
              onChange={(e) => setMonthlyMissions(Number(e.target.value))}
              aria-label="Nombre de missions par mois"
              className="w-full accent-[#0F1419] cursor-pointer"
            />
            <div className="flex justify-between font-mono text-[11px] text-[#0F1419]/55">
              <span>5</span>
              <span>500</span>
            </div>
            <p className="text-[12px] text-[#0F1419]/55 text-center leading-relaxed">
              Approximation suffisante. On affinera après si besoin.
            </p>
          </div>
        </fieldset>
      )}

      {/* Step 2 — Éditeur actuel */}
      {step === 2 && (
        <fieldset className="space-y-4">
          <legend className="text-[18px] font-semibold text-[#0F1419] leading-tight">
            Tu utilises quel logiciel principal aujourd&apos;hui&nbsp;?
          </legend>
          <p className="text-[13px] text-[#0F1419]/72 leading-relaxed">
            KOVAS s&apos;installe en couche au-dessus de ton logiciel certifié actuel pour la
            capture terrain et la pré-vérification ADEME. Il ne le remplace pas.
          </p>
          <div className="space-y-2">
            {EDITOR_OPTIONS.map((opt) => {
              const active = currentEditor === opt.value
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setCurrentEditor(opt.value)}
                  className={[
                    'w-full rounded-xl border px-5 py-4 text-left transition-all font-medium text-[15px]',
                    active
                      ? 'border-[#0F1419] bg-[#0F1419] text-paper'
                      : 'border-[#0F1419]/[0.12] bg-paper text-[#0F1419] hover:border-[#0F1419]/40',
                  ].join(' ')}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      {/* Footer navigation */}
      <div className="flex items-center gap-3 pt-4">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={goBack}
            aria-label="Question précédente"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Précédent
          </Button>
        )}
        <Button
          type="button"
          variant="accent"
          size="lg"
          onClick={goNext}
          disabled={!canContinue}
          className="flex-1 justify-center"
        >
          {step < 2 ? 'Continuer' : 'Voir ma recommandation'}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>

      <p className="text-center font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/40">
        Aucun email demandé à cette étape · 30 secondes
      </p>
    </div>
  )
}
