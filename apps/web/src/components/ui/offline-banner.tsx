'use client'

import { cn } from '@/lib/utils'
import { WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * OfflineBanner — banner top discret quand connexion perdue.
 * Spec v4 §14.4 + §15.4 : pleine largeur, fond cyan-light, message canonique
 * "Mode hors ligne · vos données seront synchronisées au retour du réseau".
 *
 * Détection : navigator.onLine + listeners online/offline events.
 * Toast de confirmation au retour réseau (via Sonner) — géré ailleurs.
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
    setIsOnline(navigator.onLine)

    function handleOnline() {
      setIsOnline(true)
    }
    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!hydrated || isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'sticky top-0 z-40 w-full px-4 py-2',
        'bg-[hsl(var(--cyan-light))] border-b border-[hsl(var(--cyan-mid))]/30',
        'text-[hsl(var(--navy-900))] text-xs md:text-sm',
        'flex items-center justify-center gap-2',
      )}
    >
      <WifiOff className="size-3.5 shrink-0" strokeWidth={2} />
      <span>Mode hors ligne · vos données seront synchronisées au retour du réseau.</span>
    </div>
  )
}
