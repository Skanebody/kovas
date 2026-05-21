/**
 * Cancellation — Step 3 : Feedback obligatoire (50 chars min) + catégorie.
 *
 * Client component.
 *
 * Conforme décret 2023-417 + jurisprudence DGCCRF : on demande un feedback
 * raisonnable (50 chars, environ une phrase) pour qualifier le motif de churn.
 * On ne valide pas sémantiquement — 50 "a" suffisent à passer le contrôle, ce
 * qui garantit l'absence d'obstacle disproportionné à la résiliation.
 *
 * Bouton "Confirmer la résiliation" actif uniquement quand :
 *   - trim(feedback).length >= 50
 *   - category est choisie parmi les 6 valeurs valides
 */

'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

const FEEDBACK_MIN = 50

type FeedbackCategory =
  | 'too_expensive'
  | 'missing_features'
  | 'features_not_used'
  | 'better_competitor'
  | 'situation_change'
  | 'other'

const CATEGORIES: { value: FeedbackCategory; label: string; hint: string }[] = [
  { value: 'too_expensive', label: 'Trop cher', hint: 'Tarif au-delà de mon budget actuel' },
  {
    value: 'missing_features',
    label: 'Manque de fonctionnalités',
    hint: 'KOVAS ne couvre pas un besoin que j\'ai',
  },
  {
    value: 'features_not_used',
    label: 'Fonctionnalités non utilisées',
    hint: 'Je n\'exploite pas suffisamment l\'outil',
  },
  {
    value: 'better_competitor',
    label: 'Meilleur concurrent',
    hint: 'J\'ai trouvé un outil mieux adapté',
  },
  {
    value: 'situation_change',
    label: 'Changement de situation',
    hint: 'Arrêt d\'activité, retraite, etc.',
  },
  { value: 'other', label: 'Autre raison', hint: 'Précisez dans le commentaire' },
]

interface Step3Props {
  cancellationId: string
}

interface ConfirmResponse {
  ok: boolean
  effectiveEndDate?: string
  error?: string
}

export function CancellationStep3({ cancellationId }: Step3Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState('')
  const [category, setCategory] = useState<FeedbackCategory | null>(null)
  const [error, setError] = useState<string | null>(null)

  const trimmedLength = feedback.trim().length
  const canSubmit = trimmedLength >= FEEDBACK_MIN && category !== null && !isPending

  function submit() {
    if (!canSubmit) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/cancellation/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cancellationId,
            feedback: feedback.trim(),
            category,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as ConfirmResponse
        if (!res.ok || !data.ok) {
          setError(data.error ?? `Erreur (${res.status})`)
          return
        }
        router.push('/app/account/cancellation?step=4')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur réseau')
      }
    })
  }

  return (
    <Card variant="opaque" padding="lg" className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Aidez-nous à <span className="font-serif italic font-normal">comprendre</span>
        </h1>
        <p className="text-sm text-ink-mute">
          Votre retour nous est précieux pour améliorer KOVAS. Cela ne prendra que quelques
          secondes.
        </p>
      </header>

      {/* Catégorie */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
          Raison principale
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CATEGORIES.map((c) => {
            const selected = category === c.value
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={cn(
                  'rounded-md border text-left p-3 transition-colors',
                  selected
                    ? 'border-navy bg-navy/5'
                    : 'border-rule bg-paper hover:border-navy/40',
                )}
                aria-pressed={selected}
              >
                <div
                  className={cn(
                    'text-sm font-semibold',
                    selected ? 'text-navy' : 'text-ink',
                  )}
                >
                  {c.label}
                </div>
                <div className="text-[11px] text-ink-mute mt-0.5">{c.hint}</div>
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* Feedback */}
      <div className="space-y-2">
        <label
          htmlFor="cancellation-feedback"
          className="text-xs font-semibold uppercase tracking-wider text-ink-mute block"
        >
          Votre retour détaillé
        </label>
        <Textarea
          id="cancellation-feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Décrivez ce qui a manqué, ce qui pourrait être amélioré, ou la raison de votre départ…"
          rows={5}
          maxLength={2000}
          aria-describedby="cancellation-feedback-counter"
        />
        <div
          id="cancellation-feedback-counter"
          className={cn(
            'text-[11px] tabular-nums',
            trimmedLength >= FEEDBACK_MIN ? 'text-accent-green' : 'text-ink-mute',
          )}
          aria-live="polite"
        >
          {trimmedLength} / {FEEDBACK_MIN} caractères minimum
        </div>
      </div>

      {error && (
        <p className="text-xs text-accent-red bg-accent-red/5 border border-accent-red/20 rounded-md p-3">
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-rule">
        <Button asChild variant="ghost" size="lg" className="flex-1 text-ink-mute">
          <a href="/app/account">Annuler et garder mon abonnement</a>
        </Button>
        <Button
          type="button"
          variant="default"
          size="lg"
          className="flex-1"
          disabled={!canSubmit}
          onClick={submit}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          Confirmer la résiliation
        </Button>
      </div>

      <p className="text-[11px] text-ink-mute leading-relaxed">
        En confirmant, votre abonnement sera résilié à la fin de la période en cours.
        Aucune nouvelle facturation. Après expiration, votre compte bascule 90 jours en mode
        lecture et export complet conformément à notre politique RGPD.
      </p>
    </Card>
  )
}
