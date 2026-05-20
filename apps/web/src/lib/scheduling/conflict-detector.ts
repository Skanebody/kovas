/**
 * KOVAS — Détection de conflits géographiques entre missions d'un même jour.
 *
 * Spec : briefing scheduling 2026-05-20 §4 + CLAUDE.md §3 feature 10.
 *
 * Pour une mission nouvelle (lat/lng + startAt + durée), on regarde les dossiers
 * du même jour (Europe/Paris) de l'utilisateur et on calcule :
 *  - travel time vers la mission précédente la plus proche
 *  - travel time depuis la mission suivante la plus proche
 *  - chevauchement direct (overlap)
 *
 * marginMin = availableMin - travelMin.
 *  - marginMin < 0  →  conflit (critical si < -15, warning sinon)
 *  - overlap direct →  conflit critical
 */

import { parisDayBounds } from '@/lib/paris-dates'
import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateRoute } from './route-calculator'

const DEFAULT_BUFFER_MIN = 15
const CRITICAL_THRESHOLD_MIN = -15

export interface ConflictDetectionInput {
  userId: string
  newMission: {
    geoLat: number
    geoLng: number
    startAt: Date
    estimatedDurationMin: number
    /** Si présent : pour exclure cette mission de la liste des conflits (édition). */
    excludeDossierId?: string
  }
  /** Marge minimale entre missions (minutes). Défaut 15. */
  bufferMinutes?: number
}

export type ConflictType = 'too-tight-after-previous' | 'too-tight-before-next' | 'overlap'
export type ConflictSeverity = 'critical' | 'warning'

export interface ConflictMission {
  id: string
  reference: string
  addressShort: string
  startAt: Date
  endAt: Date
  geoLat: number
  geoLng: number
}

export interface Conflict {
  type: ConflictType
  severity: ConflictSeverity
  previousMission?: ConflictMission
  nextMission?: ConflictMission
  travelMin: number
  availableMin: number
  /** Marge effective restante : <0 = pas le temps, >0 = marge confortable. */
  marginMin: number
}

export interface ConflictResult {
  hasConflict: boolean
  conflicts: Conflict[]
}

/**
 * Représentation interne d'un dossier candidat à conflit, normalisée
 * (les colonnes geo_lat / geo_lng / estimated_duration_min sont issues
 * de la migration scheduling — pas encore dans le Database type).
 */
interface DossierRow {
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

/**
 * Format adresse court pour UX : "12 rue de Paris, Dieppe".
 */
function shortAddress(row: DossierRow): string {
  const addr = row.properties?.address ?? ''
  const city = row.properties?.city ?? ''
  if (addr && city) return `${addr}, ${city}`
  return addr || city || row.reference
}

/**
 * Sérialise un dossier DB → ConflictMission (avec startAt/endAt computés).
 */
function toConflictMission(row: DossierRow): ConflictMission | null {
  if (row.geo_lat === null || row.geo_lng === null || !row.scheduled_at) return null

  const startAt = new Date(row.scheduled_at)
  const durationMin = row.forced_duration_min ?? row.estimated_duration_min ?? 60
  const endAt = new Date(startAt.getTime() + durationMin * 60_000)

  return {
    id: row.id,
    reference: row.reference,
    addressShort: shortAddress(row),
    startAt,
    endAt,
    geoLat: Number(row.geo_lat),
    geoLng: Number(row.geo_lng),
  }
}

/**
 * Détecte les conflits géographiques entre la mission proposée et les missions
 * existantes du même jour.
 */
export async function detectConflict(
  input: ConflictDetectionInput,
  supabase: SupabaseClient,
): Promise<ConflictResult> {
  const buffer = input.bufferMinutes ?? DEFAULT_BUFFER_MIN
  const { newMission } = input

  const newStartAt = newMission.startAt
  const newEndAt = new Date(newStartAt.getTime() + newMission.estimatedDurationMin * 60_000)

  // 1. Récupérer les dossiers du même jour Europe/Paris assignés à l'utilisateur
  const { startIso, endIso } = parisDayBounds(newStartAt)

  // Cast typé : colonnes geo_* / estimated_duration_min absentes du Database type
  // (migration 20260522120000_scheduling.sql, types pas encore régénérés).
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
    .neq('status', 'cancelled')
    .or(`assigned_to.eq.${input.userId},created_by.eq.${input.userId}`)
    .order('scheduled_at', { ascending: true })

  if (error) {
    throw new Error(`detectConflict: ${error.message}`)
  }

  const rows = (data ?? []) as unknown as DossierRow[]

  const sameDayMissions = rows
    .filter((r) => r.id !== input.newMission.excludeDossierId)
    .map(toConflictMission)
    .filter((m): m is ConflictMission => m !== null)

  if (sameDayMissions.length === 0) {
    return { hasConflict: false, conflicts: [] }
  }

  const conflicts: Conflict[] = []

  // 2. Détecter overlap direct (chevauchement). Toujours critical.
  for (const m of sameDayMissions) {
    const overlap = newStartAt < m.endAt && newEndAt > m.startAt
    if (overlap) {
      conflicts.push({
        type: 'overlap',
        severity: 'critical',
        previousMission: m,
        travelMin: 0,
        availableMin: 0,
        marginMin: Math.round((m.endAt.getTime() - newStartAt.getTime()) / 60_000),
      })
    }
  }

  // 3. Mission précédente la plus proche (endAt <= newStartAt)
  const previous = sameDayMissions
    .filter((m) => m.endAt.getTime() <= newStartAt.getTime())
    .sort((a, b) => b.endAt.getTime() - a.endAt.getTime())[0]

  if (previous) {
    const route = await calculateRoute(
      { lat: previous.geoLat, lng: previous.geoLng },
      { lat: newMission.geoLat, lng: newMission.geoLng },
      supabase,
    )
    const availableMin = Math.floor((newStartAt.getTime() - previous.endAt.getTime()) / 60_000)
    const travelMin = route.duration_minutes
    const marginMin = availableMin - travelMin - buffer

    if (marginMin < 0) {
      conflicts.push({
        type: 'too-tight-after-previous',
        severity: marginMin < CRITICAL_THRESHOLD_MIN ? 'critical' : 'warning',
        previousMission: previous,
        travelMin,
        availableMin,
        marginMin,
      })
    }
  }

  // 4. Mission suivante la plus proche (startAt >= newEndAt)
  const next = sameDayMissions
    .filter((m) => m.startAt.getTime() >= newEndAt.getTime())
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0]

  if (next) {
    const route = await calculateRoute(
      { lat: newMission.geoLat, lng: newMission.geoLng },
      { lat: next.geoLat, lng: next.geoLng },
      supabase,
    )
    const availableMin = Math.floor((next.startAt.getTime() - newEndAt.getTime()) / 60_000)
    const travelMin = route.duration_minutes
    const marginMin = availableMin - travelMin - buffer

    if (marginMin < 0) {
      conflicts.push({
        type: 'too-tight-before-next',
        severity: marginMin < CRITICAL_THRESHOLD_MIN ? 'critical' : 'warning',
        nextMission: next,
        travelMin,
        availableMin,
        marginMin,
      })
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  }
}
