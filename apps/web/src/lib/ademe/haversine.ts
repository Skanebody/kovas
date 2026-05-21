/**
 * KOVAS — Module Cockpit ADEME — Haversine helper.
 *
 * Calcul de distance géodésique entre deux points (lat/lng) en utilisant la
 * formule de Haversine (sphère terrestre simplifiée, rayon moyen 6 371 km).
 *
 * Précision suffisante pour le besoin métier : détecter un nouvel DPE
 * "anormalement éloigné" du dernier publié (alerte à 25/40 km). Aucune
 * dépendance externe (turf.js / geolib) — on évite +200 ko de bundle.
 *
 * Référence : https://en.wikipedia.org/wiki/Haversine_formula
 */

/** Rayon moyen de la Terre, en kilomètres (R⊕). */
const EARTH_RADIUS_KM = 6371

/** Convertit des degrés décimaux en radians. */
function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

export interface LatLng {
  /** Latitude en degrés décimaux (-90 → +90). */
  latitude: number
  /** Longitude en degrés décimaux (-180 → +180). */
  longitude: number
}

/**
 * Distance entre deux coordonnées (en kilomètres).
 *
 * @returns Distance en km (float ≥ 0). NaN si l'une des coordonnées est invalide.
 */
export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  if (
    !Number.isFinite(a.latitude) ||
    !Number.isFinite(a.longitude) ||
    !Number.isFinite(b.latitude) ||
    !Number.isFinite(b.longitude)
  ) {
    return Number.NaN
  }

  const dLat = toRadians(b.latitude - a.latitude)
  const dLon = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)

  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return EARTH_RADIUS_KM * c
}

/**
 * Distance en mètres (utilitaire complémentaire).
 */
export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  return haversineDistanceKm(a, b) * 1000
}
