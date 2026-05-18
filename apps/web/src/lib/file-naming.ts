/**
 * Convention de nommage KOVAS — fichiers exports + photos + ZIPs.
 * Cf. docs/file-naming-convention.md (spec complète).
 *
 * Objectif : un fichier doit être auto-descriptif. Un diag retrouve
 * n'importe quel fichier en 10 secondes via le nom seul.
 *
 * Format général :
 *   [DATE]_[TYPE]_[CLIENT]_[ADRESSE]_[REF].[ext]
 *
 * Exemples :
 *   2026-05-18_DPE_DUPONT-Pierre_12-rue-Republique-Paris_MIS-2026-00143.pdf
 *   2026-05-18_LICIEL-EXPORT_DUPONT-Pierre_DOS-2026-00042.zip
 *   2026-05-18_PIECE-01-Salon_001_VUE-GENERALE_DOS-2026-00042.webp
 */

const ROAD_ABBREVIATIONS: Record<string, string> = {
  boulevard: 'bd',
  avenue: 'av',
  place: 'pl',
  impasse: 'imp',
  residence: 'res',
  appartement: 'appt',
  lotissement: 'lot',
  chemin: 'ch',
  allee: 'all',
  square: 'sq',
  passage: 'pas',
  faubourg: 'fbg',
}

/**
 * Slugifie une chaîne pour usage comme segment de nom de fichier.
 * - Supprime les accents (NFD + filtre diacritiques)
 * - Garde a-z, A-Z, 0-9, espaces, tirets
 * - Convertit espaces en tirets, supprime les tirets consécutifs
 * - Tronqué à maxLength
 */
export function slugify(input: string, maxLength = 50): string {
  if (!input) return ''
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, maxLength)
}

/**
 * Slugifie une adresse en abrégeant les types de voie longs pour
 * tenir dans la limite de longueur tout en restant lisible.
 */
export function slugifyAddress(address: string, maxLength = 60): string {
  if (!address) return ''
  let work = address.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  for (const [full, abbr] of Object.entries(ROAD_ABBREVIATIONS)) {
    work = work.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr)
  }
  return slugify(work, maxLength)
}

/**
 * Slugifie un nom de client. Garde le format "NOM-Prenom" si possible.
 */
export function slugifyClientName(displayName: string, maxLength = 50): string {
  if (!displayName) return 'CLIENT'
  // "Dupont Pierre" → "DUPONT-Pierre"
  const parts = displayName.trim().split(/\s+/)
  if (parts.length >= 2) {
    const lastName = slugify(parts[0]!, 30).toUpperCase()
    const firstName = slugify(parts.slice(1).join(' '), 30)
    return `${lastName}-${firstName}`.substring(0, maxLength)
  }
  return slugify(displayName, maxLength).toUpperCase()
}

/**
 * Date au format ISO 8601 court (YYYY-MM-DD) pour tri chronologique.
 */
export function isoDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return new Date().toISOString().split('T')[0]!
  return d.toISOString().split('T')[0]!
}

const MISSION_TYPE_TAGS: Record<string, string> = {
  dpe_vente: 'DPE',
  dpe_location: 'DPE-LOC',
  copropriete: 'DPE-COPRO',
  amiante_vente: 'AMIANTE',
  amiante_avant_travaux: 'AMIANTE-AT',
  plomb_crep: 'PLOMB',
  gaz: 'GAZ',
  electricite: 'ELEC',
  termites: 'TERMITES',
  carrez_boutin: 'CARREZ',
  erp: 'ERP',
}

export function missionTypeTag(type: string): string {
  return MISSION_TYPE_TAGS[type] ?? type.toUpperCase().replace(/_/g, '-')
}

// ============================================================
// Constructeurs de noms
// ============================================================

export interface FileNameContext {
  date: Date | string
  reference: string // DOS-2026-00001 ou MIS-2026-00001
  client?: { display_name: string | null } | null
  property?: {
    address: string | null
    city?: string | null
    apartment_detail?: string | null
    building_letter?: string | null
  } | null
}

/**
 * Nom d'un rapport diagnostic.
 * Format : [DATE]_[TYPE]_[CLIENT]_[ADRESSE]_[REF].ext
 *
 * Ex : 2026-05-18_DPE_DUPONT-Pierre_12-rue-Republique-Paris_MIS-2026-00143.pdf
 */
export function buildReportFileName(opts: {
  ctx: FileNameContext
  missionType: string
  ext: 'pdf' | 'docx' | 'csv' | 'json'
}): string {
  const date = isoDate(opts.ctx.date)
  const type = missionTypeTag(opts.missionType)
  const client = opts.ctx.client?.display_name
    ? slugifyClientName(opts.ctx.client.display_name, 40)
    : 'CLIENT'
  const address = opts.ctx.property
    ? slugifyAddress(
        [
          opts.ctx.property.address,
          opts.ctx.property.building_letter,
          opts.ctx.property.apartment_detail,
          opts.ctx.property.city,
        ]
          .filter(Boolean)
          .join(' '),
        60,
      )
    : 'ADRESSE'
  return `${date}_${type}_${client}_${address}_${opts.ctx.reference}.${opts.ext}`
}

/**
 * Nom d'un export ZIP (KOVAS universel ou ZIP Liciel).
 * Format : [DATE]_[TARGET-EXPORT]_[CLIENT]_[REF].zip
 *
 * Ex : 2026-05-18_LICIEL-EXPORT_DUPONT-Pierre_DOS-2026-00042.zip
 */
export function buildZipFileName(opts: {
  ctx: FileNameContext
  target: 'KOVAS' | 'LICIEL' | 'ANALYSIMMO' | 'OBBC'
}): string {
  const date = isoDate(opts.ctx.date)
  const tag = opts.target === 'KOVAS' ? 'KOVAS-EXPORT' : `${opts.target}-EXPORT`
  const client = opts.ctx.client?.display_name
    ? slugifyClientName(opts.ctx.client.display_name, 40)
    : null
  const parts = [date, tag]
  if (client) parts.push(client)
  parts.push(opts.ctx.reference)
  return `${parts.join('_')}.zip`
}

/**
 * Nom d'une photo de pièce.
 * Format : [DATE]_PIECE-[NUM]-[NOM]_[NUM-PHOTO]_[VUE]_[REF].webp
 *
 * Ex : 2026-05-18_PIECE-01-Salon_003_RADIATEUR_DOS-2026-00042.webp
 */
export function buildPhotoFileName(opts: {
  date: Date | string
  reference: string
  roomIndex: number
  roomName: string | null
  photoIndex: number
  viewType?: string | null
  ext?: string
}): string {
  const date = isoDate(opts.date)
  const roomNum = String(opts.roomIndex).padStart(2, '0')
  const roomSlug = opts.roomName ? slugify(opts.roomName, 25) : 'Piece'
  const photoNum = String(opts.photoIndex).padStart(3, '0')
  const view = opts.viewType ? `_${slugify(opts.viewType, 25).toUpperCase()}` : ''
  const ext = opts.ext ?? 'webp'
  return `${date}_PIECE-${roomNum}-${roomSlug}_${photoNum}${view}_${opts.reference}.${ext}`
}

/**
 * Nom de dossier pour stockage hiérarchique.
 * Format : [REF]_[CLIENT]_[VILLE]
 *
 * Ex : DOS-2026-00042_DUPONT-Pierre_Paris
 */
export function buildDirectoryName(opts: {
  reference: string
  client: { display_name: string | null } | null
  property: { city: string | null } | null
}): string {
  const client = opts.client?.display_name
    ? slugifyClientName(opts.client.display_name, 30)
    : null
  const city = opts.property?.city ? slugify(opts.property.city, 20) : null
  const parts = [opts.reference]
  if (client) parts.push(client)
  if (city) parts.push(city)
  return parts.join('_')
}
