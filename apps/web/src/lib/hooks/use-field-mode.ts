'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Mode terrain : active une variante UI optimisée pour le terrain (lecture en
 * plein soleil, gants, mouvement) :
 *
 * — Police +20% via attribut `data-field-mode` sur <html>
 * — Boutons hauteur min 64px (via CSS scoping sur data-field-mode)
 * — FAB devient size-20 (80px)
 * — Inputs : ajout attribut `data-field-mode="true"` pour CSS targeting
 *
 * Persistant en sessionStorage (pas localStorage : le mode terrain est un
 * contexte de session, pas une préférence permanente).
 *
 * Géolocalisation : peut être utilisée comme signal d'auto-activation
 * (déplacement > 50m du domicile par exemple), mais ce hook ne fait que
 * exposer l'API toggle — l'auto-détection est laissée au caller.
 */

const STORAGE_KEY = 'kovas-field-mode'
const HTML_ATTR = 'data-field-mode'

function readInitial(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function persist(active: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (active) {
      window.sessionStorage.setItem(STORAGE_KEY, '1')
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // sessionStorage indisponible (Safari private) → silencieux
  }
}

function applyToHtml(active: boolean): void {
  if (typeof document === 'undefined') return
  if (active) {
    document.documentElement.setAttribute(HTML_ATTR, 'true')
  } else {
    document.documentElement.removeAttribute(HTML_ATTR)
  }
}

export interface UseFieldModeResult {
  /** True si mode terrain actif. */
  active: boolean
  /** Active le mode terrain (et persiste). */
  enable: () => void
  /** Désactive le mode terrain. */
  disable: () => void
  /** Toggle. */
  toggle: () => void
  /** True si l'API geoloc est disponible côté navigateur. */
  geolocationSupported: boolean
}

/**
 * Hook field mode. À placer dans un toggle header (visible mobile).
 */
export function useFieldMode(): UseFieldModeResult {
  const [active, setActive] = useState<boolean>(false)
  const [geolocationSupported, setGeolocationSupported] = useState<boolean>(false)

  // Sync initial depuis sessionStorage (post-hydration)
  useEffect(() => {
    const initial = readInitial()
    setActive(initial)
    applyToHtml(initial)
    setGeolocationSupported(typeof navigator !== 'undefined' && 'geolocation' in navigator)
  }, [])

  // Apply on change
  useEffect(() => {
    applyToHtml(active)
    persist(active)
  }, [active])

  const enable = useCallback(() => setActive(true), [])
  const disable = useCallback(() => setActive(false), [])
  const toggle = useCallback(() => setActive((v) => !v), [])

  return { active, enable, disable, toggle, geolocationSupported }
}
