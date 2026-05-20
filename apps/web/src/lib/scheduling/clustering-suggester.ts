/**
 * KOVAS — Suggestion de clustering géographique.
 *
 * Cherche dans les ±7 jours autour de la mission proposée s'il existe un autre
 * jour où l'utilisateur a déjà ≥ 2 rendez-vous dans un rayon de `radiusKm`
 * (défaut 5 km) autour de la nouvelle mission. Si oui, suggère de déplacer
 * pour économiser du temps de trajet.
 *
 * Spec : briefing scheduling 2026-05-20 — pattern "regrouper par zone".
 */

import { parisDayBounds } from '@/lib/paris-dates'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConflictMission } from './conflict-detector'
import { haversineMeters } from './route-calculator'

const DEFAULT_RADIUS_KM = 5
const SEARCH_WINDOW_DAYS = 7
const MIN_MISSIONS_FOR_CLUSTER = 2
/** Estimation grossière temps de trajet économisé par mission groupée. */
const AVG_TRAVEL_SAVED_MIN_PER_MISSION = 25

export interface ClusteringOpportunity {
  type: 'cluster_existing_day' | 'cluster_proposed_day'
  date: Date
  nearbyMissions: ConflictMission[]
  averageDistanceKm: number
  potentialSavingsMin: number
  /** Texte FR sobre user-friendly. */
  recommendation: string
}

export interface DetectClusteringInput {
  userId: string
  newMission: { geoLat: number; geoLng: number; startAt: Date }
  radiusKm?: number
}

interface NearbyDossierRow {
  id: string
  reference: string
  scheduled_at: string
  status: string
  geo_lat: number | null
  geo_lng: number | null
  estimated_duration_min: number | null
  forced_duration_min: number | null
  properties: { address: string | null; city: string | null } | null
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

/**
 * Renvoie le jour Europe/Paris au format YYYY-MM-DD (clef de groupage).
 */
function parisYmd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function shortAddress(row: NearbyDossierRow): string {
  const addr = row.properties?.address ?? ''
  const city = row.properties?.city ?? ''
  if (addr && city) return `${addr}, ${city}`
  return addr || city || row.reference
}

function toConflictMissionFromRow(row: NearbyDossierRow): ConflictMission | null {
  if (row.geo_lat === null || row.geo_lng === null) return null
  const startAt = new Date(row.scheduled_at)
  const dur = row.forced_duration_min ?? row.estimated_duration_min ?? 60
  return {
    id: row.id,
    reference: row.reference,
    addressShort: shortAddress(row),
    startAt,
    endAt: new Date(startAt.getTime() + dur * 60_000),
    geoLat: Number(row.geo_lat),
    geoLng: Number(row.geo_lng),
  }
}

/**
 * Texte FR sobre — voir avatar-client.md (vouvoiement, ton professionnel).
 */
function buildRecommendation(args: {
  count: number
  date: Date
  averageDistanceKm: number
}): string {
  const dayLabel = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(args.date)
  const distLabel = args.averageDistanceKm.toFixed(1).replace('.', ',')
  return `Déplacer ce rendez-vous au ${dayLabel} permettrait de le regrouper avec ${args.count} autres déjà planifiés à environ ${distLabel} km.`
}

/**
 * Détecte une opportunité de clustering autour de la mission proposée.
 *
 * Returns `null` si :
 *  - aucun jour dans ±7 jours n'a ≥ 2 missions dans le rayon
 *  - ou si le meilleur jour est le jour proposé lui-même
 */
export async function detectClusteringOpportunity(
  input: DetectClusteringInput,
  supabase: SupabaseClient,
): Promise<ClusteringOpportunity | null> {
  const radiusKm = input.radiusKm ?? DEFAULT_RADIUS_KM
  const radiusMeters = radiusKm * 1000
  const { userId, newMission } = input

  const startWindow = addDays(newMission.startAt, -SEARCH_WINDOW_DAYS)
  const endWindow = addDays(newMission.startAt, SEARCH_WINDOW_DAYS)

  const startIso = parisDayBounds(startWindow).startIso
  const endIso = parisDayBounds(endWindow).endIso

  const { data, error } = await supabase
    .from('dossiers')
    .select(
      `
      id,
      reference,
      scheduled_at,
      status,
      geo_lat,
      geo_lng,
      estimated_duration_min,
      forced_duration_min,
      assigned_to,
      created_by,
      properties!inner ( address, city )
    `,
    )
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)
    .not('scheduled_at', 'is', null)
    .not('geo_lat', 'is', null)
    .neq('status', 'cancelled')
    .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)

  if (error || !data) return null

  const rows = data as unknown as NearbyDossierRow[]

  // Filtre par distance
  const within = rows
    .map((row) => {
      const m = toConflictMissionFromRow(row)
      if (!m) return null
      const d = haversineMeters(
        { lat: newMission.geoLat, lng: newMission.geoLng },
        { lat: m.geoLat, lng: m.geoLng },
      )
      return d <= radiusMeters ? { mission: m, distanceMeters: d } : null
    })
    .filter((x): x is { mission: ConflictMission; distanceMeters: number } => x !== null)

  if (within.length === 0) return null

  // Group by jour Europe/Paris
  const proposedYmd = parisYmd(newMission.startAt)
  const byDay = new Map<string, Array<{ mission: ConflictMission; distanceMeters: number }>>()
  for (const item of within) {
    const ymd = parisYmd(item.mission.startAt)
    const list = byDay.get(ymd) ?? []
    list.push(item)
    byDay.set(ymd, list)
  }

  // Trouve le meilleur jour autre que celui proposé avec ≥ 2 missions
  let bestYmd: string | null = null
  let bestCount = 0
  for (const [ymd, items] of byDay.entries()) {
    if (ymd === proposedYmd) continue
    if (items.length >= MIN_MISSIONS_FOR_CLUSTER && items.length > bestCount) {
      bestYmd = ymd
      bestCount = items.length
    }
  }

  if (!bestYmd) return null

  const bestItems = byDay.get(bestYmd) ?? []
  const avgMeters =
    bestItems.reduce((acc, i) => acc + i.distanceMeters, 0) / Math.max(1, bestItems.length)
  const averageDistanceKm = Math.round((avgMeters / 1000) * 10) / 10

  // Date du best day : prendre le startAt de la 1re mission de ce jour
  const bestDate = bestItems[0]?.mission.startAt ?? newMission.startAt

  return {
    type: 'cluster_existing_day',
    date: bestDate,
    nearbyMissions: bestItems.map((i) => i.mission),
    averageDistanceKm,
    potentialSavingsMin: bestCount * AVG_TRAVEL_SAVED_MIN_PER_MISSION,
    recommendation: buildRecommendation({
      count: bestCount,
      date: bestDate,
      averageDistanceKm,
    }),
  }
}
