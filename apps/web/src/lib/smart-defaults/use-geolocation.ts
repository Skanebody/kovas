'use client'

/**
 * useGeolocation — hook React wrapper navigator.geolocation pour les forms.
 *
 * Différence avec lib/geolocation.ts (qui sert aux photos terrain) :
 * - Renvoie un état React (loading / position / error)
 * - Permet d'attendre un consentement utilisateur explicite via `request()`
 * - Permet le déclenchement automatique via `autoRequest`
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface GeoPosition {
  lat: number
  lng: number
  accuracyMeters: number
}

export interface UseGeolocationOptions {
  /** Déclenche immédiatement la demande de position (consentement navigateur). Défaut : false. */
  autoRequest?: boolean
  /** Timeout en ms avant abandon. Défaut : 8000. */
  timeoutMs?: number
  /** Active la haute précision (GPS au lieu de Wi-Fi/IP). Défaut : true. */
  highAccuracy?: boolean
}

export interface UseGeolocationResult {
  loading: boolean
  position: GeoPosition | null
  error: string | null
  request: () => void
  /** Indique si la Geolocation API est disponible (false en SSR ou navigateurs non supportés). */
  supported: boolean
}

const DEFAULT_TIMEOUT_MS = 8000

export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationResult {
  const { autoRequest = false, timeoutMs = DEFAULT_TIMEOUT_MS, highAccuracy = true } = options

  const [loading, setLoading] = useState(false)
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(true)
  const requestedRef = useRef(false)

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setSupported(false)
      setError('Géolocalisation non supportée par votre navigateur.')
      return
    }
    setLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
        })
        setLoading(false)
      },
      (err) => {
        setLoading(false)
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Géolocalisation refusée.')
            break
          case err.POSITION_UNAVAILABLE:
            setError('Position indisponible.')
            break
          case err.TIMEOUT:
            setError('Géolocalisation expirée.')
            break
          default:
            setError('Erreur de géolocalisation.')
        }
      },
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: 60_000 },
    )
  }, [highAccuracy, timeoutMs])

  useEffect(() => {
    if (autoRequest && !requestedRef.current) {
      requestedRef.current = true
      request()
    }
  }, [autoRequest, request])

  return { loading, position, error, request, supported }
}
