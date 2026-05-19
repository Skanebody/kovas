/**
 * Normalisation des entités parsées (multi-source : Liciel / AnalysImmo / OBBC /
 * ORIS / Autre — le normalizer est agnostique de la source car le schéma
 * Parsed* est unifié) :
 *  - Téléphones → E.164 (libphonenumber-js)
 *  - Emails → validation + détection typos communs
 *  - SIRET → validation Luhn (INSEE Sirene différé V1.5)
 *  - Adresses → géocodage via API BAN (cache en mémoire)
 *  - Noms propres → casse propre
 *
 * Chaque normalisation retourne `{ data, warnings, confidence }`.
 * La confidence diminue de 0.1 par warning, plancher 0.
 */

import { parsePhoneNumberFromString } from 'libphonenumber-js'
import type { NormalizationWarning, ParsedClient, ParsedCopropriete, ParsedProperty } from './types'

// ============================================================================
// SORTIES TYPÉES
// ============================================================================

export interface NormalizedClient {
  type: 'particulier' | 'agence' | 'notaire' | 'syndic' | 'entreprise' | 'collectivite' | null
  display_name: string | null
  first_name: string | null
  last_name: string | null
  company_name: string | null
  siret: string | null
  email: string | null
  phone: string | null
  phone_mobile: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  country: string
  notes: string | null
  geocoded_lat: number | null
  geocoded_lng: number | null
  ban_id: string | null
}

export interface NormalizedProperty {
  property_type:
    | 'maison'
    | 'appartement'
    | 'immeuble'
    | 'local_commercial'
    | 'bureau'
    | 'autre'
    | null
  address: string | null
  postal_code: string | null
  city: string | null
  insee_code: string | null
  country: string
  surface_total: number | null
  surface_carrez: number | null
  surface_boutin: number | null
  rooms_count: number | null
  floors_count: number | null
  year_built: number | null
  geocoded_lat: number | null
  geocoded_lng: number | null
  ban_id: string | null
}

export interface NormalizedCopropriete {
  name: string | null
  rnic_number: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  insee_code: string | null
  year_built: number | null
  lots_count: number | null
  geocoded_lat: number | null
  geocoded_lng: number | null
  ban_id: string | null
}

export interface NormalizeResult<T> {
  data: T
  warnings: NormalizationWarning[]
  confidence: number
}

// ============================================================================
// CACHE BAN partagé (par exécution de pipeline)
// ============================================================================

export interface BanCacheEntry {
  label: string
  postcode: string | null
  city: string | null
  citycode: string | null
  lat: number | null
  lng: number | null
  ban_id: string | null
  score: number
}

const BAN_TIMEOUT_MS = 3000

/**
 * Cache en mémoire pour la durée du parse (une instance par appel pipeline).
 * Évite les re-requêtes sur 50 lignes ayant la même adresse.
 */
export class BanCache {
  private store = new Map<string, BanCacheEntry | null>()

  async lookup(query: string): Promise<BanCacheEntry | null> {
    const key = query.trim().toLowerCase()
    if (this.store.has(key)) {
      return this.store.get(key) ?? null
    }
    const result = await fetchBan(query)
    this.store.set(key, result)
    return result
  }

  get size(): number {
    return this.store.size
  }
}

async function fetchBan(query: string): Promise<BanCacheEntry | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), BAN_TIMEOUT_MS)
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    const json = (await res.json()) as {
      features?: Array<{
        properties: {
          id?: string
          label?: string
          postcode?: string
          city?: string
          citycode?: string
          score?: number
        }
        geometry?: { coordinates?: [number, number] }
      }>
    }
    const feature = json.features?.[0]
    if (!feature) return null
    const props = feature.properties
    const coords = feature.geometry?.coordinates
    return {
      label: props.label ?? query,
      postcode: props.postcode ?? null,
      city: props.city ?? null,
      citycode: props.citycode ?? null,
      lat: coords ? coords[1] : null,
      lng: coords ? coords[0] : null,
      ban_id: props.id ?? null,
      score: props.score ?? 0,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function cleanString(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Normalisation casse propre des noms propres FR.
 *  - "DUPONT" → "Dupont"
 *  - "jean de la fontaine" → "Jean de la Fontaine"
 */
const LOWERCASE_NAME_PARTICLES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'van', 'von', 'd'])

export function properCase(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  return trimmed
    .toLowerCase()
    .split(/(\s|-)/)
    .map((token, idx) => {
      if (token === ' ' || token === '-') return token
      if (token === '') return ''
      if (idx > 0 && LOWERCASE_NAME_PARTICLES.has(token)) return token
      return token.charAt(0).toUpperCase() + token.slice(1)
    })
    .join('')
}

// ----------------------------------------------------------------------------
// Téléphone
// ----------------------------------------------------------------------------

export function normalizePhone(raw: string | undefined | null): {
  value: string | null
  warning: NormalizationWarning | null
} {
  const cleaned = cleanString(raw)
  if (!cleaned) return { value: null, warning: null }
  try {
    const parsed = parsePhoneNumberFromString(cleaned, 'FR')
    if (parsed?.isValid()) {
      return { value: parsed.format('E.164'), warning: null }
    }
    return {
      value: cleaned,
      warning: {
        field: 'phone',
        code: 'phone_unparseable',
        message: `Téléphone non parseable : "${cleaned}"`,
        raw_value: cleaned,
      },
    }
  } catch {
    return {
      value: cleaned,
      warning: {
        field: 'phone',
        code: 'phone_unparseable',
        message: `Téléphone non parseable : "${cleaned}"`,
        raw_value: cleaned,
      },
    }
  }
}

// ----------------------------------------------------------------------------
// Email
// ----------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const EMAIL_TYPO_FIXES: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmali.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'hotnail.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'yaho.fr': 'yahoo.fr',
  'yahooo.fr': 'yahoo.fr',
  'yaho.com': 'yahoo.com',
  'outloo.com': 'outlook.com',
  'outlok.com': 'outlook.com',
  'outloook.com': 'outlook.com',
  'wanadoo.com': 'wanadoo.fr',
  'orang.fr': 'orange.fr',
}

export function normalizeEmail(raw: string | undefined | null): {
  value: string | null
  warning: NormalizationWarning | null
} {
  const cleaned = cleanString(raw)?.toLowerCase()
  if (!cleaned) return { value: null, warning: null }
  if (!EMAIL_RE.test(cleaned)) {
    return {
      value: cleaned,
      warning: {
        field: 'email',
        code: 'email_invalid',
        message: `Email invalide : "${cleaned}"`,
        raw_value: cleaned,
      },
    }
  }
  // Détection typo de domaine
  const at = cleaned.lastIndexOf('@')
  const domain = cleaned.slice(at + 1)
  if (domain in EMAIL_TYPO_FIXES) {
    const fixed = `${cleaned.slice(0, at + 1)}${EMAIL_TYPO_FIXES[domain]}`
    return {
      value: cleaned,
      warning: {
        field: 'email',
        code: 'email_typo',
        message: `Typo possible dans le domaine "${domain}"`,
        raw_value: cleaned,
        suggested_value: fixed,
      },
    }
  }
  return { value: cleaned, warning: null }
}

// ----------------------------------------------------------------------------
// SIRET
// ----------------------------------------------------------------------------

export function normalizeSiret(raw: string | undefined | null): {
  value: string | null
  warning: NormalizationWarning | null
} {
  const cleaned = cleanString(raw)?.replace(/\s/g, '')
  if (!cleaned) return { value: null, warning: null }
  if (!/^\d{14}$/.test(cleaned)) {
    return {
      value: cleaned,
      warning: {
        field: 'siret',
        code: 'siret_invalid',
        message: `SIRET invalide (14 chiffres requis) : "${cleaned}"`,
        raw_value: cleaned,
      },
    }
  }
  if (!luhnValid(cleaned)) {
    return {
      value: cleaned,
      warning: {
        field: 'siret',
        code: 'siret_invalid',
        message: `SIRET échoue la validation Luhn : "${cleaned}"`,
        raw_value: cleaned,
      },
    }
  }
  // TODO V1.5 : appel INSEE Sirene API pour vérifier état de l'établissement
  return { value: cleaned, warning: null }
}

function luhnValid(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    const d = Number.parseInt(digits[digits.length - 1 - i] ?? '0', 10)
    if (i % 2 === 1) {
      const doubled = d * 2
      sum += doubled > 9 ? doubled - 9 : doubled
    } else {
      sum += d
    }
  }
  return sum % 10 === 0
}

// ----------------------------------------------------------------------------
// Type client
// ----------------------------------------------------------------------------

const CLIENT_TYPE_MAP: Record<string, NormalizedClient['type']> = {
  particulier: 'particulier',
  personne: 'particulier',
  prive: 'particulier',
  agence: 'agence',
  agenceimmobiliere: 'agence',
  immobilier: 'agence',
  notaire: 'notaire',
  office: 'notaire',
  syndic: 'syndic',
  copropriete: 'syndic',
  entreprise: 'entreprise',
  societe: 'entreprise',
  pro: 'entreprise',
  collectivite: 'collectivite',
  mairie: 'collectivite',
  commune: 'collectivite',
}

function inferClientType(raw: string | undefined, hasSiret: boolean): NormalizedClient['type'] {
  if (raw) {
    const norm = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z]/g, '')
    if (norm in CLIENT_TYPE_MAP) {
      return CLIENT_TYPE_MAP[norm] ?? null
    }
  }
  if (hasSiret) return 'entreprise'
  return 'particulier'
}

// ----------------------------------------------------------------------------
// Type bien
// ----------------------------------------------------------------------------

const PROPERTY_TYPE_MAP: Record<string, NormalizedProperty['property_type']> = {
  maison: 'maison',
  appartement: 'appartement',
  apt: 'appartement',
  appart: 'appartement',
  immeuble: 'immeuble',
  localcommercial: 'local_commercial',
  commerce: 'local_commercial',
  bureau: 'bureau',
  bureaux: 'bureau',
  autre: 'autre',
}

function inferPropertyType(raw: string | undefined): NormalizedProperty['property_type'] {
  if (!raw) return null
  const norm = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z]/g, '')
  return PROPERTY_TYPE_MAP[norm] ?? null
}

// ============================================================================
// NORMALIZE CLIENT
// ============================================================================

export async function normalizeClient(
  c: ParsedClient,
  banCache: BanCache = new BanCache(),
): Promise<NormalizeResult<NormalizedClient>> {
  const warnings: NormalizationWarning[] = []

  const firstName = properCase(cleanString(c.prenom))
  const lastName = properCase(cleanString(c.nom))
  const companyName = cleanString(c.raison_sociale)

  // Téléphone
  const phoneRes = normalizePhone(c.telephone)
  if (phoneRes.warning) warnings.push(phoneRes.warning)
  const phoneMobileRes = normalizePhone(c.telephone_mobile)
  if (phoneMobileRes.warning) {
    warnings.push({ ...phoneMobileRes.warning, field: 'phone_mobile' })
  }

  // Email
  const emailRes = normalizeEmail(c.email)
  if (emailRes.warning) warnings.push(emailRes.warning)

  // SIRET
  const siretRes = normalizeSiret(c.siret)
  if (siretRes.warning) warnings.push(siretRes.warning)

  // Adresse — concatène ligne1 + ligne2 + CP + ville pour le géocodage
  const addressQuery = [c.adresse_ligne1, c.adresse_ligne2, c.code_postal, c.ville]
    .map((p) => cleanString(p))
    .filter(Boolean)
    .join(' ')

  let geoLat: number | null = null
  let geoLng: number | null = null
  let banId: string | null = null
  let address: string | null = cleanString(c.adresse_ligne1)
  let postalCode: string | null = cleanString(c.code_postal)
  let city: string | null = cleanString(c.ville)

  if (addressQuery.length > 0) {
    const ban = await banCache.lookup(addressQuery)
    if (ban && ban.score >= 0.8) {
      address = ban.label
      postalCode = ban.postcode ?? postalCode
      city = ban.city ?? city
      geoLat = ban.lat
      geoLng = ban.lng
      banId = ban.ban_id
    } else if (ban) {
      warnings.push({
        field: 'address',
        code: 'address_low_score',
        message: `Adresse imparfaite (score ${ban.score.toFixed(2)})`,
        raw_value: addressQuery,
        suggested_value: ban.label,
      })
    } else {
      warnings.push({
        field: 'address',
        code: 'address_unmatched',
        message: 'Adresse non trouvée par BAN',
        raw_value: addressQuery,
      })
    }
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  const displayName = companyName ?? (fullName.length > 0 ? fullName : null)

  const type = inferClientType(c.type, !!siretRes.value && !siretRes.warning)

  const data: NormalizedClient = {
    type,
    display_name: displayName ?? firstName ?? lastName ?? companyName ?? null,
    first_name: firstName,
    last_name: lastName,
    company_name: companyName,
    siret: siretRes.value,
    email: emailRes.value,
    phone: phoneRes.value,
    phone_mobile: phoneMobileRes.value,
    address,
    postal_code: postalCode,
    city,
    country: 'FR',
    notes: cleanString(c.notes),
    geocoded_lat: geoLat,
    geocoded_lng: geoLng,
    ban_id: banId,
  }

  const confidence = Math.max(0, 1 - warnings.length * 0.1)
  return { data, warnings, confidence }
}

// ============================================================================
// NORMALIZE PROPERTY
// ============================================================================

export async function normalizeProperty(
  p: ParsedProperty,
  banCache: BanCache = new BanCache(),
): Promise<NormalizeResult<NormalizedProperty>> {
  const warnings: NormalizationWarning[] = []

  const addressQuery = [p.adresse_ligne1, p.adresse_ligne2, p.code_postal, p.ville]
    .map((x) => cleanString(x))
    .filter(Boolean)
    .join(' ')

  let address: string | null = cleanString(p.adresse_ligne1)
  let postalCode: string | null = cleanString(p.code_postal)
  let city: string | null = cleanString(p.ville)
  let inseeCode: string | null = null
  let geoLat: number | null = null
  let geoLng: number | null = null
  let banId: string | null = null

  if (addressQuery.length > 0) {
    const ban = await banCache.lookup(addressQuery)
    if (ban && ban.score >= 0.8) {
      address = ban.label
      postalCode = ban.postcode ?? postalCode
      city = ban.city ?? city
      inseeCode = ban.citycode
      geoLat = ban.lat
      geoLng = ban.lng
      banId = ban.ban_id
    } else if (ban) {
      warnings.push({
        field: 'address',
        code: 'address_low_score',
        message: `Adresse imparfaite (score ${ban.score.toFixed(2)})`,
        raw_value: addressQuery,
        suggested_value: ban.label,
      })
    } else {
      warnings.push({
        field: 'address',
        code: 'address_unmatched',
        message: 'Adresse non trouvée par BAN',
        raw_value: addressQuery,
      })
    }
  }

  const data: NormalizedProperty = {
    property_type: inferPropertyType(p.type_bien),
    address,
    postal_code: postalCode,
    city,
    insee_code: inseeCode,
    country: 'FR',
    surface_total: numberOrNull(p.surface_habitable),
    surface_carrez: numberOrNull(p.surface_loi_carrez),
    surface_boutin: numberOrNull(p.surface_utile),
    rooms_count: intOrNull(p.nombre_pieces),
    floors_count: intOrNull(p.nombre_niveaux),
    year_built: intOrNull(p.annee_construction),
    geocoded_lat: geoLat,
    geocoded_lng: geoLng,
    ban_id: banId,
  }

  const confidence = Math.max(0, 1 - warnings.length * 0.1)
  return { data, warnings, confidence }
}

function numberOrNull(v: number | undefined): number | null {
  if (v === undefined || v === null) return null
  return Number.isFinite(v) ? v : null
}
function intOrNull(v: number | undefined): number | null {
  if (v === undefined || v === null) return null
  if (!Number.isFinite(v)) return null
  return Math.round(v)
}

// ============================================================================
// NORMALIZE COPROPRIETE
// ============================================================================

export async function normalizeCopropriete(
  c: ParsedCopropriete,
  banCache: BanCache = new BanCache(),
): Promise<NormalizeResult<NormalizedCopropriete>> {
  const warnings: NormalizationWarning[] = []

  const rnic = cleanString(c.numero_immatriculation)
  if (rnic && !/^[A-Z0-9]{8,}$/i.test(rnic)) {
    warnings.push({
      field: 'rnic_number',
      code: 'rnic_invalid',
      message: `Numéro RNIC suspect : "${rnic}"`,
      raw_value: rnic,
    })
  }

  const addressQuery = [c.adresse_ligne1, c.code_postal, c.ville]
    .map((x) => cleanString(x))
    .filter(Boolean)
    .join(' ')

  let address: string | null = cleanString(c.adresse_ligne1)
  let postalCode: string | null = cleanString(c.code_postal)
  let city: string | null = cleanString(c.ville)
  let inseeCode: string | null = null
  let geoLat: number | null = null
  let geoLng: number | null = null
  let banId: string | null = null

  if (addressQuery.length > 0) {
    const ban = await banCache.lookup(addressQuery)
    if (ban && ban.score >= 0.8) {
      address = ban.label
      postalCode = ban.postcode ?? postalCode
      city = ban.city ?? city
      inseeCode = ban.citycode
      geoLat = ban.lat
      geoLng = ban.lng
      banId = ban.ban_id
    } else if (ban) {
      warnings.push({
        field: 'address',
        code: 'address_low_score',
        message: `Adresse imparfaite (score ${ban.score.toFixed(2)})`,
        raw_value: addressQuery,
        suggested_value: ban.label,
      })
    } else {
      warnings.push({
        field: 'address',
        code: 'address_unmatched',
        message: 'Adresse non trouvée par BAN',
        raw_value: addressQuery,
      })
    }
  }

  const data: NormalizedCopropriete = {
    name: cleanString(c.nom_copro),
    rnic_number: rnic,
    address,
    postal_code: postalCode,
    city,
    insee_code: inseeCode,
    year_built: intOrNull(c.annee_construction),
    lots_count: intOrNull(c.nombre_lots),
    geocoded_lat: geoLat,
    geocoded_lng: geoLng,
    ban_id: banId,
  }

  const confidence = Math.max(0, 1 - warnings.length * 0.1)
  return { data, warnings, confidence }
}

// ============================================================================
// SEMAPHORE pour limiter la concurrence BAN
// ============================================================================

export class Semaphore {
  private current = 0
  private queue: Array<() => void> = []

  constructor(private readonly maxConcurrent: number) {}

  async acquire(): Promise<() => void> {
    if (this.current < this.maxConcurrent) {
      this.current++
      return () => this.release()
    }
    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.current++
        resolve(() => this.release())
      })
    })
  }

  private release(): void {
    this.current--
    const next = this.queue.shift()
    if (next) next()
  }
}
