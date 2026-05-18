'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Hook d'état expand/collapse persisté en localStorage.
 * Synchronise entre onglets via le 'storage' event.
 *
 * @param key clé localStorage stable (ex: `kovas_dossier_${id}_${section}`)
 * @param defaultValue valeur initiale si rien en localStorage
 */
export function useExpandState(
  key: string,
  defaultValue = false,
): [boolean, (next?: boolean) => void] {
  const [value, setValue] = useState<boolean>(defaultValue)

  // Restore initial depuis localStorage (effet pour éviter mismatch SSR)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) setValue(raw === '1')
    } catch {
      // ignore (SSR ou storage bloqué)
    }
  }, [key])

  // Sync entre onglets
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === key && e.newValue !== null) {
        setValue(e.newValue === '1')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  const toggle = useCallback(
    (next?: boolean) => {
      setValue((prev) => {
        const v = typeof next === 'boolean' ? next : !prev
        try {
          window.localStorage.setItem(key, v ? '1' : '0')
        } catch {
          // ignore
        }
        return v
      })
    },
    [key],
  )

  return [value, toggle]
}
