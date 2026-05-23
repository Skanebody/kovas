// ============================================
// KOVAS Annuaire — Edge Function : absorb-dhup-directory
//
// Mission Phase A : import mensuel du dataset DHUP data.gouv.fr
//   "annuaire des diagnostiqueurs immobiliers certifies" (Etalab 2.0).
//
// Difference vs `import-dhup-annuaire` (version "compagnon" V1) :
//   - Normalise les certifications dans la table `diagnostician_certifications`
//     (extraction du JSONB) avec UPSERT idempotent par
//     (diagnostician_id, certification_type, organism, certification_number).
//   - Genere un dhup_source_id stable par SHA-256(siret + nom + prenom) — pas
//     de dependance a la composition postal_code/dept.
//   - Marque les fiches DISPARUES du dernier import en `validation_status =
//     'pending'` (ghost lifecycle) sans suppression brute.
//   - Logue un audit trail consolide dans `diagnostician_cross_validation_logs`
//     (batch global au lieu de 1 log/ligne).
//
// Trigger : cron mensuel (1er du mois 03:00 CET).
// Auth    : header `Authorization: Bearer ${SERVICE_ROLE_KEY}`
//           ou `x-cron-secret: ${CRON_SECRET}` (kovas-defense pour pg_cron).
//
// Variables d'environnement :
//   - SUPABASE_URL                     (Supabase auto)
//   - SUPABASE_SERVICE_ROLE_KEY        (Supabase auto)
//   - DHUP_DATASET_RESOURCE_URL        (URL stable data.gouv.fr du CSV)
//   - CRON_SECRET                      (optionnel — auth via header alternatif)
// ============================================

/// <reference lib="deno.ns" />

import { type SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

type CertificationType =
  | 'DPE'
  | 'DPE_MENTION'
  | 'AMIANTE'
  | 'PLOMB'
  | 'GAZ'
  | 'ELECTRICITE'
  | 'TERMITES'
  | 'CARREZ'
  | 'ERP'

interface DhupCertification {
  type: CertificationType
  organism: string
  number: string
  validUntil: string | null
}

interface DhupRow {
  /** ID stable cote DHUP (hash SHA-256 SIRET ou nom+prenom). */
  dhupSourceId: string
  firstName: string
  lastName: string
  city: string
  postalCode: string | null
  departmentCode: string
  address: string | null
  officialEmail: string | null
  officialPhone: string | null
  officialCompanyName: string | null
  siret: string | null
  certifications: DhupCertification[]
}

interface DiagnosticianRow {
  id: string
  slug: string | null
}

interface AbsorbResponse {
  ok: boolean
  imported: number
  updated: number
  ceased: number
  errors: number
  durationMs: number
  totalRows?: number
  certificationsUpserted?: number
  errorMessages?: string[]
  error?: string
}

// ────────────────────────────────────────────────────────────
// Mapping department code → slug (idem import-dhup-annuaire)
// ────────────────────────────────────────────────────────────
const DEPT_SLUGS: Record<string, string> = {
  '01': 'ain',
  '02': 'aisne',
  '03': 'allier',
  '04': 'alpes-de-haute-provence',
  '05': 'hautes-alpes',
  '06': 'alpes-maritimes',
  '07': 'ardeche',
  '08': 'ardennes',
  '09': 'ariege',
  '10': 'aube',
  '11': 'aude',
  '12': 'aveyron',
  '13': 'bouches-du-rhone',
  '14': 'calvados',
  '15': 'cantal',
  '16': 'charente',
  '17': 'charente-maritime',
  '18': 'cher',
  '19': 'correze',
  '2A': 'corse-du-sud',
  '2B': 'haute-corse',
  '21': 'cote-dor',
  '22': 'cotes-darmor',
  '23': 'creuse',
  '24': 'dordogne',
  '25': 'doubs',
  '26': 'drome',
  '27': 'eure',
  '28': 'eure-et-loir',
  '29': 'finistere',
  '30': 'gard',
  '31': 'haute-garonne',
  '32': 'gers',
  '33': 'gironde',
  '34': 'herault',
  '35': 'ille-et-vilaine',
  '36': 'indre',
  '37': 'indre-et-loire',
  '38': 'isere',
  '39': 'jura',
  '40': 'landes',
  '41': 'loir-et-cher',
  '42': 'loire',
  '43': 'haute-loire',
  '44': 'loire-atlantique',
  '45': 'loiret',
  '46': 'lot',
  '47': 'lot-et-garonne',
  '48': 'lozere',
  '49': 'maine-et-loire',
  '50': 'manche',
  '51': 'marne',
  '52': 'haute-marne',
  '53': 'mayenne',
  '54': 'meurthe-et-moselle',
  '55': 'meuse',
  '56': 'morbihan',
  '57': 'moselle',
  '58': 'nievre',
  '59': 'nord',
  '60': 'oise',
  '61': 'orne',
  '62': 'pas-de-calais',
  '63': 'puy-de-dome',
  '64': 'pyrenees-atlantiques',
  '65': 'hautes-pyrenees',
  '66': 'pyrenees-orientales',
  '67': 'bas-rhin',
  '68': 'haut-rhin',
  '69': 'rhone',
  '70': 'haute-saone',
  '71': 'saone-et-loire',
  '72': 'sarthe',
  '73': 'savoie',
  '74': 'haute-savoie',
  '75': 'paris',
  '76': 'seine-maritime',
  '77': 'seine-et-marne',
  '78': 'yvelines',
  '79': 'deux-sevres',
  '80': 'somme',
  '81': 'tarn',
  '82': 'tarn-et-garonne',
  '83': 'var',
  '84': 'vaucluse',
  '85': 'vendee',
  '86': 'vienne',
  '87': 'haute-vienne',
  '88': 'vosges',
  '89': 'yonne',
  '90': 'territoire-de-belfort',
  '91': 'essonne',
  '92': 'hauts-de-seine',
  '93': 'seine-saint-denis',
  '94': 'val-de-marne',
  '95': 'val-doise',
  '971': 'guadeloupe',
  '972': 'martinique',
  '973': 'guyane',
  '974': 'la-reunion',
  '976': 'mayotte',
}

const VALID_CERT_TYPES: ReadonlySet<CertificationType> = new Set<CertificationType>([
  'DPE',
  'DPE_MENTION',
  'AMIANTE',
  'PLOMB',
  'GAZ',
  'ELECTRICITE',
  'TERMITES',
  'CARREZ',
  'ERP',
])

// ────────────────────────────────────────────────────────────
// Helpers : normalisation, hash, slugify
// ────────────────────────────────────────────────────────────

/**
 * Plage Unicode des combining diacritical marks (accents post-NFD).
 * U+0300 → U+036F couvre tous les accents combinatoires latin/grec.
 */
// biome-ignore lint/suspicious/noMisleadingCharacterClass: plage Unicode U+0300-U+036F intentionnelle (accents combinatoires post-NFD)
const DIACRITICS_RE = /[̀-ͯ]/g

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function departmentSlug(code: string): string {
  return DEPT_SLUGS[code] ?? `dept-${code}`
}

function normalize(value: string | null | undefined): string {
  if (!value) return ''
  return value.trim().normalize('NFD').replace(DIACRITICS_RE, '').toLowerCase()
}

/** Hash SHA-256 stable pour fabriquer un dhup_source_id deterministe. */
async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(input))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Genere un identifiant DHUP stable :
 *   - Si SIRET present → hash(SIRET)
 *   - Sinon          → hash(nom|prenom|departement)
 */
async function computeDhupSourceId(
  siret: string | null,
  firstName: string,
  lastName: string,
  departmentCode: string,
): Promise<string> {
  const key =
    siret && siret.length === 14
      ? `siret:${siret}`
      : `name:${normalize(lastName)}|${normalize(firstName)}|${departmentCode}`
  const hash = await sha256Hex(key)
  return `dhup_${hash.substring(0, 24)}`
}

/**
 * Normalise un libelle certification DHUP vers nos types canoniques.
 *
 * Libelles DHUP officiels observes (dataset data.gouv.fr) :
 *   - "Performance energetique (DPE individuel)"           → DPE
 *   - "Performance energetique (DPE par immeuble, ...)"    → DPE
 *   - "Audit energetique"                                  → DPE_MENTION (premium)
 *   - "Amiante" / "Amiante (missions specifiques**)"       → AMIANTE
 *   - "Plomb"                                              → PLOMB
 *   - "Gaz"                                                → GAZ
 *   - "Electricite"                                        → ELECTRICITE
 *   - "Termites Metropole" / "Termites OM"                 → TERMITES
 *
 * NB : DPE_MENTION = "audit energetique avec mention" — habilite l'audit
 * reglementaire obligatoire des passoires F/G (loi Climat & Resilience 2023).
 * Differenciateur premium dans l'annuaire (badge chartreuse Sparkles).
 *
 * IMPORTANT : l'ordre des tests compte. "AUDIT" doit etre teste AVANT
 * "DPE/Performance" car les libelles peuvent contenir "energetique" dans les deux.
 */
function normalizeCertificationType(label: string): CertificationType | null {
  const up = label.toUpperCase().normalize('NFD').replace(DIACRITICS_RE, '')
  // DPE_MENTION (audit energetique avec mention) — teste en premier
  if (up.includes('AUDIT')) return 'DPE_MENTION'
  if (up.includes('MENTION')) return 'DPE_MENTION'
  if (up.includes('DPE') || up.includes('PERFORMANCE')) return 'DPE'
  if (up.includes('AMIANTE')) return 'AMIANTE'
  if (up.includes('PLOMB') || up.includes('CREP')) return 'PLOMB'
  if (up.includes('GAZ')) return 'GAZ'
  if (up.includes('ELEC')) return 'ELECTRICITE'
  if (up.includes('TERMITE')) return 'TERMITES'
  if (up.includes('CARREZ') || up.includes('BOUTIN') || up.includes('SURFACE')) return 'CARREZ'
  if (up.includes('ERP') || up.includes('RISQUE')) return 'ERP'
  return VALID_CERT_TYPES.has(up as CertificationType) ? (up as CertificationType) : null
}

/** Parse une date DHUP en ISO YYYY-MM-DD (formats : DD/MM/YYYY ou YYYY-MM-DD). */
function parseDhupDate(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  // Format ISO deja propre
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  // Format FR DD/MM/YYYY
  const fr = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`
  return null
}

// ────────────────────────────────────────────────────────────
// CSV parsing — streaming ligne a ligne (memoire bornee)
// ────────────────────────────────────────────────────────────

interface CsvHeader {
  separator: ',' | ';'
  columns: string[]
  index: {
    nom: number
    prenom: number
    ville: number
    cp: number
    dept: number
    siret: number
    certif: number
    organism: number
    numero: number
    validite: number
    email: number
    telephone: number
    raisonSociale: number
    adresse: number
  }
}

function detectSeparator(headerLine: string): ',' | ';' {
  return headerLine.includes(';') ? ';' : ','
}

function parseCsvCells(line: string, separator: ',' | ';'): string[] {
  // Parser robuste : gere les guillemets et les separateurs internes
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === separator && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

/** Normalise un libelle d'entete : strip BOM, accents, ponctuation, lowercase, collapse spaces. */
function normalizeHeader(raw: string): string {
  return raw
    .replace(/^﻿/, '') // BOM UTF-8
    .replace(/^"|"$/g, '')
    .trim()
    .normalize('NFD')
    .replace(DIACRITICS_RE, '') // diacritiques (accents)
    .toLowerCase()
    .replace(/[°º]/g, '') // signe degré (N° → n)
    .replace(/[^a-z0-9]+/g, '_') // tout sauf alphanum → _
    .replace(/^_+|_+$/g, '')
}

function buildHeader(headerLine: string): CsvHeader {
  const separator = detectSeparator(headerLine)
  const columns = parseCsvCells(headerLine, separator).map(normalizeHeader)
  const findCol = (...candidates: string[]): number => {
    for (const candidate of candidates) {
      const idx = columns.indexOf(candidate)
      if (idx !== -1) return idx
    }
    return -1
  }
  return {
    separator,
    columns,
    index: {
      // DHUP officiel : "Nom"
      nom: findCol('nom', 'last_name', 'lastname'),
      // DHUP officiel : "Prenom"
      prenom: findCol('prenom', 'first_name', 'firstname'),
      // DHUP officiel : "Ville"
      ville: findCol('ville', 'commune', 'city'),
      // DHUP officiel : "CP"
      cp: findCol('cp', 'code_postal', 'postal_code', 'postcode'),
      // DHUP officiel : pas de colonne dept → derive du CP
      dept: findCol('departement', 'dept', 'department_code', 'code_departement'),
      // DHUP officiel : pas de SIRET (mais on garde le mapping si format futur)
      siret: findCol('siret', 'n_siret', 'numero_siret', 'siren'),
      // DHUP officiel : "Type de certificat"
      certif: findCol(
        'type_de_certificat',
        'type_certificat',
        'certifications',
        'certification',
        'domaines',
      ),
      // DHUP officiel : "Organisme"
      organism: findCol('organisme', 'organisme_certif', 'organisme_certificateur'),
      // DHUP officiel : "N° de certificat" → normalisé en "n_de_certificat"
      numero: findCol(
        'n_de_certificat',
        'n_certificat',
        'numero',
        'numero_certificat',
        'numero_certification',
      ),
      // DHUP officiel : "Date fin validité" → "date_fin_validite"
      validite: findCol(
        'date_fin_validite',
        'date_de_fin_validite',
        'date_validite',
        'validite',
        'valid_until',
      ),
      // DHUP officiel : "email"
      email: findCol('email', 'courriel', 'mail', 'e_mail'),
      // DHUP officiel : "Tel1" / "Tel2"
      telephone: findCol('tel1', 'telephone', 'phone', 'tel', 'tel_1'),
      // DHUP officiel : "Societe"
      raisonSociale: findCol('societe', 'raison_sociale', 'entreprise', 'company'),
      // DHUP officiel : "Adresse"
      adresse: findCol('adresse', 'address', 'rue', 'voie'),
    },
  }
}

/**
 * Parse une ligne CSV en DhupRow.
 * Retourne null si la ligne est inexploitable (champs vitaux manquants).
 *
 * Note : un meme diagnostiqueur peut apparaitre sur PLUSIEURS lignes
 * (1 ligne par certification dans certaines versions du CSV DHUP).
 * Le dedoublonnage se fait par dhup_source_id en aval (Map).
 */
async function parseDhupLine(line: string, header: CsvHeader): Promise<DhupRow | null> {
  const cells = parseCsvCells(line, header.separator).map((c) => c.replace(/^"|"$/g, '').trim())
  const idx = header.index

  const lastName = idx.nom !== -1 ? (cells[idx.nom] ?? '') : ''
  const firstName = idx.prenom !== -1 ? (cells[idx.prenom] ?? '') : ''
  const city = idx.ville !== -1 ? (cells[idx.ville] ?? '') : ''
  if (!lastName || !firstName || !city) return null

  const postalCode = idx.cp !== -1 ? cells[idx.cp] || null : null
  const departmentCode =
    idx.dept !== -1
      ? cells[idx.dept] || (postalCode ? postalCode.substring(0, 2) : '')
      : postalCode
        ? postalCode.substring(0, 2)
        : ''
  if (!departmentCode) return null

  const rawSiret = idx.siret !== -1 ? (cells[idx.siret] ?? '') : ''
  const siret = rawSiret.replace(/\s+/g, '').match(/^\d{14}$/) ? rawSiret.replace(/\s+/g, '') : null

  const certifRaw = idx.certif !== -1 ? (cells[idx.certif] ?? '') : ''
  const organism = idx.organism !== -1 ? (cells[idx.organism] ?? '') : ''
  const number = idx.numero !== -1 ? (cells[idx.numero] ?? '') : ''
  const validUntilRaw = idx.validite !== -1 ? (cells[idx.validite] ?? '') : ''

  // DHUP officiel : 1 ligne = 1 certificat (le label peut etre une chaine unique
  // comme "Performance energetique (DPE individuel)" ou "Amiante (missions
  // specifiques**)"). On normalise vers UN type canonique, pas plusieurs.
  const singleType = normalizeCertificationType(certifRaw)
  const certifications: DhupCertification[] = singleType
    ? [
        {
          type: singleType,
          organism: organism || 'inconnu',
          number: number || 'inconnu',
          validUntil: parseDhupDate(validUntilRaw),
        },
      ]
    : []

  const dhupSourceId = await computeDhupSourceId(siret, firstName, lastName, departmentCode)

  // Phone : on prefere Tel1 (deja choisi via findCol). On tombe back sur null si vide.
  const phone = idx.telephone !== -1 ? (cells[idx.telephone] ?? '').trim() || null : null

  return {
    dhupSourceId,
    firstName,
    lastName,
    city,
    postalCode,
    departmentCode,
    address: idx.adresse !== -1 ? (cells[idx.adresse] ?? '').trim() || null : null,
    officialEmail: idx.email !== -1 ? (cells[idx.email] ?? '').trim() || null : null,
    officialPhone: phone,
    officialCompanyName:
      idx.raisonSociale !== -1 ? (cells[idx.raisonSociale] ?? '').trim() || null : null,
    siret,
    certifications,
  }
}

/**
 * Parse un flux CSV ligne par ligne et fusionne les lignes ayant le meme
 * dhup_source_id (cas multi-certif).
 */
async function parseCsvStream(csvText: string): Promise<DhupRow[]> {
  const rawLines = csvText.split(/\r?\n/)
  if (rawLines.length < 2) return []

  const headerLine = rawLines[0]?.trim()
  if (!headerLine) return []
  const header = buildHeader(headerLine)
  if (header.index.nom === -1 || header.index.prenom === -1 || header.index.ville === -1) {
    return []
  }

  const byId = new Map<string, DhupRow>()
  for (let i = 1; i < rawLines.length; i++) {
    const line = rawLines[i]
    if (!line || !line.trim()) continue
    const parsed = await parseDhupLine(line, header)
    if (!parsed) continue
    const existing = byId.get(parsed.dhupSourceId)
    if (existing) {
      // Fusion : on accumule les certifications (dedoublonnage cote DB via UNIQUE)
      const seen = new Set(
        existing.certifications.map((c) => `${c.type}|${c.organism}|${c.number}`),
      )
      for (const cert of parsed.certifications) {
        const key = `${cert.type}|${cert.organism}|${cert.number}`
        if (!seen.has(key)) {
          existing.certifications.push(cert)
          seen.add(key)
        }
      }
      // Contact : on prend la premiere occurrence non-nulle
      existing.officialEmail = existing.officialEmail ?? parsed.officialEmail
      existing.officialPhone = existing.officialPhone ?? parsed.officialPhone
      existing.officialCompanyName = existing.officialCompanyName ?? parsed.officialCompanyName
      existing.siret = existing.siret ?? parsed.siret
    } else {
      byId.set(parsed.dhupSourceId, parsed)
    }
  }

  return Array.from(byId.values())
}

// ────────────────────────────────────────────────────────────
// DB operations
// ────────────────────────────────────────────────────────────

/** Lookup d'une fiche existante par dhup_source_id. */
async function findExistingDiagnostician(
  supabase: SupabaseClient,
  dhupSourceId: string,
): Promise<DiagnosticianRow | null> {
  const { data } = await supabase
    .from('diagnosticians')
    .select('id, slug')
    .eq('dhup_source_id', dhupSourceId)
    .maybeSingle<DiagnosticianRow>()
  return data
}

/**
 * UPSERT d'une fiche DHUP dans `diagnosticians`.
 * Renvoie l'id du diagnostiqueur + flag indiquant si c'est un INSERT (new).
 */
async function upsertDiagnostician(
  supabase: SupabaseClient,
  row: DhupRow,
): Promise<{ id: string; inserted: boolean } | null> {
  const existing = await findExistingDiagnostician(supabase, row.dhupSourceId)

  // Slug : on conserve si existant, sinon on en genere un nouveau via RPC
  let slug = existing?.slug ?? null
  if (!slug) {
    const { data: slugData, error: slugErr } = await supabase.rpc('generate_unique_diag_slug', {
      p_first: row.firstName,
      p_last: row.lastName,
      p_postal: row.postalCode ?? row.departmentCode,
    })
    if (slugErr) {
      console.error(`[absorb-dhup] slug rpc failed for ${row.dhupSourceId}: ${slugErr.message}`)
      return null
    }
    slug = String(slugData)
  }

  // Payload commun (insert + update)
  // Les certifications restent stockees aussi en JSONB (retrocompat avec
  // le code existant qui lit `diagnosticians.certifications`).
  const certifJson = row.certifications.map((c) => ({
    type: c.type,
    organism: c.organism,
    number: c.number,
    valid_until: c.validUntil,
    status: 'valid' as const,
  }))

  // NB: postal_code/official_email/official_phone/slug_dept n'existent pas
  // sur la table `diagnosticians`. Mapping canonique :
  //   postal_code → postcode, official_email → email, official_phone → phone.
  // FIX-RR (migration 20260524410000) : official_company_name → company_name
  // (raison sociale societe d'exercice DHUP "Societe", visible en UI publique
  // a la place du nom du gerant). `slug_dept` n'a pas d'equivalent : omis.
  // `full_name` est reconstruit a partir de first_name + last_name pour les
  // lookups annuaire (cf. trigger DB ou compute applicatif aval).
  const payload = {
    dhup_source_id: row.dhupSourceId,
    first_name: row.firstName,
    last_name: row.lastName,
    full_name: `${row.firstName} ${row.lastName}`.trim(),
    company_name: row.officialCompanyName,
    city: row.city,
    postcode: row.postalCode,
    department_code: row.departmentCode,
    address: row.address,
    certifications: certifJson,
    email: row.officialEmail,
    phone: row.officialPhone,
    sirene_siret: row.siret,
    slug,
    slug_city: slugify(row.city),
    dhup_last_synced_at: new Date().toISOString(),
  }

  if (existing) {
    const { error } = await supabase.from('diagnosticians').update(payload).eq('id', existing.id)
    if (error) {
      console.error(`[absorb-dhup] update failed for ${row.dhupSourceId}: ${error.message}`)
      return null
    }
    return { id: existing.id, inserted: false }
  }

  const { data, error } = await supabase
    .from('diagnosticians')
    .insert({ ...payload, dhup_imported_at: new Date().toISOString() })
    .select('id')
    .single<{ id: string }>()
  if (error || !data) {
    console.error(`[absorb-dhup] insert failed for ${row.dhupSourceId}: ${error?.message}`)
    return null
  }
  return { id: data.id, inserted: true }
}

/**
 * UPSERT idempotent des certifications dans la table normalisee.
 * On utilise `onConflict` sur la contrainte UNIQUE
 * (diagnostician_id, certification_type, organism, certification_number).
 *
 * Renvoie le nombre de lignes effectivement ecrites (insert OU update).
 */
async function upsertCertifications(
  supabase: SupabaseClient,
  diagnosticianId: string,
  certifications: DhupCertification[],
): Promise<number> {
  if (certifications.length === 0) return 0
  const now = new Date().toISOString()
  const rows = certifications.map((c) => ({
    diagnostician_id: diagnosticianId,
    certification_type: c.type,
    organism: c.organism,
    certification_number: c.number,
    valid_until: c.validUntil,
    status: 'valid' as const,
    source: 'DHUP' as const,
    last_verified_at: now,
  }))
  const { error } = await supabase.from('diagnostician_certifications').upsert(rows, {
    onConflict: 'diagnostician_id,certification_type,organism,certification_number',
    ignoreDuplicates: false,
  })
  if (error) {
    console.error(`[absorb-dhup] cert upsert failed for ${diagnosticianId}: ${error.message}`)
    return 0
  }
  return rows.length
}

/**
 * Soft-delete : marque en `validation_status = 'pending'` les fiches DHUP
 * absentes du dernier import (non vues lors de cette execution).
 *
 * Heuristique : `dhup_last_synced_at < importStartedAt` et
 * `dhup_source_id IS NOT NULL` (on epargne les fiches manuelles).
 */
async function markCeasedDiagnosticians(
  supabase: SupabaseClient,
  importStartedAt: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('diagnosticians')
    .update({
      validation_status: 'pending',
      validation_status_reason: 'absent_from_latest_dhup_import',
      validation_status_changed_at: new Date().toISOString(),
    })
    .lt('dhup_last_synced_at', importStartedAt)
    .not('dhup_source_id', 'is', null)
    .neq('validation_status', 'pending')
    .select('id')
  if (error) {
    console.error(`[absorb-dhup] mark-ceased failed: ${error.message}`)
    return 0
  }
  return data?.length ?? 0
}

/**
 * Log d'audit de fin de batch — 1 log par diagnostiqueur INSERE pendant le
 * run (premier contact source DHUP), pour la timeline d'audit fiche par
 * fiche. Les fiches deja existantes ne genrent pas de log (volume).
 *
 * TODO Phase B : ajouter une table `import_runs` (sans FK diagnostician_id)
 * pour consolider les stats globales du batch. La table actuelle requiert
 * diagnostician_id NOT NULL, on ne peut donc pas y logger le batch global.
 */
async function logBatchPerNewDiagnostician(
  supabase: SupabaseClient,
  newDiagnosticianIds: string[],
  durationMs: number,
): Promise<void> {
  if (newDiagnosticianIds.length === 0) return
  const now = new Date().toISOString()
  const rows = newDiagnosticianIds.map((id) => ({
    diagnostician_id: id,
    source: 'DHUP' as const,
    outcome: 'matched' as const,
    payload: { event: 'absorb-dhup-directory', durationMs } as Record<string, unknown>,
    error_message: null,
    latency_ms: null,
    created_at: now,
  }))
  // Chunks de 500 pour ne pas exceder les limites payload Supabase REST
  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from('diagnostician_cross_validation_logs').insert(slice)
    if (error) {
      console.error(`[absorb-dhup] log insert chunk ${i} failed: ${error.message}`)
    }
  }
}

// ────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────

function isAuthorized(req: Request): boolean {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''

  const authHeader = req.headers.get('Authorization') ?? ''
  if (serviceKey && authHeader === `Bearer ${serviceKey}`) return true

  const cronHeader = req.headers.get('x-cron-secret') ?? ''
  if (cronSecret && cronHeader === cronSecret) return true

  return false
}

// ────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  const t0 = Date.now()
  const importStartedAt = new Date().toISOString()
  const errors: string[] = []

  try {
    // ─── Auth ───
    if (!isAuthorized(req)) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ─── Supabase admin client ───
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !supabaseServiceKey) {
      const response: AbsorbResponse = {
        ok: false,
        imported: 0,
        updated: 0,
        ceased: 0,
        errors: 1,
        durationMs: Date.now() - t0,
        error: 'missing supabase env (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)',
      }
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ─── Resolve dataset URL ───
    const datasetUrl = Deno.env.get('DHUP_DATASET_RESOURCE_URL')
    if (!datasetUrl) {
      const response: AbsorbResponse = {
        ok: false,
        imported: 0,
        updated: 0,
        ceased: 0,
        errors: 1,
        durationMs: Date.now() - t0,
        error: 'DHUP_DATASET_RESOURCE_URL non configuree',
      }
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ─── Download ───
    let csvText = ''
    try {
      const res = await fetch(datasetUrl, {
        headers: {
          Accept: 'text/csv, application/octet-stream',
          'Accept-Encoding': 'gzip',
        },
      })
      if (!res.ok) {
        const response: AbsorbResponse = {
          ok: false,
          imported: 0,
          updated: 0,
          ceased: 0,
          errors: 1,
          durationMs: Date.now() - t0,
          error: `download failed: HTTP ${res.status}`,
        }
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      csvText = await res.text()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const response: AbsorbResponse = {
        ok: false,
        imported: 0,
        updated: 0,
        ceased: 0,
        errors: 1,
        durationMs: Date.now() - t0,
        error: `download exception: ${message}`,
      }
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ─── Parse ───
    const rows = await parseCsvStream(csvText)
    if (rows.length === 0) {
      const response: AbsorbResponse = {
        ok: false,
        imported: 0,
        updated: 0,
        ceased: 0,
        errors: 1,
        durationMs: Date.now() - t0,
        error: 'CSV parse a renvoye 0 lignes — verifier headers et separateur',
      }
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ─── Upsert loop ───
    let imported = 0
    let updated = 0
    let errorCount = 0
    let certificationsUpserted = 0
    const newDiagnosticianIds: string[] = []

    for (const row of rows) {
      try {
        const result = await upsertDiagnostician(supabase, row)
        if (!result) {
          errorCount++
          errors.push(`upsert ${row.dhupSourceId} failed`)
          continue
        }
        if (result.inserted) {
          imported++
          newDiagnosticianIds.push(result.id)
        } else {
          updated++
        }
        certificationsUpserted += await upsertCertifications(
          supabase,
          result.id,
          row.certifications,
        )
      } catch (err) {
        errorCount++
        const message = err instanceof Error ? err.message : String(err)
        errors.push(`row ${row.dhupSourceId}: ${message}`)
      }
    }

    // ─── Soft-delete fiches absentes ───
    const ceased = await markCeasedDiagnosticians(supabase, importStartedAt)

    // ─── Audit log ───
    const durationMs = Date.now() - t0
    await logBatchPerNewDiagnostician(supabase, newDiagnosticianIds, durationMs)

    // ─── Response ───
    const response: AbsorbResponse = {
      ok: errorCount === 0,
      imported,
      updated,
      ceased,
      errors: errorCount,
      durationMs,
      totalRows: rows.length,
      certificationsUpserted,
      errorMessages: errors.slice(0, 50),
    }
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const response: AbsorbResponse = {
      ok: false,
      imported: 0,
      updated: 0,
      ceased: 0,
      errors: 1,
      durationMs: Date.now() - t0,
      error: `unhandled exception: ${message}`,
    }
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
