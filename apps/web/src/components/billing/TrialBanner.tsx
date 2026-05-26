'use client'

import { cn } from '@/lib/utils'
import { Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface TrialBannerProps {
  /** ISO 8601, fin d'essai = début du débit auto */
  trialEndsAt: string
  /** Prix mensuel HT en centimes (issu de stripe-config tier courant) */
  monthlyPriceCents: number
  /** Label du tier en cours (Solo / Pro / Cabinet / Cabinet+) — pour le tooltip */
  tierLabel: string
}

const SESSION_KEY = 'kovas_trial_banner_dismissed'

/**
 * Bannière essai 30j affichée en haut du dashboard tant que l'essai est actif.
 *
 * Wireframe :
 *   [ESSAI · 12 jours restants · Prélèvement de 79€ le 21 juin] [Voir l'abonnement] [X]
 *
 * - Dismissible session-only (réapparaît à la prochaine session)
 * - Couleur sage info en background, label mono pour "ESSAI", chiffres normaux pour le compteur
 * - Bouton "Voir l'abonnement" ouvre le Stripe Customer Portal via POST /api/billing/portal
 * - Avatar diagnostiqueur SOBRE : pas d'emoji, vouvoiement
 */
export function TrialBanner({ trialEndsAt, monthlyPriceCents, tierLabel }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState<boolean>(false)
  const [hydrated, setHydrated] = useState<boolean>(false)
  const [portalLoading, setPortalLoading] = useState<boolean>(false)

  useEffect(() => {
    setHydrated(true)
    if (typeof window !== 'undefined') {
      setDismissed(sessionStorage.getItem(SESSION_KEY) === '1')
    }
  }, [])

  if (!hydrated || dismissed) return null

  const trialEnd = new Date(trialEndsAt)
  const now = new Date()
  const msRemaining = trialEnd.getTime() - now.getTime()
  if (msRemaining <= 0) return null

  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24))
  const debitDate = trialEnd.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Paris',
  })
  const priceEuros = (monthlyPriceCents / 100).toFixed(0)

  async function openPortal() {
    setPortalLoading(true)
    try {
      const resp = await fetch('/api/billing/portal', { method: 'POST' })
      const data = (await resp.json()) as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
        return
      }
      // Fallback : redirige vers la page Mon compte si Stripe non configuré
      window.location.href = '/dashboard/account'
    } catch {
      window.location.href = '/dashboard/account'
    } finally {
      setPortalLoading(false)
    }
  }

  function dismiss() {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, '1')
    }
    setDismissed(true)
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: <output> is for form computation results; div role="status" is correct for a live region banner here.
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'mx-4 md:mx-6 mt-3 mb-1',
        'rounded-pill border border-info/20 bg-info/8',
        'flex items-center gap-3 px-4 py-2',
        'text-sm',
      )}
      title={`Formule ${tierLabel}`}
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] font-semibold text-info">
        Essai
      </span>
      <span className="text-ink">
        <span className="font-mono font-semibold tabular-nums text-ink">
          {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}
        </span>
        <span className="text-ink-mute"> · Prélèvement de </span>
        <span className="font-mono font-semibold tabular-nums text-ink">{priceEuros}€</span>
        <span className="text-ink-mute"> le {debitDate}</span>
      </span>

      <button
        type="button"
        onClick={openPortal}
        disabled={portalLoading}
        className={cn(
          'ml-auto inline-flex items-center gap-1.5 rounded-pill px-3 py-1',
          'text-xs font-semibold text-info hover:bg-info/10 transition-colors',
          'disabled:opacity-50',
        )}
      >
        {portalLoading && <Loader2 className="size-3 animate-spin" />}
        Voir l&apos;abonnement
      </button>

      <button
        type="button"
        onClick={dismiss}
        className="rounded-pill p-1 text-ink-mute hover:bg-ink/5 transition-colors"
        aria-label="Masquer la bannière"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
