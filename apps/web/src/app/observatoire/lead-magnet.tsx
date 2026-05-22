'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { requestObservatoireReport } from './actions'

/**
 * Section 7 — Lead Magnet PDF.
 *
 * Bouton chartreuse (variant accent) → ouvre un formulaire inline (pas de modal
 * pour éviter une dépendance Dialog supplémentaire et rester accessible
 * keyboard-first). Email + opt-in newsletter.
 *
 * Server Action `requestObservatoireReport` :
 * - Valid Zod (gérée côté serveur)
 * - Insert/upsert dans `observatoire_subscribers`
 * - Génère le PDF via jsPDF
 * - Envoie via Resend HTTP (pièce jointe)
 * - Renvoie message localisé fr (success/error)
 *
 * Tracking PostHog `observatoire.report.requested` côté client (PostHog est
 * browser-only — c'est volontaire pour éviter les appels serveur).
 */
export function LeadMagnet({ editionLabel }: { editionLabel: string }) {
  const [expanded, setExpanded] = useState(false)
  const [email, setEmail] = useState('')
  const [optIn, setOptIn] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setResult(null)
    try {
      const res = await requestObservatoireReport({ email, newsletterOptIn: optIn })
      setResult(res)
      if (res.success && typeof window !== 'undefined') {
        // PostHog est browser-only — import dynamique pour ne pas casser SSR
        try {
          const mod = await import('posthog-js')
          const ph = (mod as { default?: { capture?: (event: string, props?: Record<string, unknown>) => void } }).default
          if (ph?.capture) {
            ph.capture('observatoire.report.requested', {
              edition: editionLabel,
              newsletter_opt_in: optIn,
            })
          }
        } catch {
          // posthog non initialisé en dev — silencieux
        }
        // Reset form après succès
        setEmail('')
      }
    } catch (err) {
      setResult({
        success: false,
        message:
          err instanceof Error
            ? err.message
            : "Une erreur est survenue, merci de réessayer dans un instant.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card variant="accent" padding="lg" className="relative">
      <div className="flex flex-col gap-6 max-w-[640px]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-chartreuse font-medium">
          Rapport mensuel — Édition {editionLabel}
        </p>
        <h2 className="font-sans text-[32px] sm:text-[44px] font-semibold leading-[1.05] tracking-[-0.02em] text-paper">
          Téléchargez l’<span className="font-serif italic font-normal text-chartreuse">intégralité</span> des données en PDF.
        </h2>
        <p className="text-[15px] sm:text-[17px] text-paper/80 leading-relaxed">
          6 à 8 pages d’analyse synthétique&nbsp;: prix médians par région, distribution énergétique
          complète, classement des villes en transition, méthodologie détaillée. Licence CC BY 4.0,
          libre de citation.
        </p>

        {!expanded ? (
          <div>
            <Button
              variant="accent"
              size="lg"
              onClick={() => setExpanded(true)}
              type="button"
            >
              Recevoir le rapport mensuel (PDF)
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="observatoire-email"
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-paper/70 font-medium"
              >
                Votre adresse email professionnelle
              </label>
              <Input
                id="observatoire-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.fr"
                className="bg-paper text-ink h-12 text-base"
                disabled={submitting}
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
                className="mt-1 size-4 rounded border-paper/40 bg-paper/10 text-chartreuse focus:ring-chartreuse"
                disabled={submitting}
              />
              <span className="text-[13px] text-paper/80 leading-snug">
                Je souhaite recevoir automatiquement les prochaines éditions mensuelles (un email
                par mois maximum, désinscription possible à tout moment).
              </span>
            </label>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <Button type="submit" variant="accent" size="lg" disabled={submitting}>
                {submitting ? 'Envoi en cours…' : 'Envoyer le rapport'}
              </Button>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="text-[13px] text-paper/70 hover:text-paper underline-offset-4 hover:underline"
                disabled={submitting}
              >
                Annuler
              </button>
            </div>

            {result ? (
              <p
                className={`text-[13px] leading-snug rounded-md px-3 py-2 ${
                  result.success
                    ? 'bg-chartreuse-soft/15 text-chartreuse-soft'
                    : 'bg-status-coral/15 text-status-coral'
                }`}
                role="status"
                aria-live="polite"
              >
                {result.message}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </Card>
  )
}
