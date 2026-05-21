'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Hook A/B testing — résout le variant à utiliser pour une expérience donnée.
 *
 * Flux :
 *  1. Lit (ou crée) le cookie/localStorage `kovas_session_id` (UUID v4).
 *  2. Cache localStorage 24h sur clé `kovas_ab_<experimentKey>` :
 *     `{ variant, expiresAt }` pour éviter un round-trip à chaque mount.
 *  3. Si cache miss, POST /api/ab/assign avec { experimentKey, userIdentifier }.
 *  4. trackConversion() POST /api/ab/track (eventType: 'conversion').
 *
 * Le variant retourné par défaut tant qu'on n'a pas la réponse est 'control'
 * (assignation non-bloquante UI).
 */

const SESSION_COOKIE = 'kovas_session_id'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_PREFIX = 'kovas_ab_'

interface CachedAssignment {
  variant: string
  expiresAt: number
}

interface UseExperimentResult {
  variant: string
  isLoading: boolean
  trackConversion: (eventData?: { value?: number; data?: Record<string, unknown> }) => void
  trackClick: (eventData?: { value?: number; data?: Record<string, unknown> }) => void
  trackSubmit: (eventData?: { value?: number; data?: Record<string, unknown> }) => void
}

export function useExperiment(experimentKey: string): UseExperimentResult {
  const [variant, setVariant] = useState<string>('control')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Étape 1 : résout user_identifier (cookie session_id)
  useEffect(() => {
    if (typeof window === 'undefined') return
    let sid = readSessionCookie()
    if (!sid) {
      sid = generateSessionId()
      writeSessionCookie(sid)
    }
    setSessionId(sid)
  }, [])

  // Étape 2 + 3 : cache localStorage 24h sinon fetch /api/ab/assign
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false

    const cached = readCachedAssignment(experimentKey)
    if (cached) {
      setVariant(cached.variant)
      setIsLoading(false)
      return
    }

    void (async () => {
      try {
        const res = await fetch('/api/ab/assign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            experimentKey,
            userIdentifier: sessionId,
          }),
        })
        if (!res.ok) {
          if (!cancelled) setIsLoading(false)
          return
        }
        const json = (await res.json()) as { variant?: string }
        if (!cancelled && typeof json.variant === 'string') {
          setVariant(json.variant)
          writeCachedAssignment(experimentKey, json.variant)
        }
      } catch {
        // Échec silencieux : on garde 'control' (fail-safe pour landing pages).
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [experimentKey, sessionId])

  const trackInternal = useCallback(
    (eventType: 'conversion' | 'click' | 'submit') =>
      (eventData?: { value?: number; data?: Record<string, unknown> }) => {
        if (!sessionId) return
        void fetch('/api/ab/track', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            experimentKey,
            userIdentifier: sessionId,
            eventType,
            eventValue: eventData?.value,
            eventData: eventData?.data,
          }),
          keepalive: true,
        }).catch(() => {
          // Échec silencieux — tracking analytique non bloquant.
        })
      },
    [experimentKey, sessionId],
  )

  const trackConversion = useCallback(
    (eventData?: { value?: number; data?: Record<string, unknown> }) =>
      trackInternal('conversion')(eventData),
    [trackInternal],
  )
  const trackClick = useCallback(
    (eventData?: { value?: number; data?: Record<string, unknown> }) =>
      trackInternal('click')(eventData),
    [trackInternal],
  )
  const trackSubmit = useCallback(
    (eventData?: { value?: number; data?: Record<string, unknown> }) =>
      trackInternal('submit')(eventData),
    [trackInternal],
  )

  return { variant, isLoading, trackConversion, trackClick, trackSubmit }
}

// ---------------------------------------------------------------
// Utilitaires session id + cache localStorage
// ---------------------------------------------------------------

function readSessionCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${SESSION_COOKIE}=`))
  return match ? decodeURIComponent(match.split('=')[1] ?? '') : null
}

function writeSessionCookie(sid: string): void {
  if (typeof document === 'undefined') return
  // 1 an, lax, secure si https
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  const maxAge = 60 * 60 * 24 * 365
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(sid)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback : timestamp + random (jamais utilisé sur browsers modernes)
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function readCachedAssignment(experimentKey: string): CachedAssignment | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${experimentKey}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedAssignment
    if (!parsed?.variant || typeof parsed.expiresAt !== 'number') return null
    if (parsed.expiresAt < Date.now()) {
      localStorage.removeItem(`${CACHE_PREFIX}${experimentKey}`)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeCachedAssignment(experimentKey: string, variant: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    const payload: CachedAssignment = {
      variant,
      expiresAt: Date.now() + CACHE_TTL_MS,
    }
    localStorage.setItem(`${CACHE_PREFIX}${experimentKey}`, JSON.stringify(payload))
  } catch {
    // Quota dépassé : silencieux.
  }
}
