/**
 * KOVAS — Helpers de parsing géolocalisation PostGIS.
 *
 * Fichier neutre (pas de 'use client') — peut être importé depuis Server
 * Components ET Client Components. Auparavant ces helpers étaient co-localisés
 * dans PropertyInteractiveMap.tsx ('use client'), ce qui provoquait l'erreur
 * « Attempted to call parsePropertyLocation() from the server but
 * parsePropertyLocation is on the client » sur /dashboard/properties/[id].
 *
 * Aucune dépendance React/DOM/Leaflet — fonctions pures.
 */

/**
 * Parse la string PostGIS `SRID=4326;POINT(lng lat)` (EWKT) en `{ lat, lng }`.
 * Retourne null si format invalide.
 */
export function parsePostGisPoint(
  location: string | null | undefined,
): { lat: number; lng: number } | null {
  if (!location) return null
  const match = location.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i)
  if (!match) return null
  const lng = Number.parseFloat(match[1] ?? '')
  const lat = Number.parseFloat(match[2] ?? '')
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

/**
 * Parse une string PostGIS EWKB hex (format Supabase REST par défaut pour
 * colonnes geography sans cast).
 *
 * Structure EWKB little-endian :
 *   - byte 0     : endianness (01 = LE)
 *   - bytes 1-4  : type + SRID flag (01000020 = POINT avec SRID)
 *   - bytes 5-8  : SRID en LE (E6100000 = 4326)
 *   - bytes 9-16 : X (lng) en float64 LE
 *   - bytes 17-24: Y (lat) en float64 LE
 */
export function parsePostGisHexEWKB(
  hex: string | null | undefined,
): { lat: number; lng: number } | null {
  if (!hex) return null
  const clean = hex.replace(/^0x/i, '').toLowerCase()
  if (clean.length < 50 || !/^[0-9a-f]+$/.test(clean)) return null

  const readFloat64LE = (offsetHex: number): number => {
    const slice = clean.slice(offsetHex, offsetHex + 16)
    if (slice.length !== 16) return Number.NaN
    const bytes = new Uint8Array(8)
    for (let i = 0; i < 8; i += 1) {
      bytes[i] = Number.parseInt(slice.slice(i * 2, i * 2 + 2), 16)
    }
    return new DataView(bytes.buffer).getFloat64(0, true)
  }

  const lng = readFloat64LE(18)
  const lat = readFloat64LE(34)

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

/**
 * Helper tolérant : essaie d'abord EWKT (POINT(lng lat)) puis EWKB hex.
 * Couvre les 2 formats que Supabase peut retourner selon la requête.
 */
export function parsePropertyLocation(
  location: string | null | undefined,
): { lat: number; lng: number } | null {
  return parsePostGisPoint(location) ?? parsePostGisHexEWKB(location)
}
