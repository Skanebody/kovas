/**
 * Génération de fichiers .ics (RFC 5545 iCalendar).
 * Permet à l'utilisateur d'importer un RDV KOVAS dans n'importe quel agenda
 * (Google Calendar, Apple Calendar, Outlook, Thunderbird, etc.) en un clic.
 *
 * Pas de dépendance — RFC 5545 est assez simple pour être généré à la main
 * pour notre cas d'usage (event unique, pas de recurrence complexe).
 */

interface IcsEvent {
  uid: string
  /** Date/heure début (Date JS, sera convertie en UTC) */
  start: Date
  /** Durée en minutes (60 par défaut). Une visite diagnostic dure ~1h-2h */
  durationMinutes?: number
  summary: string
  description?: string
  location?: string
  /** URL canonique de l'event (lien vers le dossier KOVAS) */
  url?: string
}

/**
 * Format date en UTC pour ICS : YYYYMMDDTHHMMSSZ.
 */
function toIcsDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${
    date.getUTCFullYear().toString() + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate())
  }T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

/**
 * Échappe les caractères spéciaux RFC 5545 dans une string de texte.
 */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

/**
 * Fold les lignes longues (RFC 5545 : 75 octets max par ligne, continue avec
 * un espace). Pour simplifier, on coupe à 73 chars (latin-1).
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = []
  let remaining = line
  chunks.push(remaining.slice(0, 75))
  remaining = remaining.slice(75)
  while (remaining.length > 0) {
    chunks.push(` ${remaining.slice(0, 74)}`)
    remaining = remaining.slice(74)
  }
  return chunks.join('\r\n')
}

function buildVevent(event: IcsEvent): string[] {
  const duration = event.durationMinutes ?? 60
  const end = new Date(event.start.getTime() + duration * 60_000)
  return [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(event.start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    event.description ? `DESCRIPTION:${escapeText(event.description)}` : null,
    event.location ? `LOCATION:${escapeText(event.location)}` : null,
    event.url ? `URL:${event.url}` : null,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
  ].filter((l): l is string => l !== null)
}

/**
 * Construit le contenu .ics complet pour un event unique.
 * Newline = CRLF (RFC 5545 strict).
 */
export function buildIcs(event: IcsEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KOVAS//Diagnostic Immobilier//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...buildVevent(event),
    'END:VCALENDAR',
  ]

  return `${lines.map(foldLine).join('\r\n')}\r\n`
}

/**
 * Construit le contenu .ics pour un calendrier multi-events.
 *
 * Sert d'endpoint d'abonnement (subscription URL) — l'utilisateur l'ajoute
 * dans Google Calendar / Apple Calendar / Outlook qui le rafraîchit
 * périodiquement.
 *
 * @param events liste d'events
 * @param meta   métadonnées du calendrier (nom, description) — affichées dans
 *               les clients calendrier (couleur, nom dans la sidebar, etc.)
 */
export function buildIcsCalendar(
  events: IcsEvent[],
  meta: { name: string; description?: string; refreshIntervalHours?: number } = {
    name: 'KOVAS',
  },
): string {
  const refreshMin = (meta.refreshIntervalHours ?? 1) * 60
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KOVAS//Diagnostic Immobilier//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `NAME:${escapeText(meta.name)}`,
    `X-WR-CALNAME:${escapeText(meta.name)}`,
    meta.description ? `X-WR-CALDESC:${escapeText(meta.description)}` : null,
    'X-WR-TIMEZONE:Europe/Paris',
    // Indique aux clients calendrier de rafraîchir périodiquement
    `REFRESH-INTERVAL;VALUE=DURATION:PT${refreshMin}M`,
    `X-PUBLISHED-TTL:PT${refreshMin}M`,
    ...events.flatMap((e) => buildVevent(e)),
    'END:VCALENDAR',
  ].filter((l): l is string => l !== null)

  return `${lines.map(foldLine).join('\r\n')}\r\n`
}

/**
 * Nom de fichier sain pour le téléchargement.
 */
export function icsFilename(reference: string): string {
  const safe = reference.replace(/[^a-zA-Z0-9-_]/g, '_')
  return `kovas-${safe}.ics`
}
