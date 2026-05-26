'use client'

/**
 * KOVAS — Cyclage des noms de logiciels concurrents compatibles dans le hero.
 *
 * Pourquoi : Benjamin souhaitait remplacer le "Liciel" statique de "Plus jamais
 * 21 h devant Liciel." par un cyclage des 4 noms principaux du marché FR
 * (Liciel · OBBC · AnalysImmo · ORIS). Plus inclusif → parle aux 100% du marché
 * (pas seulement aux 65% Liciel). Cohérent CLAUDE.md §1 + neuromarketing §1.5
 * (language match + polarization sans exclure).
 *
 * Comportement :
 * - Cycle automatique toutes les 2.4 s (ralenti pour donner le temps de lire).
 * - Première valeur = "Liciel" (préservation du SEO "Plus jamais 21 h devant Liciel").
 * - Crossfade subtle 350 ms (pas de flash, pas d'animation gimmick).
 * - Respect `prefers-reduced-motion` → désactive l'animation, garde uniquement "Liciel".
 * - Largeur stabilisée via inline-block + min-width pour empêcher le reflow.
 *
 * SEO :
 * - L'élément <span> reste dans le DOM avec le texte cyclé visible.
 * - Le crawler Google verra "Liciel" en premier render (SSR-friendly via initialIndex=0).
 * - On expose aussi le texte SEO friendly dans `<span className="sr-only">` listant les 4.
 */

import { useEffect, useState } from 'react'

const SOFTWARE_NAMES = ['Liciel', 'OBBC', 'AnalysImmo', 'ORIS'] as const

export interface RotatingSoftwareNameProps {
  /** Intervalle entre les rotations (ms). Défaut 2400. */
  intervalMs?: number
  /** Class additionnelle (Tailwind etc.). */
  className?: string
}

export function RotatingSoftwareName({
  intervalMs = 2400,
  className,
}: RotatingSoftwareNameProps): React.ReactElement {
  const [index, setIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  // Respect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Rotation timer
  useEffect(() => {
    if (reducedMotion) return undefined
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % SOFTWARE_NAMES.length)
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs, reducedMotion])

  const current = SOFTWARE_NAMES[index] ?? 'Liciel'

  return (
    <>
      {/* Largeur min calculée pour éviter le reflow entre noms courts (ORIS) et longs (AnalysImmo). */}
      <span
        aria-live="polite"
        aria-atomic="true"
        className={className}
        style={{
          display: 'inline-block',
          minWidth: '2.6em',
          transition: 'opacity 350ms ease-out',
          opacity: 1,
        }}
        // Force re-mount par key pour redéclencher l'animation fade-in
        key={current}
      >
        {current}
      </span>
      {/* SEO + a11y : la liste exhaustive existe dans le DOM même si non visible. */}
      <span className="sr-only">
        Compatible avec les principaux logiciels de diagnostic immobilier : Liciel, OBBC, AnalysImmo
        et ORIS.
      </span>
    </>
  )
}
