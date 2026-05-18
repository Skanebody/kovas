import { format, formatRelative, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

/**
 * Convention D310 (DISCOVERY.md) — Stockage dates :
 * - Storage : UTC ISO 8601 (timestamptz Postgres)
 * - Display : Intl.DateTimeFormat('fr-FR') ou date-fns avec locale fr
 * - Timezone utilisateur : default Europe/Paris (stockée explicitement dans `profiles.timezone`)
 */

export function formatDateFR(date: Date | string, dateFormat = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, dateFormat, { locale: fr })
}

export function formatDateTimeFR(
  date: Date | string,
  dateFormat = "dd/MM/yyyy 'à' HH:mm",
): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, dateFormat, { locale: fr })
}

export function formatRelativeFR(date: Date | string, baseDate: Date = new Date()): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatRelative(d, baseDate, { locale: fr })
}

export function toISOString(date: Date): string {
  return date.toISOString()
}
