/**
 * KOVAS — Geocoding via BAN API (Base Adresse Nationale, gratuit, FR-optimisé).
 *
 * Cache permanent dans `geocoding_cache` : une adresse normalisée ne change pas.
 * Pas d'ORS geocoding (payant). Pas de Google Places (payant + UE/RGPD).
 *
 * Authority : briefing scheduling 2026-05-20 + `lib/ban.ts` existant.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface GeocodedAddress {
  lat: number
  lng: number
  formattedAddress: string
  city: string | null
  postalCode: string | null
  insee: string | null
  /** Score BAN 0-1 (≥ 0.7 = adresse plein-text fiable). */
  confidence: number
  cached: boolean
}

interface GeocodingCacheRow {
  id: string
  address_normalized: string
  raw_address: string
  geo_lat: number
  geo_lng: number
  city: string | null
  postal_code: string | null
  confidence: number | null
  hit_count: number
}

interface BanFeatureResponse {
  features?: Array<{
    geometry?: { coordinates?: [number, number] }
    properties?: {
      label?: string
      score?: number
      postcode?: string
      citycode?: string
      city?: string
    }
  }>
}

/**
 * Cast typé minimal pour les opérations sur `geocoding_cache` (table absente
 * du Database type généré, cf. pattern `lib/admin/product-analytics.ts`).
 */
interface GeocodingCacheBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      maybeSingle: () => Promise<{
        data: GeocodingCacheRow | null
        error: { message: string } | null
      }>
    }
  }
  insert: (
    row: Omit<GeocodingCacheRow, 'id' | 'hit_count'> & { confidence: number | null },
  ) => Promise<{ error: { message: string } | null }>
  update: (patch: { hit_count: number; last_used_at: string }) => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
}

/**
 * Normalise une adresse pour cache lookup : lowercase, strip accents, collapse spaces.
 */
function normalize(address: string): string {
  return (
    address
      .toLowerCase()
      .normalize('NFD')
      // biome-ignore lint/suspicious/noMisleadingCharacterClass: combining diacritics range U+0300-U+036F
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Géocode une adresse postale FR via BAN. Si l'adresse est en cache, on bump
 * `hit_count` + `last_used_at` en background (fire-and-forget). Sinon on appelle
 * BAN puis on INSERT le résultat dans le cache.
 *
 * @returns null si BAN ne renvoie aucun résultat ou si la query est vide.
 */
export async function geocode(
  address: string,
  supabase: SupabaseClient,
): Promise<GeocodedAddress | null> {
  const trimmed = address?.trim()
  if (!trimmed || trimmed.length < 3) return null

  const normalized = normalize(trimmed)
  const cacheTable = supabase.from('geocoding_cache') as unknown as GeocodingCacheBuilder

  // 1. Check cache
  const { data: cached, error: cacheErr } = await cacheTable
    .select(
      'id, address_normalized, raw_address, geo_lat, geo_lng, city, postal_code, confidence, hit_count',
    )
    .eq('address_normalized', normalized)
    .maybeSingle()

  if (!cacheErr && cached) {
    // Bump hit_count + last_used_at en background (fire-and-forget)
    void cacheTable
      .update({ hit_count: cached.hit_count + 1, last_used_at: new Date().toISOString() })
      .eq('id', cached.id)

    return {
      lat: Number(cached.geo_lat),
      lng: Number(cached.geo_lng),
      formattedAddress: cached.raw_address,
      city: cached.city,
      postalCode: cached.postal_code,
      insee: null,
      confidence: cached.confidence ?? 0.8,
      cached: true,
    }
  }

  // 2. Call BAN API
  const url = new URL('https://api-adresse.data.gouv.fr/search/')
  url.searchParams.set('q', trimmed)
  url.searchParams.set('limit', '1')

  let banData: BanFeatureResponse | null = null
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
    if (!res.ok) return null
    banData = (await res.json()) as BanFeatureResponse
  } catch {
    return null
  }

  const feature = banData?.features?.[0]
  if (!feature?.geometry?.coordinates || !feature.properties) return null

  const [lng, lat] = feature.geometry.coordinates
  const score = feature.properties.score ?? 0.5

  // 3. INSERT cache (fire-and-forget : si la ligne existe déjà côté concurrence, on ignore)
  void cacheTable.insert({
    address_normalized: normalized,
    raw_address: feature.properties.label ?? trimmed,
    geo_lat: lat,
    geo_lng: lng,
    city: feature.properties.city ?? null,
    postal_code: feature.properties.postcode ?? null,
    confidence: score,
  })

  return {
    lat,
    lng,
    formattedAddress: feature.properties.label ?? trimmed,
    city: feature.properties.city ?? null,
    postalCode: feature.properties.postcode ?? null,
    insee: feature.properties.citycode ?? null,
    confidence: score,
    cached: false,
  }
}
