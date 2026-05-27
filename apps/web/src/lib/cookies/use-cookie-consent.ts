'use client'

/**
 * Hook React pour le consentement cookies CNIL.
 *
 * Encapsule :
 *  - lecture initiale du consent localStorage (`loadConsent`)
 *  - écoute des mises à jour cross-onglets via `storage` event
 *  - écoute des mises à jour intra-onglet via `kovas:consent-change`
 *  - actions update / openPreferences / acceptAll / rejectAll
 */
import { useCallback, useEffect, useState } from 'react'
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_STORAGE_KEY,
  type ConsentChangeEventDetail,
  type ConsentState,
  loadConsent,
  saveConsent,
} from './consent-storage'

/**
 * Événement custom dispatché par `CookiePreferencesButton` (footer) pour
 * demander l'ouverture de la modale depuis n'importe où dans l'app sans
 * passer par un Context React.
 */
export const OPEN_PREFERENCES_EVENT = 'kovas:open-cookie-preferences' as const

/**
 * Dispatch programmatique (utilisable depuis `CookiePreferencesButton` ou
 * tout code client qui souhaite ouvrir la modale).
 */
export function requestOpenCookiePreferences(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(OPEN_PREFERENCES_EVENT))
  } catch {
    // no-op (très vieux navigateurs sans CustomEvent constructor)
  }
}

interface UseCookieConsentReturn {
  /** Consent courant ou null si pas encore donné / expiré. */
  readonly consent: ConsentState | null
  /** True tant que la lecture localStorage initiale n'a pas eu lieu (SSR-safe). */
  readonly isHydrated: boolean
  /** True si le banner doit s'afficher (pas de consent valide). */
  readonly shouldShowBanner: boolean
  /** True si la modale "Personnaliser" est ouverte. */
  readonly isPreferencesOpen: boolean
  /** Accepter tout : analytics + functional. */
  readonly acceptAll: () => void
  /** Refuser tout : analytics + functional = false. Essentiels restent ON. */
  readonly rejectAll: () => void
  /** Mise à jour granulaire (depuis la modale "Personnaliser"). */
  readonly updateConsent: (input: {
    readonly analytics: boolean
    readonly functional: boolean
  }) => void
  /** Ouvre la modale (depuis le footer ou le banner). */
  readonly openPreferences: () => void
  /** Ferme la modale sans persister (ESC, click outside). */
  readonly closePreferences: () => void
}

export function useCookieConsent(): UseCookieConsentReturn {
  const [consent, setConsent] = useState<ConsentState | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false)

  // Lecture initiale localStorage post-hydratation. Crucial pour éviter un
  // hydration mismatch (le SSR ne connaît pas localStorage).
  useEffect(() => {
    setConsent(loadConsent())
    setIsHydrated(true)
  }, [])

  // Écoute cross-onglets : si l'utilisateur change ses préférences dans un
  // autre onglet, on synchronise immédiatement.
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== CONSENT_STORAGE_KEY) return
      setConsent(loadConsent())
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  // Écoute intra-onglet : custom event dispatché par `saveConsent()`.
  useEffect(() => {
    function handleConsentChange(event: Event) {
      const detail = (event as CustomEvent<ConsentChangeEventDetail>).detail
      if (!detail) return
      setConsent(detail.consent)
    }
    window.addEventListener(CONSENT_CHANGE_EVENT, handleConsentChange)
    return () => {
      window.removeEventListener(CONSENT_CHANGE_EVENT, handleConsentChange)
    }
  }, [])

  // Écoute la demande d'ouverture de la modale (dispatchée depuis le footer
  // via `requestOpenCookiePreferences()`).
  useEffect(() => {
    function handleOpen() {
      setIsPreferencesOpen(true)
    }
    window.addEventListener(OPEN_PREFERENCES_EVENT, handleOpen)
    return () => {
      window.removeEventListener(OPEN_PREFERENCES_EVENT, handleOpen)
    }
  }, [])

  const acceptAll = useCallback(() => {
    saveConsent({ analytics: true, functional: true })
    setIsPreferencesOpen(false)
  }, [])

  const rejectAll = useCallback(() => {
    saveConsent({ analytics: false, functional: false })
    setIsPreferencesOpen(false)
  }, [])

  const updateConsent = useCallback(
    (input: { readonly analytics: boolean; readonly functional: boolean }) => {
      saveConsent(input)
      setIsPreferencesOpen(false)
    },
    [],
  )

  const openPreferences = useCallback(() => {
    setIsPreferencesOpen(true)
  }, [])

  const closePreferences = useCallback(() => {
    setIsPreferencesOpen(false)
  }, [])

  // Le banner s'affiche uniquement APRÈS hydratation, ET si aucun consent
  // valide n'est stocké. Évite un flash de banner pendant le SSR.
  const shouldShowBanner = isHydrated && consent === null

  return {
    consent,
    isHydrated,
    shouldShowBanner,
    isPreferencesOpen,
    acceptAll,
    rejectAll,
    updateConsent,
    openPreferences,
    closePreferences,
  }
}
