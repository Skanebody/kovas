/**
 * KOVAS — Recherche de créneaux libres dans une journée donnée.
 *
 * Génère des slots toutes les 30 min entre 08:00 et 19:00 (Europe/Paris) et
 * marque chaque slot available=true/false selon overlap direct avec missions
 * existantes. Les marges de trajet ne sont PAS calculées ici (perf), elles
 * sont vérifiées via conflict-detector côté form au moment de la sélection.
 *
 * Variante findBestSlotInDay : cherche le 1er créneau libre avec assez de
 * marge si une position préférée (lat/lng) est fournie.
 */

import { parisDayBounds } from '@/lib/paris-dates'
import type { SupabaseClient } from '@supabase/supabase-js'
import { detectConflict } from './conflict-detector'

const SLOT_INTERVAL_MIN = 30
const DAY_START_HOUR = 8
const DAY_END_HOUR = 19

export interface Slot {
  startAt: Date
  endAt: Date
  marginBefore: number
  marginAfter: number
}

export interface AvailableSlot {
  /** Format 'HH:MM' Europe/Paris. */
  startTime: string
  endTime: string
  available: boolean
  conflict?: { with: string; type: 'too-tight' | 'overlap' }
}

interface DossierSlotRow {
  id: string
  reference: string
  scheduled_at: string
  estimated_duration_min: number | null
  forced_duration_min: number | null
}

/**
 * Formate un Date en 'HH:MM' Europe/Paris.
 */
function toParisHHMM(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/**
 * Décale `date` à l'heure parisienne HH:MM via offset IANA dynamique.
 */
function setParisTimeOnDate(date: Date, hour: number, minute: number): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

  // Offset Paris à cette date (gère bascule CET/CEST)
  const offsetParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'longOffset',
  }).formatToParts(date)
  const raw = offsetParts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  const m = raw.match(/([+-])(\d{1,2})(?::(\d{2}))?/)
  const sign = m?.[1] ?? '+'
  const hh = (m?.[2] ?? '01').padStart(2, '0')
  const mm = (m?.[3] ?? '00').padStart(2, '0')
  const offset = `${sign}${hh}:${mm}`

  const hhPad = String(hour).padStart(2, '0')
  const mmPad = String(minute).padStart(2, '0')
  return new Date(`${ymd}T${hhPad}:${mmPad}:00.000${offset}`)
}

/**
 * Liste tous les slots HH:00 / HH:30 entre 08:00 et 19:00 Europe/Paris.
 */
function generateDailySlots(date: Date, durationMin: number): Slot[] {
  const slots: Slot[] = []
  for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_INTERVAL_MIN) {
      const startAt = setParisTimeOnDate(date, h, m)
      const endAt = new Date(startAt.getTime() + durationMin * 60_000)
      // Skip slots dont la fin déborde après 19:00
      const endHour = Number.parseInt(toParisHHMM(endAt).split(':')[0] ?? '0', 10)
      if (endHour >= DAY_END_HOUR + 1) continue
      slots.push({ startAt, endAt, marginBefore: 0, marginAfter: 0 })
    }
  }
  return slots
}

/**
 * Cherche les créneaux libres dans la journée. V1 : check overlap direct
 * uniquement, marges trajet à vérifier côté form via detectConflict.
 */
export async function findAvailableSlots(
  userId: string,
  date: Date,
  durationMin: number,
  supabase: SupabaseClient,
): Promise<AvailableSlot[]> {
  const { startIso, endIso } = parisDayBounds(date)

  const { data, error } = await supabase
    .from('dossiers')
    .select(
      `
      id,
      reference,
      scheduled_at,
      estimated_duration_min,
      forced_duration_min,
      assigned_to,
      created_by,
      status
    `,
    )
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)
    .not('scheduled_at', 'is', null)
    .neq('status', 'cancelled')
    .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
    .order('scheduled_at', { ascending: true })

  if (error) {
    throw new Error(`findAvailableSlots: ${error.message}`)
  }

  const rows = (data ?? []) as unknown as DossierSlotRow[]

  const occupied = rows
    .filter((r) => r.scheduled_at !== null)
    .map((r) => {
      const startAt = new Date(r.scheduled_at)
      const dur = r.forced_duration_min ?? r.estimated_duration_min ?? 60
      return {
        ref: r.reference,
        startAt,
        endAt: new Date(startAt.getTime() + dur * 60_000),
      }
    })

  const slots = generateDailySlots(date, durationMin)

  return slots.map<AvailableSlot>((s) => {
    const overlap = occupied.find((o) => s.startAt < o.endAt && s.endAt > o.startAt)
    if (overlap) {
      return {
        startTime: toParisHHMM(s.startAt),
        endTime: toParisHHMM(s.endAt),
        available: false,
        conflict: { with: overlap.ref, type: 'overlap' },
      }
    }
    return {
      startTime: toParisHHMM(s.startAt),
      endTime: toParisHHMM(s.endAt),
      available: true,
    }
  })
}

export interface FindBestSlotInput {
  userId: string
  date: Date
  durationMin: number
  preferredLat?: number
  preferredLng?: number
  supabase: SupabaseClient
}

/**
 * Trouve le 1er slot libre avec marge suffisante. Si preferredLat/Lng fourni,
 * vérifie aussi les conflits de trajet via detectConflict. Sinon : 1er slot
 * disponible (overlap-free).
 */
export async function findBestSlotInDay(input: FindBestSlotInput): Promise<Slot | null> {
  const { userId, date, durationMin, preferredLat, preferredLng, supabase } = input

  const slots = await findAvailableSlots(userId, date, durationMin, supabase)
  const candidates = slots.filter((s) => s.available)

  if (candidates.length === 0) return null

  for (const candidate of candidates) {
    const [hStr = '0', mStr = '0'] = candidate.startTime.split(':')
    const hour = Number.parseInt(hStr, 10)
    const minute = Number.parseInt(mStr, 10)
    const startAt = setParisTimeOnDate(date, hour, minute)
    const endAt = new Date(startAt.getTime() + durationMin * 60_000)

    // Si pas de coords préférées : 1er slot libre suffit
    if (preferredLat === undefined || preferredLng === undefined) {
      return { startAt, endAt, marginBefore: 0, marginAfter: 0 }
    }

    // Sinon check marges via detectConflict
    const result = await detectConflict(
      {
        userId,
        newMission: {
          geoLat: preferredLat,
          geoLng: preferredLng,
          startAt,
          estimatedDurationMin: durationMin,
        },
      },
      supabase,
    )
    if (!result.hasConflict) {
      const marginBefore =
        result.conflicts.find((c) => c.type === 'too-tight-after-previous')?.marginMin ?? 0
      const marginAfter =
        result.conflicts.find((c) => c.type === 'too-tight-before-next')?.marginMin ?? 0
      return { startAt, endAt, marginBefore, marginAfter }
    }
  }

  return null
}
