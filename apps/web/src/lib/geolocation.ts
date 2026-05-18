/**
 * Wrapper navigator.geolocation pour récupérer position GPS au moment de la prise de photo.
 * Précision : 5-50m typique iPhone, 50-500m typique desktop.
 */

export interface GpsPosition {
  longitude: number
  latitude: number
  accuracyMeters: number
  capturedAt: string // ISO 8601
}

const TIMEOUT_MS = 8000
const MAX_AGE_MS = 30_000 // accepte une position de moins de 30s

export async function getCurrentPosition(): Promise<GpsPosition | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          longitude: pos.coords.longitude,
          latitude: pos.coords.latitude,
          accuracyMeters: pos.coords.accuracy,
          capturedAt: new Date(pos.timestamp).toISOString(),
        })
      },
      () => resolve(null), // permission refusée ou timeout — non bloquant
      { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: MAX_AGE_MS },
    )
  })
}
