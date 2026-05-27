'use client'

/**
 * CookiePreferencesButton — bouton "Préférences cookies" pour le footer.
 *
 * Dispatch un event custom `kovas:open-cookie-preferences` que le provider
 * racine (`CookieConsentProvider`) écoute pour ré-ouvrir la modale. Cette
 * approche event-based évite un Context React + permet d'avoir le bouton
 * sur n'importe quel layout sans risque d'état désynchronisé.
 */
import { requestOpenCookiePreferences } from '@/lib/cookies/use-cookie-consent'
import { cn } from '@/lib/utils'
import type { MouseEvent, ReactNode } from 'react'

interface CookiePreferencesButtonProps {
  readonly className?: string
  readonly children?: ReactNode
}

export function CookiePreferencesButton({
  className,
  children = 'Préférences cookies',
}: CookiePreferencesButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    requestOpenCookiePreferences()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'text-left hover:text-ink transition-colors cursor-pointer underline-offset-2 hover:underline',
        className,
      )}
    >
      {children}
    </button>
  )
}
