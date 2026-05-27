/**
 * KOVAS — Helpers calendrier : distances + estimations trajets.
 *
 * Réutilise la formule Haversine partagée (cf. `@/lib/ademe/haversine`) pour
 * éviter la duplication. Ce module ajoute :
 *   - une signature ergonomique `{lat, lon}` plus locale au calendrier
 *   - une heuristique de durée de trajet basée sur vitesse moyenne (km/h)
 *   - des helpers de formatage FR (« 23 km », « 850 m », « ~28 min »).
 *
 * V1 simple : pas d'API Routes (ORS) pour la vue calendrier — la valeur est
 * indicative entre deux RDV. Le scheduling sérieux (clustering, contraintes
 * trafic) passe par `@/lib/scheduling/route-calculator`.
 */
import { type LatLng, haversineDistanceKm } from '@/lib/ademe/haversine'

export interface LatLon {
  lat: number
  lon: number
}

/** Distance Haversine en kilomètres entre deux points {lat, lon}. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const aLL: LatLng = { latitude: a.lat, longitude: a.lon }
  const bLL: LatLng = { latitude: b.lat, longitude: b.lon }
  return haversineDistanceKm(aLL, bLL)
}

/**
 * Estime la durée d'un trajet en minutes.
 *
 * Heuristique : vitesse moyenne route française mixte ≈ 60 km/h (autoroute
 * compense agglomération). Sur-estime légèrement en zone urbaine dense, sous-
 * estime sur autoroute pure — acceptable pour affichage indicatif calendrier.
 *
 * @param distanceKm distance Haversine (à vol d'oiseau) en kilomètres
 * @param avgSpeed   vitesse moyenne en km/h, défaut 60
 * @returns Durée estimée en minutes (entier arrondi au sup)
 */
export function estimateDriveMinutes(distanceKm: number, avgSpeed = 60): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0
  if (avgSpeed <= 0) return 0
  // +20% pour compenser sinuosité réseau routier vs vol d'oiseau
  const adjustedKm = distanceKm * 1.2
  return Math.max(1, Math.ceil((adjustedKm / avgSpeed) * 60))
}

/**
 * Formate une distance pour affichage FR.
 *   - < 1 km : "850 m" (arrondi à 50 m près)
 *   - ≥ 1 km : "23 km" (arrondi à l'unité)
 *   - ≥ 100 km : "123 km" (idem, sans virgule)
 *   - < 10 km : "4,2 km" (1 décimale virgule)
 */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '—'
  if (km < 1) {
    const meters = Math.round((km * 1000) / 50) * 50
    return `${meters} m`
  }
  if (km < 10) {
    const rounded = Math.round(km * 10) / 10
    return `${rounded.toString().replace('.', ',')} km`
  }
  return `${Math.round(km)} km`
}

/** Formate une durée en minutes : "~28 min" / "~1 h 15". */
export function formatDriveMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—'
  if (minutes < 60) return `~${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes - h * 60)
  if (m === 0) return `~${h} h`
  return `~${h} h ${String(m).padStart(2, '0')}`
}
