/**
 * KOVAS — Calendrier : types et constantes partagés entre vues.
 *
 * `CalendarEvent` est la forme normalisée passée à toutes les vues (jour,
 * semaine, mois, agenda). Le server component `/dashboard/calendar/page.tsx` fait
 * le mapping depuis Supabase + dossiers + properties (lat/lon optionnels).
 */

export interface CalendarEvent {
  dossierId: string
  reference: string
  scheduledAt: string // ISO UTC
  durationMinutes: number
  clientName: string | null
  address: string | null
  city: string | null
  missionTypes: string[]
  status: string
  /** Latitude WGS84 de la propriété (utilisé pour calcul trajets). */
  latitude: number | null
  /** Longitude WGS84. */
  longitude: number | null
}

/** Coordonnées d'origine de tournée (cabinet / domicile). V1 souvent null. */
export interface OriginCoords {
  lat: number
  lon: number
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  scheduled: 'Planifié',
  on_site: 'Sur place',
  back_office: 'Au bureau',
  done: 'Terminé',
  archived: 'Archivé',
  cancelled: 'Annulé',
}

export const STATUS_VARIANT: Record<
  string,
  'muted' | 'blue' | 'green' | 'orange' | 'amber' | 'red'
> = {
  draft: 'muted',
  scheduled: 'blue',
  on_site: 'amber',
  back_office: 'amber',
  done: 'green',
  archived: 'muted',
  cancelled: 'red',
}

/** Couleur de la border-left selon le statut — vue Jour iOS-style. */
export const STATUS_BORDER_COLOR: Record<string, string> = {
  draft: 'border-l-[#9CA3AF]',
  scheduled: 'border-l-chartreuse',
  on_site: 'border-l-accent-yellow',
  back_office: 'border-l-accent-yellow',
  done: 'border-l-accent-green',
  archived: 'border-l-[#9CA3AF]',
  cancelled: 'border-l-accent-red',
}

export const DAY_NAMES_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
export const DAY_NAMES_LONG = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
]
export const MONTH_NAMES = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

/** Plage horaire affichée timeline vue Jour. */
export const DAY_HOUR_START = 7
export const DAY_HOUR_END = 21
export const DAY_HOUR_COUNT = DAY_HOUR_END - DAY_HOUR_START // 14 heures

/** Hauteur d'une heure de timeline (desktop / mobile). */
export const HOUR_HEIGHT_DESKTOP = 60
export const HOUR_HEIGHT_MOBILE = 40

// =============================================================================
// Helpers date (purs, sans timezone library — Europe/Paris en pratique).
// =============================================================================

export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = sun, 1 = mon, ..., 6 = sat
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function startOfMonth(date: Date): Date {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isWeekend(date: Date): boolean {
  const d = date.getDay()
  return d === 0 || d === 6
}

/** Formate heure courte FR : "08:30". */
export function formatTimeFR(date: Date): string {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
}

/** Calcule l'offset en pixels d'un instant dans la timeline jour. */
export function pixelOffsetForTime(date: Date, hourHeight: number): number {
  const totalMinutes = date.getHours() * 60 + date.getMinutes()
  const startMinutes = DAY_HOUR_START * 60
  const offsetMin = totalMinutes - startMinutes
  return (offsetMin / 60) * hourHeight
}

/** Hauteur en pixels pour une durée en minutes. */
export function pixelHeightForDuration(durationMin: number, hourHeight: number): number {
  return (durationMin / 60) * hourHeight
}
