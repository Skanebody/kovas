'use client'

import { cn } from '@/lib/utils'
import { type ReactNode, useEffect, useState } from 'react'

/**
 * BannerDismissShell — Client Component qui :
 *
 *   1. Lit `localStorage[dismissKey]` au montage et masque le banner si
 *      l'utilisateur l'a fermé il y a moins de `dismissDurationDays` jours.
 *   2. Injecte un bouton "Pas maintenant" dans la colonne d'actions du
 *      banner (sélecteur DOM : dernier `<div>` flex-col du banner).
 *   3. Pour éviter le flash visuel avant hydratation, on rend `children`
 *      avec `aria-hidden` + `display: none` initialement, puis on bascule
 *      à visible quand le check localStorage est ok.
 *
 * Ce shell est volontairement minimal — toute la logique de message/markup
 * est dans `AnnuaireUpgradeBanner` (server component).
 */
interface BannerDismissShellProps {
  /** Clé localStorage de dismiss (unique par tier/cible). */
  dismissKey: string
  /** Durée du dismiss en jours avant resurface (7 par défaut). */
  dismissDurationDays?: number
  children: ReactNode
}

export function BannerDismissShell({
  dismissKey,
  dismissDurationDays = 7,
  children,
}: BannerDismissShellProps) {
  // État de visibilité : `null` = pas encore hydraté (rendu masqué pour
  // éviter le flash), `true` = visible, `false` = dismissed.
  const [visible, setVisible] = useState<boolean | null>(null)

  useEffect(() => {
    // SSR-safe : window peut ne pas exister durant l'hydratation initiale
    if (typeof window === 'undefined') {
      setVisible(true)
      return
    }
    try {
      const raw = window.localStorage.getItem(dismissKey)
      if (!raw) {
        setVisible(true)
        return
      }
      const dismissedAt = Number.parseInt(raw, 10)
      if (!Number.isFinite(dismissedAt)) {
        setVisible(true)
        return
      }
      const expiresAt = dismissedAt + dismissDurationDays * 24 * 60 * 60 * 1000
      if (Date.now() > expiresAt) {
        // Dismiss expiré : on resurface et nettoie la clé.
        window.localStorage.removeItem(dismissKey)
        setVisible(true)
        return
      }
      setVisible(false)
    } catch {
      // Privacy mode ou quota dépassé : on affiche par défaut.
      setVisible(true)
    }
  }, [dismissKey, dismissDurationDays])

  function handleDismiss() {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(dismissKey, String(Date.now()))
    } catch {
      // Silently ignore (privacy mode).
    }
    setVisible(false)
  }

  // Pré-hydratation ou dismissed : on ne rend rien (pas de flash).
  if (visible === null || visible === false) {
    return null
  }

  return (
    <div data-banner-dismiss-shell className="relative">
      {children}
      {/* Bouton "Pas maintenant" rendu en bas à droite, à l'intérieur du
          padding visuel du banner. Sur mobile il se place sous le contenu,
          sur desktop il s'aligne discrètement en bottom-right. */}
      <div className="flex justify-center md:justify-end px-5 sm:px-6 pb-3 sm:pb-4 -mt-2">
        <button
          type="button"
          onClick={handleDismiss}
          className={cn(
            'text-[12px] text-ink-mute hover:text-ink underline-offset-2 hover:underline',
            'font-sans transition-colors',
            'focus-visible:outline-none focus-visible:underline',
          )}
          aria-label="Masquer cette suggestion pendant 7 jours"
        >
          Pas maintenant
        </button>
      </div>
    </div>
  )
}
