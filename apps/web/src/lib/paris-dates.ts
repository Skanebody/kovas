/** Bornes calendaires Europe/Paris (CET/CEST) pour filtres Supabase. */

function parisYmd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function parisYm(date: Date): { year: string; month: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  return {
    year: parts.find((p) => p.type === 'year')?.value ?? '1970',
    month: parts.find((p) => p.type === 'month')?.value ?? '01',
  }
}

/** Offset IANA à l'instant donné, ex. "+01:00" ou "+02:00". */
function parisUtcOffset(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'longOffset',
  }).formatToParts(date)
  const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  const m = raw.match(/([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!m) return '+01:00'
  const sign = m[1]
  const hh = m[2]!.padStart(2, '0')
  const mm = (m[3] ?? '00').padStart(2, '0')
  return `${sign}${hh}:${mm}`
}

function parisLocalToUtc(isoLocal: string, ref: Date): Date {
  const offset = parisUtcOffset(ref)
  return new Date(`${isoLocal}${offset}`)
}

/** Début et fin du jour civil à Paris (ISO UTC). */
export function parisDayBounds(date: Date = new Date()): { startIso: string; endIso: string } {
  const ymd = parisYmd(date)
  const start = parisLocalToUtc(`${ymd}T00:00:00.000`, date)
  const end = parisLocalToUtc(`${ymd}T23:59:59.999`, date)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

/** Premier jour du mois civil à Paris et premier jour du mois suivant (ISO UTC). */
export function parisMonthBounds(date: Date = new Date()): { startIso: string; nextIso: string } {
  const { year, month } = parisYm(date)
  const y = Number.parseInt(year, 10)
  const m = Number.parseInt(month, 10)
  const nextM = m === 12 ? 1 : m + 1
  const nextY = m === 12 ? y + 1 : y
  const start = parisLocalToUtc(`${year}-${month}-01T00:00:00.000`, date)
  const next = parisLocalToUtc(`${nextY}-${String(nextM).padStart(2, '0')}-01T00:00:00.000`, date)
  return { startIso: start.toISOString(), nextIso: next.toISOString() }
}
