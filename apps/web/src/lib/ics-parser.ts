/**
 * Parser .ics maison (RFC 5545 minimal subset).
 *
 * Objectif : lire un fichier .ics exporté depuis Google Calendar, Apple
 * Calendar ou Outlook et en extraire la liste des VEVENT pour proposer la
 * création de dossiers KOVAS.
 *
 * Hors scope (V1) :
 *  - VTODO, VJOURNAL, VFREEBUSY → ignorés silencieusement
 *  - RRULE (récurrences) → seule la première occurrence DTSTART est lue
 *  - VTIMEZONE custom → on lit TZID en label seulement, pas de translation DST
 *  - Pièces jointes (ATTACH binaires base64)
 *
 * Gère :
 *  - Line continuations RFC 5545 (lignes commençant par espace/tab)
 *  - DTSTART/DTEND aux 3 formes : YYYYMMDDTHHMMSSZ (UTC), YYYYMMDDTHHMMSS
 *    (local), TZID=...:YYYYMMDDTHHMMSS (local + TZ label), date-only
 *    YYYYMMDD (all-day)
 *  - Unescape \\n → \n, \\, → ,, \\; → ;, \\\\ → \\
 *  - Newlines CRLF (RFC) ou LF (clients lax)
 */

export interface ParsedIcsEvent {
  /** UID unique de l'event tel qu'écrit dans le .ics, ou fallback `unknown-{index}` */
  uid: string
  /** SUMMARY (titre) — string vide si manquant */
  summary: string
  /** DESCRIPTION libre, multi-ligne via \n */
  description?: string
  /** LOCATION (adresse libre) */
  location?: string
  /** Date de début (UTC interprétée) */
  dtstart: Date
  /** Date de fin (UTC interprétée), absente si l'event n'a pas DTEND */
  dtend?: Date
  /** URL canonique de l'event (lien retour) */
  url?: string
  /** True si DTSTART était au format date-only (YYYYMMDD), donc all-day */
  allDay: boolean
}

/**
 * Parse une string .ics et retourne tous les VEVENT valides.
 * Throws une erreur si le contenu ne ressemble pas du tout à un .ics.
 */
export function parseIcsContent(text: string): ParsedIcsEvent[] {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('Fichier .ics vide')
  }
  // Strip BOM éventuel (Notepad Windows)
  const stripped = text.replace(/^﻿/, '')
  if (!stripped.includes('BEGIN:VCALENDAR')) {
    throw new Error('Fichier non reconnu — la balise BEGIN:VCALENDAR est absente')
  }

  // 1. Normaliser les newlines : CRLF ou LF
  // 2. Unfold les line continuations (ligne suivante commence par ' ' ou '\t')
  const lines = unfoldLines(stripped.split(/\r\n|\n/))

  const events: ParsedIcsEvent[] = []
  let i = 0
  let unknownCounter = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (line === 'BEGIN:VEVENT') {
      const end = findBlockEnd(lines, i, 'VEVENT')
      if (end > i) {
        const ev = parseVevent(lines.slice(i + 1, end))
        if (ev) {
          if (!ev.uid) {
            unknownCounter += 1
            ev.uid = `kovas-unknown-${unknownCounter}`
          }
          events.push(ev)
        }
        i = end + 1
        continue
      }
    }
    i += 1
  }

  return events
}

/**
 * Unfold RFC 5545 : une ligne commençant par ' ' ou '\t' est la suite de la
 * précédente. Strip le caractère de continuation.
 */
function unfoldLines(rawLines: string[]): string[] {
  const out: string[] = []
  for (const raw of rawLines) {
    if (out.length > 0 && (raw.startsWith(' ') || raw.startsWith('\t'))) {
      out[out.length - 1] = (out[out.length - 1] ?? '') + raw.slice(1)
    } else {
      out.push(raw)
    }
  }
  return out
}

function findBlockEnd(lines: string[], start: number, kind: string): number {
  const endTag = `END:${kind}`
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i] === endTag) return i
  }
  return -1
}

function parseVevent(body: string[]): ParsedIcsEvent | null {
  const props = new Map<string, { params: Record<string, string>; value: string }>()
  for (const line of body) {
    if (line === '' || line.startsWith('BEGIN:') || line.startsWith('END:')) continue
    const parsed = parseProperty(line)
    if (parsed) props.set(parsed.name, { params: parsed.params, value: parsed.value })
  }

  const dtstartRaw = props.get('DTSTART')
  if (!dtstartRaw) return null
  const dtstart = parseIcsDate(dtstartRaw.value, dtstartRaw.params)
  if (!dtstart) return null

  const dtendRaw = props.get('DTEND')
  const dtend = dtendRaw ? parseIcsDate(dtendRaw.value, dtendRaw.params) : null

  const allDay = !dtstartRaw.value.includes('T')

  return {
    uid: unescapeIcsText(props.get('UID')?.value ?? ''),
    summary: unescapeIcsText(props.get('SUMMARY')?.value ?? ''),
    description: props.has('DESCRIPTION')
      ? unescapeIcsText(props.get('DESCRIPTION')?.value ?? '')
      : undefined,
    location: props.has('LOCATION')
      ? unescapeIcsText(props.get('LOCATION')?.value ?? '')
      : undefined,
    url: props.has('URL') ? props.get('URL')?.value : undefined,
    dtstart,
    dtend: dtend ?? undefined,
    allDay,
  }
}

interface ParsedProperty {
  name: string
  params: Record<string, string>
  value: string
}

/**
 * Parse une ligne de propriété RFC 5545 :
 *   NAME[;PARAM=VALUE[;PARAM=VALUE]...]:VALUE
 *
 * Exemples :
 *   DTSTART:20260520T100000Z
 *   DTSTART;TZID=Europe/Paris:20260520T100000
 *   SUMMARY;LANGUAGE=fr:Visite diagnostic
 */
function parseProperty(line: string): ParsedProperty | null {
  const colonIdx = findValueColon(line)
  if (colonIdx === -1) return null
  const leftSide = line.slice(0, colonIdx)
  const value = line.slice(colonIdx + 1)

  const segments = leftSide.split(';')
  const name = (segments[0] ?? '').toUpperCase()
  if (!name) return null
  const params: Record<string, string> = {}
  for (let i = 1; i < segments.length; i += 1) {
    const seg = segments[i] ?? ''
    const eq = seg.indexOf('=')
    if (eq > 0) {
      const key = seg.slice(0, eq).toUpperCase()
      // Strip quotes optionnelles RFC : "value"
      const raw = seg.slice(eq + 1)
      params[key] = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw
    }
  }
  return { name, params, value }
}

/**
 * Localise le 1er ':' qui n'est PAS à l'intérieur de guillemets de paramètre.
 * RFC 5545 autorise les guillemets pour params, ex.: ATTENDEE;CN="Foo:bar":...
 */
function findValueColon(line: string): number {
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]
    if (c === '"') inQuotes = !inQuotes
    else if (c === ':' && !inQuotes) return i
  }
  return -1
}

/**
 * Parse une date ICS dans toutes les variantes courantes.
 * Retourne un objet Date interprété comme un instant UTC.
 *
 *  - "20260520T100000Z" → UTC (suffixe Z)
 *  - "20260520T100000" sans TZID → interprété comme local user → converti UTC
 *    via Date constructor (Date( y, m-1, d, h, min, s ))
 *  - "20260520T100000" + TZID=Europe/Paris → on assume FR (CET/CEST). Pour V1
 *    on traite via Date local user — c'est une approximation acceptable
 *    quand l'utilisateur est en Europe/Paris (~99% des users KOVAS, cf.
 *    `paris-dates.ts`).
 *  - "20260520" → all-day, midnight local
 */
function parseIcsDate(raw: string, _params: Record<string, string>): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(raw)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  const day = Number(m[3])
  const hour = m[4] ? Number(m[4]) : 0
  const minute = m[5] ? Number(m[5]) : 0
  const second = m[6] ? Number(m[6]) : 0
  const isUtc = m[7] === 'Z'

  if (isUtc) {
    return new Date(Date.UTC(year, month, day, hour, minute, second))
  }
  // Sinon : on l'interprète en heure locale utilisateur (suffisant V1).
  // Si TZID = Europe/Paris et user en Europe/Paris → exact.
  // Si TZID = America/New_York et user en Europe/Paris → écart présent, mais
  // ce cas est marginal pour KOVAS et l'utilisateur peut corriger à la main.
  return new Date(year, month, day, hour, minute, second)
}

/**
 * Inverse de l'escape RFC 5545 utilisé dans ics.ts.
 */
function unescapeIcsText(text: string): string {
  // L'ordre compte : \\ doit être traité en dernier pour ne pas
  // ré-écraser des séquences déjà unescapées.
  return text
    .replace(/\\N/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}
