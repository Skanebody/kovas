'use client'

import { useEffect, useState } from 'react'

/**
 * Add to Home Screen onboarding modal (bretelle 1 du pivot PWA).
 * Cf. /docs/pwa-pivot-decision.md §4 — persistance iPadOS PWA après 7j inactivité.
 *
 * Force "Add to Home Screen" sur iOS pour persistance illimitée des data PWA.
 */
export function AddToHomeScreen() {
  const [show, setShow] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const ua = window.navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // biome-ignore lint/suspicious/noExplicitAny: navigator.standalone is iOS-specific non-standard
      (window.navigator as any).standalone === true

    setIsIos(ios)
    setIsStandalone(standalone)

    // Show modal if iOS and not yet installed
    if (ios && !standalone) {
      const dismissed = localStorage.getItem('a2hs-dismissed-count') || '0'
      if (Number.parseInt(dismissed, 10) < 2) {
        setShow(true)
      }
    }
  }, [])

  if (!show || isStandalone || !isIos) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 md:p-6">
      <div className="mx-auto max-w-md rounded-xl bg-card p-6 shadow-md ring-1 ring-border">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Ajoute KOVAS à ton écran d'accueil
          </h2>
          <p className="text-sm text-muted-foreground">
            Pour utiliser KOVAS comme une vraie app et garder tes données en sécurité, ajoute-le à
            ton écran d'accueil en 3 clics.
          </p>
          <ol className="space-y-2 text-sm text-foreground">
            <li>1. Appuie sur le bouton Partager ⎙ en bas</li>
            <li>2. Choisis "Sur l'écran d'accueil"</li>
            <li>3. Appuie sur Ajouter</li>
          </ol>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                const c =
                  Number.parseInt(localStorage.getItem('a2hs-dismissed-count') || '0', 10) + 1
                localStorage.setItem('a2hs-dismissed-count', String(c))
                setShow(false)
              }}
              className="flex-1 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition"
            >
              Plus tard
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('a2hs-dismissed-count', '999')
                setShow(false)
              }}
              className="flex-1 rounded-md bg-cta px-4 py-2 text-sm font-medium text-cta-foreground hover:bg-cta-hover transition"
            >
              Compris
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
