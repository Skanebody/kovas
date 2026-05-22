'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface AutoSaveState {
  status: AutoSaveStatus
  lastSavedAt: Date | null
  /** Erreur dernière tentative — null si aucune erreur. */
  error: Error | null
  /** Force une sauvegarde immédiate (utile pour Cmd+S). */
  flush: () => void
  /** Relance après échec. */
  retry: () => void
}

interface UseAutoSaveOptions {
  /** Délai de debounce en ms. Défaut 3000. */
  debounceMs?: number
  /** Désactive l'auto-save (utile pour formulaires invalides). */
  disabled?: boolean
}

/**
 * Hook d'auto-save invisible.
 *
 * Spec V5 — Principe de fluidité #4 :
 * Sauvegarde automatique 3s après dernière modification. Pas de bouton
 * "Sauvegarder" — un `<SavedIndicator>` accompagne pour signaler l'état.
 *
 * Combine avec optimistic UI (#1) : la sauvegarde se fait en background,
 * l'UI considère immédiatement la valeur modifiée comme acquise.
 *
 * @example
 *   const { status, lastSavedAt, retry } = useAutoSave(
 *     formValues,
 *     async (values) => { await api.update(values) },
 *   )
 *   return (
 *     <>
 *       <form>…</form>
 *       <SavedIndicator status={status} lastSavedAt={lastSavedAt} onRetry={retry} />
 *     </>
 *   )
 */
export function useAutoSave<T>(
  value: T,
  onSave: (value: T) => Promise<void> | void,
  options: UseAutoSaveOptions = {},
): AutoSaveState {
  const { debounceMs = 3000, disabled = false } = options

  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastValueRef = useRef<T>(value)
  const isFirstRunRef = useRef(true)
  const inFlightRef = useRef(false)

  const performSave = useCallback(async (toSave: T) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setStatus('saving')
    setError(null)
    try {
      await onSaveRef.current(toSave)
      setStatus('saved')
      setLastSavedAt(new Date())
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Erreur de sauvegarde')
      setError(e)
      setStatus('error')
    } finally {
      inFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    if (disabled) return
    // Ignore le premier render (la valeur initiale n'est pas une modification)
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false
      lastValueRef.current = value
      return
    }
    // Skip si valeur identique (référence)
    if (Object.is(lastValueRef.current, value)) return
    lastValueRef.current = value

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      performSave(value)
    }, debounceMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value, debounceMs, disabled, performSave])

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    performSave(lastValueRef.current)
  }, [performSave])

  const retry = useCallback(() => {
    performSave(lastValueRef.current)
  }, [performSave])

  // Cmd+S / Ctrl+S → force save (raccourci F9 du principe #9)
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onKey(e: KeyboardEvent) {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && e.key === 's') {
        e.preventDefault()
        flush()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flush])

  return { status, lastSavedAt, error, flush, retry }
}
