'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Camera, ListChecks, Mic, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'

const STORAGE_KEY = 'kovas_mission_tour_seen_v1'

interface TourStep {
  id: string
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  /** Microcopy CTA next */
  cta: string
}

const STEPS: TourStep[] = [
  {
    id: 'checklist',
    icon: ListChecks,
    title: 'La checklist guide tout',
    description:
      "Chaque diagnostic a sa liste de tâches obligatoires. Cochez au fur et à mesure — KOVAS bloque la validation finale tant que les obligatoires ne sont pas faites.",
    cta: 'Compris, montrer les photos',
  },
  {
    id: 'photos',
    icon: Camera,
    title: 'Photos taguées par pièce',
    description:
      "Tapez 'Photo' pour capturer directement depuis l'appareil. Le GPS et l'horodatage sont ajoutés automatiquement. Vous pouvez taguer la pièce après la capture.",
    cta: 'Compris, montrer la dictée',
  },
  {
    id: 'voice',
    icon: Mic,
    title: 'Saisie vocale par pièce',
    description:
      "Dictez vos observations — KOVAS transcrit avec Whisper et structure le texte. Plus rapide que la saisie clavier sur le terrain. Hors ligne, l'audio est gardé en local et synchronisé au retour réseau.",
    cta: 'C\'est parti',
  },
]

interface MissionTourProps {
  /** Force l'affichage même si seen (debug / replay depuis paramètres). */
  forceShow?: boolean
  /** Callback quand le tour est terminé ou skippé. */
  onComplete?: () => void
}

/**
 * MissionTour — overlay tour guidé 3 étapes au 1er lancement du mode mission.
 * CLAUDE.md §3 #5 (check-lists) + onboarding day 1 UX conversion essai→payant.
 *
 * Pattern : overlay sombre + card centrée avec icône hero + titre + microcopy +
 * indicateur progression dots + 2 CTAs (skip / next).
 *
 * Détection 1ère visite : localStorage `kovas_mission_tour_seen_v1`.
 * Une fois marqué seen, le tour ne réapparaît plus (sauf forceShow).
 */
export function MissionTour({ forceShow = false, onComplete }: MissionTourProps) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (forceShow) {
      setVisible(true)
      return
    }
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY) === '1'
      if (!seen) setVisible(true)
    } catch {
      // localStorage indisponible (incognito strict) — pas de tour
    }
  }, [forceShow])

  function markSeen() {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Ignore
    }
  }

  function handleNext() {
    if (step >= STEPS.length - 1) {
      markSeen()
      setVisible(false)
      onComplete?.()
      return
    }
    setStep(step + 1)
  }

  function handleSkip() {
    markSeen()
    setVisible(false)
    onComplete?.()
  }

  if (!visible) return null

  const current = STEPS[step]
  const Icon = current.icon

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-tour-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-md rounded-xl border border-rule bg-paper shadow-lg overflow-hidden">
        <div className="relative p-6 md:p-7">
          <button
            type="button"
            onClick={handleSkip}
            className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full hover:bg-ink/5 transition-colors"
            aria-label="Passer le tour"
          >
            <X className="size-4" />
          </button>

          {/* Icône hero circle */}
          <div className="flex justify-center mb-5">
            <div
              aria-hidden
              className="flex size-14 items-center justify-center rounded-full bg-cyan-light text-navy-900"
            >
              <Icon className="size-7" />
            </div>
          </div>

          {/* Titre serif italic */}
          <h2
            id="mission-tour-title"
            className="font-serif italic font-normal text-2xl md:text-3xl tracking-tight text-ink text-center mb-3 leading-tight"
          >
            {current.title}
          </h2>

          {/* Microcopy */}
          <p className="text-sm md:text-base text-ink-mute text-center max-w-sm mx-auto leading-relaxed mb-6">
            {current.description}
          </p>

          {/* Indicateur progression dots */}
          <div className="flex justify-center gap-1.5 mb-6" aria-label={`Étape ${step + 1} sur ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  'block h-1.5 rounded-full transition-all duration-base',
                  i === step ? 'w-6 bg-navy-800' : 'w-1.5 bg-rule',
                )}
              />
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-2">
            <Button onClick={handleNext} className="w-full justify-center" size="lg">
              {current.cta}
            </Button>
            {step < STEPS.length - 1 && (
              <Button onClick={handleSkip} variant="ghost" className="w-full justify-center">
                Passer
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Helper : reset le tour pour pouvoir le rejouer (à exposer depuis
 * /app/account/preferences ou un bouton "Revoir le tour").
 */
export function resetMissionTourSeen(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore
  }
}

/**
 * Helper : check si le tour a déjà été vu (pour conditionner l'affichage
 * d'un CTA "Revoir le tour" en paramètres).
 */
export function hasMissionTourBeenSeen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}
