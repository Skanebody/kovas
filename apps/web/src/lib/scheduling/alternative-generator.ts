/**
 * KOVAS — Génération d'alternatives quand un conflit est détecté.
 *
 * Stratégies :
 *  1. Même jour, plus tard (1er slot libre du même jour)
 *  2. Jours suivants J+1 → J+maxDays (défaut 7)
 *  3. Pour chaque candidat, count missions dans 10 km (clustering bonus)
 *  4. Score = base 50 + 10×nearbyCount + 5 marge confortable - 10 si > 5j - 15 si > 10j
 *  5. Return top 3 trié par score desc
 *
 * Skip weekends si user_preferences.skip_weekends = true (lookup par userId).
 */

import { parisDayBounds } from '@/lib/paris-dates'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Conflict } from './conflict-detector'
import { haversineMeters } from './route-calculator'
import { findBestSlotInDay } from './slot-finder'

const DEFAULT_MAX_DAYS_AHEAD = 7
const NEARBY_RADIUS_KM = 10
const TOP_N = 3

export interface Alternative {
  date: Date
  startAt: Date
  endAt: Date
  /** Texte FR user-friendly expliquant pourquoi ce créneau est suggéré. */
  reasoning: string
  score: number
  savedTravelMin?: number
  nearbyMissionsCount?: number
}

export interface GenerateAlternativesInput {
  userId: string
  newMission: {
    geoLat: number
    geoLng: number
    /** Créneau initialement souhaité. */
    startAt: Date
    estimatedDurationMin: number
  }
  conflicts: Conflict[]
  maxDaysAhead?: number
}

interface NearbyDossierRow {
  id: string
  scheduled_at: string
  geo_lat: number | null
  geo_lng: number | null
}

interface UserPrefsRow {
  skip_weekends: boolean | null
}

interface CountInRadiusInput {
  userId: string
  date: Date
  centerLat: number
  centerLng: number
  radiusKm: number
  supabase: SupabaseClient
}

/**
 * Compte les missions de `userId` planifiées le jour `date` (Europe/Paris) et
 * situées dans un rayon `radiusKm` autour de (centerLat, centerLng).
 *
 * Algo : SELECT par date + geo_lat NOT NULL, filtre Haversine en JS (volume
 * faible — quelques missions/jour max).
 */
export async function countMissionsInRadius(input: CountInRadiusInput): Promise<number> {
  const { userId, date, centerLat, centerLng, radiusKm, supabase } = input
  const { startIso, endIso } = parisDayBounds(date)

  const { data, error } = await supabase
    .from('dossiers')
    .select('id, scheduled_at, geo_lat, geo_lng, assigned_to, created_by, status')
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)
    .not('scheduled_at', 'is', null)
    .not('geo_lat', 'is', null)
    .neq('status', 'cancelled')
    .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)

  if (error || !data) return 0

  const rows = data as unknown as NearbyDossierRow[]
  const radiusMeters = radiusKm * 1000

  return rows.filter((r) => {
    if (r.geo_lat === null || r.geo_lng === null) return false
    const d = haversineMeters(
      { lat: centerLat, lng: centerLng },
      { lat: Number(r.geo_lat), lng: Number(r.geo_lng) },
    )
    return d <= radiusMeters
  }).length
}

/**
 * Renvoie le jour UTC suivant à 00:00 Europe/Paris (utile pour itération J+N).
 */
function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

/**
 * 0 = dim, 6 = sam (Europe/Paris).
 */
function getParisWeekday(date: Date): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
  }).format(date)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(fmt)
}

async function getSkipWeekends(userId: string, supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('skip_weekends')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return true
  const prefs = data as unknown as UserPrefsRow
  return prefs.skip_weekends ?? true
}

/**
 * Score un créneau alternatif.
 *
 * - +10 par mission proche (clustering bonus)
 * - +5 si pas de conflit détecté (marge confortable)
 * - -10 si > 5 jours
 * - -15 si > 10 jours (cumulatif)
 */
function computeScore(args: {
  daysFromOriginal: number
  nearbyCount: number
  noConflict: boolean
}): number {
  let score = 50
  score += 10 * args.nearbyCount
  if (args.noConflict) score += 5
  if (args.daysFromOriginal > 5) score -= 10
  if (args.daysFromOriginal > 10) score -= 15
  return Math.max(0, Math.min(100, score))
}

/**
 * Bâtit un texte de justification FR sobre (cf. avatar client).
 */
function buildReasoning(args: {
  daysFromOriginal: number
  nearbyCount: number
  isSameDay: boolean
}): string {
  if (args.isSameDay) {
    return 'Créneau libre plus tard dans la même journée'
  }
  if (args.nearbyCount >= 2) {
    return `${args.nearbyCount} autres rendez-vous déjà planifiés dans la zone ce jour-là`
  }
  if (args.nearbyCount === 1) {
    return '1 autre rendez-vous dans la zone ce jour-là'
  }
  if (args.daysFromOriginal === 1) {
    return 'Lendemain, journée libre dans la zone'
  }
  return `Disponible à J+${args.daysFromOriginal}`
}

/**
 * Génère jusqu'à 3 alternatives triées par score décroissant.
 */
export async function generateAlternatives(
  input: GenerateAlternativesInput,
  supabase: SupabaseClient,
): Promise<Alternative[]> {
  const maxDays = input.maxDaysAhead ?? DEFAULT_MAX_DAYS_AHEAD
  const skipWeekends = await getSkipWeekends(input.userId, supabase)
  const { newMission } = input

  const candidates: Alternative[] = []

  // 1. Même jour, plus tard
  const sameDay = await findBestSlotInDay({
    userId: input.userId,
    date: newMission.startAt,
    durationMin: newMission.estimatedDurationMin,
    preferredLat: newMission.geoLat,
    preferredLng: newMission.geoLng,
    supabase,
  })
  if (sameDay && sameDay.startAt.getTime() > newMission.startAt.getTime()) {
    const nearbyCount = await countMissionsInRadius({
      userId: input.userId,
      date: sameDay.startAt,
      centerLat: newMission.geoLat,
      centerLng: newMission.geoLng,
      radiusKm: NEARBY_RADIUS_KM,
      supabase,
    })
    candidates.push({
      date: sameDay.startAt,
      startAt: sameDay.startAt,
      endAt: sameDay.endAt,
      reasoning: buildReasoning({ daysFromOriginal: 0, nearbyCount, isSameDay: true }),
      score: computeScore({ daysFromOriginal: 0, nearbyCount, noConflict: true }),
      nearbyMissionsCount: nearbyCount,
    })
  }

  // 2. Jours suivants J+1 → J+maxDays
  for (let dayOffset = 1; dayOffset <= maxDays; dayOffset++) {
    const candidateDate = addDays(newMission.startAt, dayOffset)
    const weekday = getParisWeekday(candidateDate)
    if (skipWeekends && (weekday === 0 || weekday === 6)) continue

    const slot = await findBestSlotInDay({
      userId: input.userId,
      date: candidateDate,
      durationMin: newMission.estimatedDurationMin,
      preferredLat: newMission.geoLat,
      preferredLng: newMission.geoLng,
      supabase,
    })
    if (!slot) continue

    const nearbyCount = await countMissionsInRadius({
      userId: input.userId,
      date: candidateDate,
      centerLat: newMission.geoLat,
      centerLng: newMission.geoLng,
      radiusKm: NEARBY_RADIUS_KM,
      supabase,
    })

    candidates.push({
      date: candidateDate,
      startAt: slot.startAt,
      endAt: slot.endAt,
      reasoning: buildReasoning({
        daysFromOriginal: dayOffset,
        nearbyCount,
        isSameDay: false,
      }),
      score: computeScore({
        daysFromOriginal: dayOffset,
        nearbyCount,
        noConflict: true,
      }),
      nearbyMissionsCount: nearbyCount,
    })
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, TOP_N)
}
