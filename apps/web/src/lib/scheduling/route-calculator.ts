/**
 * KOVAS — Distance/durée entre deux points (Phase A scheduling).
 *
 * Stratégie :
 *   1. Cache 1h dans `routes_cache` (clef = "lat1:lng1-lat2:lng2", 4 décimales)
 *   2. Si `OPENROUTESERVICE_API_KEY` → POST ORS Directions API (driving-car)
 *   3. Sinon fallback Haversine × 1.3 (facteur tortuosité routière) / 50 km/h
 *
 * Authority : briefing scheduling 2026-05-20.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface Coords {
  lat: number
  lng: number
}

export interface RouteInfo {
  distance_meters: number
  distance_km: number
  duration_seconds: number
  duration_minutes: number
  cached: boolean
  provider: 'ors' | 'haversine_fallback'
}

interface RoutesCacheRow {
  id: string
  cache_key: string
  distance_meters: number
  duration_seconds: number
  expires_at: string
}

interface RoutesCacheBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      gt: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{
          data: RoutesCacheRow | null
          error: { message: string } | null
        }>
      }
    }
  }
  insert: (row: {
    cache_key: string
    distance_meters: number
    duration_seconds: number
    expires_at: string
  }) => Promise<{ error: { message: string } | null }>
}

interface OrsDirectionsResponse {
  routes?: Array<{
    summary?: { distance?: number; duration?: number }
  }>
}

const EARTH_RADIUS_METERS = 6_371_000
const ROUTES_CACHE_TTL_SECONDS = Number(process.env.ROUTES_CACHE_TTL_SECONDS ?? 3600)
const FALLBACK_TORTUOSITY = 1.3
const FALLBACK_SPEED_KMH = 50

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Distance Haversine en mètres entre deux points GPS (grand cercle, R = 6371 km).
 * Exporté pour réutilisation par clustering-suggester / alternative-generator.
 */
export function haversineMeters(from: Coords, to: Coords): number {
  const dLat = toRad(to.lat - from.lat)
  const dLng = toRad(to.lng - from.lng)
  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_METERS * c
}

/**
 * Clef de cache : 4 décimales lat/lng (~11m précision) → invariance aux micro-variations.
 */
function buildCacheKey(from: Coords, to: Coords): string {
  return `${from.lat.toFixed(4)}:${from.lng.toFixed(4)}-${to.lat.toFixed(4)}:${to.lng.toFixed(4)}`
}

/**
 * Calcule route via ORS si clé d'env présente, sinon Haversine × 1.3 / 50km/h.
 * Le cache n'est jamais bloquant.
 */
export async function calculateRoute(
  from: Coords,
  to: Coords,
  supabase: SupabaseClient,
): Promise<RouteInfo> {
  const cacheKey = buildCacheKey(from, to)
  const cacheTable = supabase.from('routes_cache') as unknown as RoutesCacheBuilder

  // 1. Check cache
  const nowIso = new Date().toISOString()
  const { data: cached } = await cacheTable
    .select('id, cache_key, distance_meters, duration_seconds, expires_at')
    .eq('cache_key', cacheKey)
    .gt('expires_at', nowIso)
    .maybeSingle()

  if (cached) {
    const dMeters = Number(cached.distance_meters)
    const dSeconds = Number(cached.duration_seconds)
    return {
      distance_meters: dMeters,
      distance_km: Math.round((dMeters / 1000) * 100) / 100,
      duration_seconds: dSeconds,
      duration_minutes: Math.round((dSeconds / 60) * 10) / 10,
      cached: true,
      provider: 'haversine_fallback',
    }
  }

  // 2. ORS si clé d'env
  const orsKey = process.env.OPENROUTESERVICE_API_KEY
  let provider: 'ors' | 'haversine_fallback' = 'haversine_fallback'
  let distanceMeters = 0
  let durationSeconds = 0

  if (orsKey) {
    try {
      const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/json', {
        method: 'POST',
        headers: {
          Authorization: orsKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          coordinates: [
            [from.lng, from.lat],
            [to.lng, to.lat],
          ],
        }),
        cache: 'no-store',
      })
      if (res.ok) {
        const data = (await res.json()) as OrsDirectionsResponse
        const summary = data.routes?.[0]?.summary
        if (typeof summary?.distance === 'number' && typeof summary.duration === 'number') {
          distanceMeters = Math.round(summary.distance)
          durationSeconds = Math.round(summary.duration)
          provider = 'ors'
        }
      }
    } catch {
      // Fallback Haversine si ORS down
    }
  }

  if (provider === 'haversine_fallback') {
    const crowMeters = haversineMeters(from, to)
    const adjustedMeters = crowMeters * FALLBACK_TORTUOSITY
    distanceMeters = Math.round(adjustedMeters)
    durationSeconds = Math.round((adjustedMeters / 1000 / FALLBACK_SPEED_KMH) * 3600)
  }

  // 3. INSERT cache (fire-and-forget)
  const expiresAt = new Date(Date.now() + ROUTES_CACHE_TTL_SECONDS * 1000).toISOString()
  void cacheTable.insert({
    cache_key: cacheKey,
    distance_meters: distanceMeters,
    duration_seconds: durationSeconds,
    expires_at: expiresAt,
  })

  return {
    distance_meters: distanceMeters,
    distance_km: Math.round((distanceMeters / 1000) * 100) / 100,
    duration_seconds: durationSeconds,
    duration_minutes: Math.round((durationSeconds / 60) * 10) / 10,
    cached: false,
    provider,
  }
}
