'use client'

import { useEffect, useState } from 'react'

/**
 * Hook qui retourne `true` si la media query matche.
 * SSR-safe : retourne `false` par défaut au premier render, puis sync au mount.
 *
 * Exemple : `useMediaQuery('(min-width: 768px)')` — true si desktop/tablette.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    function onChange(e: MediaQueryListEvent) {
      setMatches(e.matches)
    }
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Helper conventionnel : true si viewport >= md (768px). */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)')
}
