/**
 * KOVAS — Générateur vCard 3.0 conforme RFC 2426.
 *
 * Pourquoi vCard 3.0 et pas 4.0 :
 *   - Compatibilité quasi-universelle (iOS Camera, Android, Outlook, Google
 *     Contacts).
 *   - PHOTO embedded en BASE64 (b) supportée dès la 3.0 ; en 4.0 c'est URI
 *     data: ce qui casse certains lecteurs.
 *
 * Encodage des caractères spéciaux :
 *   - Échappement strict des caractères de contrôle vCard : `\`, `,`, `;`, `\n`.
 *   - UTF-8 brut pour les accents (CHARSET=UTF-8 sur les champs concernés).
 *   - Quoted-printable n'est PAS utilisé (deprecated en 3.0+, casse sur iOS).
 *
 * Folding (RFC 2426 §2.6) : ligne max 75 octets, continuation par CRLF + " ".
 *
 * Champs supportés (FR-first) :
 *   FN, N, ORG, TITLE, TEL (CELL / WORK), EMAIL (WORK / INTERNET),
 *   ADR (WORK), URL, NOTE, PHOTO (JPEG/PNG base64).
 */

export interface VCardInput {
  /** Prénom. */
  firstName: string
  /** Nom de famille. */
  lastName: string
  /** Titre professionnel (ex: "Diagnostiqueur immobilier certifié"). */
  title?: string
  /** Cabinet / société (raison sociale). */
  organization: string
  /** Email professionnel. */
  emailWork?: string
  /** Téléphone mobile, idéalement E.164 (`+33612345678`). */
  phoneMobile?: string
  /** Téléphone ligne fixe / bureau, E.164. */
  phoneWork?: string
  /** Site web cabinet (https://...). */
  website?: string
  /** Ligne 1 adresse cabinet. */
  addressLine1?: string
  /** Code postal. */
  postalCode?: string
  /** Ville. */
  city?: string
  /** Pays (ISO ou texte, default "France"). */
  country?: string
  /** Note libre. Convention KOVAS : "Cert. RGE n° X · SIRET 123…". */
  note?: string
  /**
   * Logo cabinet en base64 BRUT (sans préfixe `data:image/...;base64,`).
   * Si fourni, ajouté en PHOTO;ENCODING=b;TYPE=PNG (ou JPEG).
   *
   * ⚠️ Important : doit rester < 50 Ko encodé sinon certains lecteurs
   * tronquent silencieusement la ligne foldée. Pour KOVAS on cible
   * 120×120 PNG ≤ 30 Ko (largement suffisant pour la photo de contact).
   */
  logoBase64?: string
  /** MIME image — détermine TYPE= dans PHOTO. */
  logoMime?: 'image/png' | 'image/jpeg'
}

/**
 * Échappe les caractères réservés vCard d'un champ texte single-line.
 *  - `\`  → `\\`
 *  - `,`  → `\,`
 *  - `;`  → `\;`
 *  - `\n` → `\n` littéral (séquence de 2 chars)
 *  - `\r` → supprimé
 */
function escapeText(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

/**
 * RFC 2426 §2.6 — Folding des lignes > 75 octets.
 * Implémentation byte-aware (UTF-8) pour ne pas casser les caractères
 * multi-octets. Continuation par CRLF + espace.
 */
function foldLine(line: string): string {
  const MAX_OCTETS = 75
  const encoder = new TextEncoder()
  const bytes = encoder.encode(line)
  if (bytes.length <= MAX_OCTETS) return line

  // On découpe par octets en respectant les frontières de caractères.
  const decoder = new TextDecoder('utf-8')
  const out: string[] = []
  let cursor = 0
  let isFirst = true
  while (cursor < bytes.length) {
    const limit = isFirst ? MAX_OCTETS : MAX_OCTETS - 1 // espace de continuation
    let end = Math.min(cursor + limit, bytes.length)

    // Recul tant qu'on coupe au milieu d'un code-point UTF-8.
    // Octets de continuation : 10xxxxxx → 0x80..0xBF
    while (end < bytes.length && (bytes[end]! & 0xc0) === 0x80) {
      end -= 1
    }
    const chunk = decoder.decode(bytes.slice(cursor, end))
    out.push(isFirst ? chunk : ` ${chunk}`)
    cursor = end
    isFirst = false
  }
  return out.join('\r\n')
}

interface LineSpec {
  /** Property name + params, ex: `EMAIL;TYPE=WORK,INTERNET` */
  prop: string
  /** Value (déjà échappée pour les champs texte, brute pour PHOTO/URL). */
  value: string
}

function emit(lines: LineSpec[]): string {
  return lines.map((l) => foldLine(`${l.prop}:${l.value}`)).join('\r\n')
}

/**
 * Construit la chaîne vCard 3.0 finale (terminée par CRLF).
 */
export function buildVCard(input: VCardInput): string {
  const lines: LineSpec[] = []

  lines.push({ prop: 'BEGIN', value: 'VCARD' })
  lines.push({ prop: 'VERSION', value: '3.0' })

  // N (Nom structuré) : Family;Given;Additional;Prefix;Suffix
  const family = escapeText(input.lastName.trim())
  const given = escapeText(input.firstName.trim())
  lines.push({ prop: 'N', value: `${family};${given};;;` })

  // FN (Formatted Name) — affichage humain
  const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim()
  lines.push({ prop: 'FN', value: escapeText(fullName) })

  // ORG (Cabinet)
  if (input.organization?.trim()) {
    lines.push({ prop: 'ORG', value: escapeText(input.organization.trim()) })
  }

  // TITLE
  if (input.title?.trim()) {
    lines.push({ prop: 'TITLE', value: escapeText(input.title.trim()) })
  }

  // TEL — Mobile (préféré)
  if (input.phoneMobile?.trim()) {
    lines.push({
      prop: 'TEL;TYPE=CELL,VOICE,PREF',
      value: escapeText(input.phoneMobile.trim()),
    })
  }

  // TEL — Fixe / bureau
  if (input.phoneWork?.trim()) {
    lines.push({
      prop: 'TEL;TYPE=WORK,VOICE',
      value: escapeText(input.phoneWork.trim()),
    })
  }

  // EMAIL — pro
  if (input.emailWork?.trim()) {
    lines.push({
      prop: 'EMAIL;TYPE=WORK,INTERNET',
      value: escapeText(input.emailWork.trim()),
    })
  }

  // URL
  if (input.website?.trim()) {
    lines.push({ prop: 'URL', value: escapeText(input.website.trim()) })
  }

  // ADR (Adresse) : POBox;ExtAdd;Street;Locality;Region;Postal;Country
  const hasAddr =
    input.addressLine1?.trim() ||
    input.postalCode?.trim() ||
    input.city?.trim() ||
    input.country?.trim()
  if (hasAddr) {
    const street = escapeText(input.addressLine1?.trim() ?? '')
    const city = escapeText(input.city?.trim() ?? '')
    const postal = escapeText(input.postalCode?.trim() ?? '')
    const country = escapeText(input.country?.trim() ?? 'France')
    lines.push({
      prop: 'ADR;TYPE=WORK',
      value: `;;${street};${city};;${postal};${country}`,
    })
  }

  // NOTE (cert RGE + SIRET)
  if (input.note?.trim()) {
    lines.push({ prop: 'NOTE', value: escapeText(input.note.trim()) })
  }

  // PHOTO embedded
  if (input.logoBase64 && input.logoMime) {
    const type = input.logoMime === 'image/jpeg' ? 'JPEG' : 'PNG'
    // La photo ne doit JAMAIS contenir de retour à la ligne (sinon les lecteurs
    // cassent). On retire tous les whitespaces avant de fold.
    const cleanB64 = input.logoBase64.replace(/\s+/g, '')
    lines.push({ prop: `PHOTO;ENCODING=b;TYPE=${type}`, value: cleanB64 })
  }

  // REV (timestamp UTC ISO 8601)
  lines.push({
    prop: 'REV',
    value: new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
  })

  lines.push({ prop: 'END', value: 'VCARD' })

  return `${emit(lines)}\r\n`
}

/**
 * Construit la note "Cert. RGE n° X · SIRET Y" canonique KOVAS si les
 * informations sont disponibles. Retourne `undefined` si rien à afficher.
 */
export function buildCertificationNote(input: {
  certificationN?: string | null
  siret?: string | null
  showCertification: boolean
  showSiret: boolean
}): string | undefined {
  const parts: string[] = []
  if (input.showCertification && input.certificationN?.trim()) {
    parts.push(`Cert. RGE n° ${input.certificationN.trim()}`)
  }
  if (input.showSiret && input.siret?.trim()) {
    parts.push(`SIRET ${input.siret.trim()}`)
  }
  return parts.length > 0 ? parts.join(' · ') : undefined
}
