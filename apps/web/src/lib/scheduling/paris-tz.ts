/**
 * KOVAS — Helpers timezone Europe/Paris (purs, server-safe).
 *
 * Extraits le 2026-05-23 depuis `app/dashboard/dossiers/new/dossier-wizard.tsx`
 * (qui était `'use client'`) pour qu'ils puissent être importés depuis des
 * Server Components ou des routes API sans pollution client.
 *
 * Aucune dépendance React / DOM / window — `Intl.DateTimeFormat` est universel.
 */

/**
 * Compose un ISO 8601 UTC à partir d'une date `YYYY-MM-DD` et d'une heure
 * `HH:MM` exprimées dans le fuseau Europe/Paris (gère DST automatiquement).
 *
 * Retourne `null` si l'un des deux formats est invalide — le caller doit
 * vérifier avant de l'utiliser comme `scheduled_at` en base.
 */
export function makeIsoFromYmdHm(ymd: string, hm: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !/^\d{2}:\d{2}$/.test(hm)) return null
  const probe = new Date(`${ymd}T12:00:00Z`)
  if (Number.isNaN(probe.getTime())) return null
  const offsetParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'longOffset',
  }).formatToParts(probe)
  const raw = offsetParts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  const m = raw.match(/([+-])(\d{1,2})(?::(\d{2}))?/)
  const sign = m?.[1] ?? '+'
  const hh = (m?.[2] ?? '01').padStart(2, '0')
  const mm = (m?.[3] ?? '00').padStart(2, '0')
  return new Date(`${ymd}T${hm}:00${sign}${hh}:${mm}`).toISOString()
}

/**
 * Formate une Date en `YYYY-MM-DD` (timezone Europe/Paris).
 */
export function toParisYmd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Formate une Date en `HH:MM` 24h (timezone Europe/Paris).
 */
export function toParisHm(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}
