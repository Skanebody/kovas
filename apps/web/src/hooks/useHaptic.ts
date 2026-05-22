'use client'

import { useCallback } from 'react'

/**
 * Hook de feedback haptique pour les CTA mobile.
 *
 * Spec V5 — Principe de fluidité #8 :
 * Vibration courte (10ms par défaut) sur tap CTA primary, photo prise,
 * action critique validée. Respecte `prefers-reduced-motion` indirectement
 * via la décision iOS Safari (qui désactive vibrate quand l'utilisateur
 * a coupé les feedbacks haptiques système).
 *
 * Sur desktop ou navigateurs sans Vibration API → no-op silencieux.
 *
 * @example
 *   const haptic = useHaptic()
 *   function handleSubmit() {
 *     haptic()
 *     // …
 *   }
 */
export function useHaptic(): (durationMs?: number) => void {
  return useCallback((durationMs: number = 10) => {
    if (typeof window === 'undefined') return
    if (typeof window.navigator === 'undefined') return
    // Vibration API : Chrome/Firefox/Edge Android, iOS 16.4+ (Safari)
    const nav = window.navigator
    if (typeof nav.vibrate === 'function') {
      try {
        nav.vibrate(durationMs)
      } catch {
        // Silent fail — l'haptique est purement décoratif
      }
    }
  }, [])
}
