'use client'

import { useEffect, useState } from 'react'

/**
 * Debounce d'une valeur — utile pour les fetch d'API déclenchés par la frappe
 * ou par des changements de form (estimate-duration, detect-conflict, etc.).
 *
 * Renvoie la valeur initiale puis se met à jour après `delayMs` sans changement.
 *
 * @example
 *   const surface = useState<number>(72)
 *   const debouncedSurface = useDebounce(surface, 500)
 *   useEffect(() => { fetch(...) }, [debouncedSurface])
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
