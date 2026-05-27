'use client'

import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

interface LaunchOfferStatus {
  positionsTaken: number
  positionsRemaining: number
  isAvailable: boolean
  totalSlots: number
}

/**
 * Compteur dynamique offre de lancement KOVAS — affiché en haut de /pricing.
 *
 * Affiche :
 *   - `Plus que X places sur 30 · -30 % pendant 12 mois · engagement annuel`
 *   - `Offre de lancement épuisée` si tout est pris
 *
 * Fetch initial server-side via /api/launch-offer/status, puis poll toutes les
 * 60 secondes côté client tant que le composant est monté.
 *
 * Animation : fade-in subtil à l'apparition. Aucun bounce, aucun pulse.
 */
export function LaunchOfferCountdown() {
  const [status, setStatus] = useState<LaunchOfferStatus | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function fetchStatus() {
      try {
        const res = await fetch('/api/launch-offer/status', { cache: 'no-store' })
        if (!res.ok) return
        const json = (await res.json()) as LaunchOfferStatus
        if (isMounted) {
          setStatus(json)
          setVisible(true)
        }
      } catch {
        // Network glitch : on garde le précédent état.
      }
    }

    void fetchStatus()
    const intervalId = window.setInterval(fetchStatus, 60_000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  if (status === null) {
    // Skeleton minimal pendant le premier fetch
    return (
      <div className="h-[44px] mx-auto max-w-[640px] rounded-full bg-[#0F1419]/[0.04] animate-pulse" />
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'mx-auto max-w-[760px] rounded-full px-5 sm:px-7 py-3 text-center text-[13px] sm:text-[14px] font-medium transition-opacity duration-500',
        visible ? 'opacity-100' : 'opacity-0',
        status.isAvailable
          ? 'bg-chartreuse text-[#0F1419] border border-[#95B11A]/40'
          : 'bg-[#0F1419]/5 text-[#0F1419]/55 border border-[#0F1419]/10',
      )}
    >
      {status.isAvailable ? (
        <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <strong className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold">
            Offre de lancement
          </strong>
          <span>
            Plus que <strong className="tabular-nums">{status.positionsRemaining}</strong> place
            {status.positionsRemaining > 1 ? 's' : ''} sur {status.totalSlots}
          </span>
          <span className="text-[#0F1419]/72">·</span>
          <span>−30 % pendant 12 mois</span>
          <span className="text-[#0F1419]/72">·</span>
          <span>engagement annuel</span>
        </span>
      ) : (
        <span>Offre de lancement épuisée — merci aux 30 premiers diagnostiqueurs embarqués.</span>
      )}
    </div>
  )
}
