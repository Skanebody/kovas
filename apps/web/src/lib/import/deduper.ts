/**
 * Détection de doublons entre les entités stagées et la prod.
 *
 * Algo (cf. spec §6) :
 *  - Clients : email_exact (0.35) + siret_exact (0.40) + phone (0.25) +
 *              name_lev (0.15) + geo (0.10) — weighted avg
 *  - Properties : géocodage prioritaire (lat/lng <10m + surface ±5%) sinon
 *                 levenshtein adresse
 *  - Copropriétés : RNIC exact = 1.0, sinon name lev + adresse
 *
 * Seuil match candidat : 0.60 (IMPORT_LIMITS.DEDUPE_THRESHOLD_MIN)
 */

import type { NormalizedClient, NormalizedCopropriete, NormalizedProperty } from './normalizer'
import { IMPORT_LIMITS, type MatchReason } from './types'

// ============================================================================
// TYPES
// ============================================================================

export interface ExistingClient {
  id: string
  display_name: string | null
  email: string | null
  phone: string | null
  siret: string | null
  address: string | null
  city: string | null
  postal_code: string | null
}

export interface ExistingProperty {
  id: string
  address: string | null
  city: string | null
  postal_code: string | null
  surface_total: number | null
  surface_carrez: number | null
  location_lat: number | null
  location_lng: number | null
}

export interface ExistingCopropriete {
  id: string
  name: string | null
  rnic_number: string | null
  address: string | null
  city: string | null
  postal_code: string | null
}

/**
 * Input pour l'insertion en BDD — staging_entity_id sera l'UUID renvoyé
 * par Supabase après l'insert staging.
 */
export interface DedupeMatchInput {
  entity_type: 'client' | 'property' | 'copropriete'
  staging_entity_id: string
  existing_entity_id: string
  confidence_score: number
  match_reasons: MatchReason[]
}

// ============================================================================
// LEVENSHTEIN (maison, ~20 lignes)
// ============================================================================

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const prev: number[] = new Array(b.length + 1).fill(0)
  for (let j = 0; j <= b.length; j++) prev[j] = j

  for (let i = 1; i <= a.length; i++) {
    let prevDiag = prev[0] ?? 0
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j] ?? 0
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      prev[j] = Math.min(
        (prev[j] ?? 0) + 1, // deletion
        (prev[j - 1] ?? 0) + 1, // insertion
        prevDiag + cost, // substitution
      )
      prevDiag = tmp
    }
  }
  return prev[b.length] ?? 0
}

function nameLevScore(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  const aNorm = a.trim().toLowerCase()
  const bNorm = b.trim().toLowerCase()
  if (aNorm === bNorm) return 1
  const maxLen = Math.max(aNorm.length, bNorm.length)
  if (maxLen === 0) return 0
  const distance = levenshtein(aNorm, bNorm)
  return Math.max(0, 1 - distance / maxLen)
}

// ============================================================================
// HAVERSINE (~10 lignes)
// ============================================================================

const EARTH_RADIUS_M = 6_371_000

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

function geoScore(
  aLat: number | null,
  aLng: number | null,
  bLat: number | null,
  bLng: number | null,
): { score: number; meters: number | null } {
  if (aLat === null || aLng === null || bLat === null || bLng === null) {
    return { score: 0, meters: null }
  }
  const meters = haversineMeters(aLat, aLng, bLat, bLng)
  if (meters < 50) return { score: 1, meters }
  if (meters < 500) return { score: 0.5, meters }
  return { score: 0, meters }
}

// ============================================================================
// CLIENTS
// ============================================================================

interface ClientStagingInput {
  staging_id: string
  data: NormalizedClient
  geocoded_lat: number | null
  geocoded_lng: number | null
}

export function findClientDuplicates(
  stagingClients: ClientStagingInput[],
  existing: ExistingClient[],
): DedupeMatchInput[] {
  const matches: DedupeMatchInput[] = []
  if (existing.length === 0) return matches

  for (const stagingItem of stagingClients) {
    const s = stagingItem.data
    let bestMatch: DedupeMatchInput | null = null

    for (const ex of existing) {
      const reasons: MatchReason[] = []

      const emailScore =
        s.email && ex.email && s.email.toLowerCase() === ex.email.toLowerCase() ? 1 : 0
      if (emailScore === 1) reasons.push('email_exact')

      const siretScore = s.siret && ex.siret && s.siret === ex.siret ? 1 : 0
      if (siretScore === 1) reasons.push('siret_exact')

      const phoneScore = s.phone && ex.phone && s.phone === ex.phone ? 1 : 0
      if (phoneScore === 1) reasons.push('phone_normalized')

      const nameLev = nameLevScore(s.display_name, ex.display_name)
      if (nameLev >= 0.85) reasons.push(`name_lev:${nameLev.toFixed(2)}`)

      const geoData = geoScore(stagingItem.geocoded_lat, stagingItem.geocoded_lng, null, null)
      // Pas de coords sur ExistingClient pour l'instant — placeholder 0
      if (geoData.score > 0 && geoData.meters !== null) {
        reasons.push(`geo:${Math.round(geoData.meters)}m`)
      }

      // Pondération
      const weighted =
        emailScore * 0.35 +
        siretScore * 0.4 +
        phoneScore * 0.25 +
        nameLev * 0.15 +
        geoData.score * 0.1
      const totalWeight = 0.35 + 0.4 + 0.25 + 0.15 + 0.1 // = 1.25
      const normalized = weighted / totalWeight

      if (normalized >= IMPORT_LIMITS.DEDUPE_THRESHOLD_MIN) {
        if (!bestMatch || normalized > bestMatch.confidence_score) {
          bestMatch = {
            entity_type: 'client',
            staging_entity_id: stagingItem.staging_id,
            existing_entity_id: ex.id,
            confidence_score: Math.round(normalized * 100) / 100,
            match_reasons: reasons,
          }
        }
      }
    }

    if (bestMatch) matches.push(bestMatch)
  }

  return matches
}

// ============================================================================
// PROPERTIES
// ============================================================================

interface PropertyStagingInput {
  staging_id: string
  data: NormalizedProperty
  geocoded_lat: number | null
  geocoded_lng: number | null
}

export function findPropertyDuplicates(
  stagingProps: PropertyStagingInput[],
  existing: ExistingProperty[],
): DedupeMatchInput[] {
  const matches: DedupeMatchInput[] = []
  if (existing.length === 0) return matches

  for (const stagingItem of stagingProps) {
    const s = stagingItem.data
    let bestMatch: DedupeMatchInput | null = null

    for (const ex of existing) {
      const reasons: MatchReason[] = []

      const geoData = geoScore(
        stagingItem.geocoded_lat,
        stagingItem.geocoded_lng,
        ex.location_lat,
        ex.location_lng,
      )
      let baseScore = 0

      if (geoData.meters !== null && geoData.meters <= 10) {
        // Géolocalisation très proche : on regarde la surface
        const surfaceA = s.surface_total ?? s.surface_carrez ?? null
        const surfaceB = ex.surface_total ?? ex.surface_carrez ?? null
        if (surfaceA !== null && surfaceB !== null) {
          const diff = Math.abs(surfaceA - surfaceB) / Math.max(surfaceA, surfaceB)
          if (diff <= 0.05) {
            baseScore = 1
            reasons.push(`geo:${Math.round(geoData.meters)}m`)
            reasons.push(`surface:${surfaceA.toFixed(0)}m2_vs_${surfaceB.toFixed(0)}m2`)
          } else {
            baseScore = 0.7
            reasons.push(`geo:${Math.round(geoData.meters)}m`)
          }
        } else {
          baseScore = 0.85
          reasons.push(`geo:${Math.round(geoData.meters)}m`)
        }
      } else if (geoData.meters !== null && geoData.meters < 500) {
        baseScore = 0.4
        reasons.push(`geo:${Math.round(geoData.meters)}m`)
      } else {
        // Pas de géo proche : on tente une dist lev sur l'adresse
        const lev = nameLevScore(s.address, ex.address)
        const cityMatch =
          s.city && ex.city && s.city.toLowerCase() === ex.city.toLowerCase() ? 1 : 0
        const postalMatch =
          s.postal_code && ex.postal_code && s.postal_code === ex.postal_code ? 1 : 0
        baseScore = lev * 0.7 + cityMatch * 0.15 + postalMatch * 0.15
        if (lev >= 0.7) reasons.push(`name_lev:${lev.toFixed(2)}`)
      }

      if (baseScore >= IMPORT_LIMITS.DEDUPE_THRESHOLD_MIN) {
        if (!bestMatch || baseScore > bestMatch.confidence_score) {
          bestMatch = {
            entity_type: 'property',
            staging_entity_id: stagingItem.staging_id,
            existing_entity_id: ex.id,
            confidence_score: Math.round(baseScore * 100) / 100,
            match_reasons: reasons,
          }
        }
      }
    }

    if (bestMatch) matches.push(bestMatch)
  }

  return matches
}

// ============================================================================
// COPROPRIETES
// ============================================================================

interface CoproStagingInput {
  staging_id: string
  data: NormalizedCopropriete
}

export function findCopropriereDuplicates(
  stagingCopros: CoproStagingInput[],
  existing: ExistingCopropriete[],
): DedupeMatchInput[] {
  const matches: DedupeMatchInput[] = []
  if (existing.length === 0) return matches

  for (const stagingItem of stagingCopros) {
    const s = stagingItem.data
    let bestMatch: DedupeMatchInput | null = null

    for (const ex of existing) {
      const reasons: MatchReason[] = []

      // RNIC exact = match parfait
      if (s.rnic_number && ex.rnic_number && s.rnic_number === ex.rnic_number) {
        reasons.push('rnic_exact')
        bestMatch = {
          entity_type: 'copropriete',
          staging_entity_id: stagingItem.staging_id,
          existing_entity_id: ex.id,
          confidence_score: 1.0,
          match_reasons: reasons,
        }
        break
      }

      const nameLev = nameLevScore(s.name, ex.name)
      const addressLev = nameLevScore(s.address, ex.address)
      const cityMatch = s.city && ex.city && s.city.toLowerCase() === ex.city.toLowerCase() ? 1 : 0

      const score = nameLev * 0.5 + addressLev * 0.3 + cityMatch * 0.2
      if (nameLev >= 0.8) reasons.push(`name_lev:${nameLev.toFixed(2)}`)
      if (addressLev >= 0.7) reasons.push(`address_lev:${addressLev.toFixed(2)}`)

      if (score >= IMPORT_LIMITS.DEDUPE_THRESHOLD_MIN) {
        if (!bestMatch || score > bestMatch.confidence_score) {
          bestMatch = {
            entity_type: 'copropriete',
            staging_entity_id: stagingItem.staging_id,
            existing_entity_id: ex.id,
            confidence_score: Math.round(score * 100) / 100,
            match_reasons: reasons,
          }
        }
      }
    }

    if (bestMatch) matches.push(bestMatch)
  }

  return matches
}
