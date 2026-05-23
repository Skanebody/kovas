/**
 * KOVAS — Import du dataset DHUP officiel via PostgREST bulk (Node 22 TS strip-types).
 *
 * Source : https://www.data.gouv.fr/api/1/datasets/r/7987214d-949e-4245-b005-5cc4e7a5df36
 *          (Annuaire des diagnostiqueurs immobiliers certifies — DHUP / Etalab 2.0)
 *
 * Mode operatoire :
 *   1. Telecharge le CSV (16-17 MB, ~74k lignes ≈ 13k diagnostiqueurs uniques)
 *   2. Parse en memoire avec deduplication par dhup_source_id (hash SHA-256)
 *      → fusionne les certifications multiples (1 ligne CSV = 1 certif)
 *   3. UPSERT bulk en chunks de 500 via PostgREST :
 *      `POST /rest/v1/diagnosticians?on_conflict=dhup_source_id`
 *      `Prefer: resolution=merge-duplicates, return=minimal`
 *   4. Purge les fixtures demo `fix_*` en fin de run (DELETE)
 *
 * Pourquoi pas l'Edge Function `absorb-dhup-directory` ?
 *   - Timeout Edge Function = 150s CPU max → insuffisant pour 13k UPSERTs serie.
 *   - PostgREST bulk batche 500 rows par requete REST → ~26 requetes,
 *     finit en < 60s sur connection residentielle.
 *
 * Usage :
 *   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx \
 *     node --experimental-strip-types scripts/import-dhup-real.ts
 *
 * Variables d'env :
 *   • SUPABASE_SERVICE_ROLE_KEY (requis) — service_role JWT
 *   • SUPABASE_PROJECT_REF      (defaut: jlizdkffwjdiokvmhcwg)
 *   • DHUP_DATASET_RESOURCE_URL (defaut: URL officielle data.gouv.fr)
 *   • DHUP_CSV_LOCAL_PATH       (optionnel — bypass download, lit un CSV local)
 *   • DRY_RUN=1                 (n'ecrit rien en DB, juste parse + log)
 *   • PURGE_FIXTURES=1          (defaut: 1 — delete fix_% apres import)
 *   • CHUNK_SIZE                (defaut: 500)
 */

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

// ────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'jlizdkffwjdiokvmhcwg'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DHUP_URL =
  process.env.DHUP_DATASET_RESOURCE_URL ??
  'https://www.data.gouv.fr/api/1/datasets/r/7987214d-949e-4245-b005-5cc4e7a5df36'
const LOCAL_PATH = process.env.DHUP_CSV_LOCAL_PATH
const DRY_RUN = process.env.DRY_RUN === '1'
const PURGE_FIXTURES = process.env.PURGE_FIXTURES !== '0'
const CHUNK_SIZE = Number.parseInt(process.env.CHUNK_SIZE ?? '500', 10)

if (!SERVICE_KEY && !DRY_RUN) {
  console.error('ERREUR : SUPABASE_SERVICE_ROLE_KEY manquant. Set DRY_RUN=1 pour bypass.')
  process.exit(1)
}

const REST_BASE = `https://${PROJECT_REF}.supabase.co/rest/v1`

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

type CertificationType =
  | 'DPE'
  | 'AMIANTE'
  | 'PLOMB'
  | 'GAZ'
  | 'ELECTRICITE'
  | 'TERMITES'
  | 'CARREZ'
  | 'ERP'

interface DhupCertJson {
  type: CertificationType
  organism: string
  number: string
  valid_until: string | null
  status: 'valid'
}

interface DiagPayload {
  dhup_source_id: string
  first_name: string
  last_name: string
  full_name: string
  city: string
  postcode: string | null
  department_code: string
  address: string | null
  certifications: DhupCertJson[]
  email: string | null
  phone: string | null
  slug: string
  slug_city: string
  dhup_imported_at: string
  dhup_last_synced_at: string
}

// ────────────────────────────────────────────────────────────
// Slugify + normalisation
// ────────────────────────────────────────────────────────────

/**
 * Plage Unicode des combining diacritical marks (U+0300 → U+036F) :
 * accents combinatoires apres NFD decomposition.
 */
// biome-ignore lint/suspicious/noMisleadingCharacterClass: plage Unicode U+0300-U+036F intentionnelle (accents combinatoires post-NFD)
const DIACRITICS_RE = /[̀-ͯ]/g
const BOM_RE = /^﻿/

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(DIACRITICS_RE, '')
}

function slugify(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeHeader(raw: string): string {
  return stripDiacritics(raw.replace(BOM_RE, '').replace(/^"|"$/g, '').trim())
    .toLowerCase()
    .replace(/[°º]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function computeDhupSourceId(
  siret: string | null,
  firstName: string,
  lastName: string,
  departmentCode: string,
): string {
  const norm = (v: string): string => stripDiacritics(v.trim()).toLowerCase()
  const key =
    siret && /^\d{14}$/.test(siret)
      ? `siret:${siret}`
      : `name:${norm(lastName)}|${norm(firstName)}|${departmentCode}`
  return `dhup_${sha256Hex(key).substring(0, 24)}`
}

function normalizeCertType(label: string): CertificationType | null {
  const up = stripDiacritics(label.toUpperCase())
  if (up.includes('DPE') || up.includes('PERFORMANCE')) return 'DPE'
  if (up.includes('AMIANTE')) return 'AMIANTE'
  if (up.includes('PLOMB') || up.includes('CREP')) return 'PLOMB'
  if (up.includes('GAZ')) return 'GAZ'
  if (up.includes('ELEC')) return 'ELECTRICITE'
  if (up.includes('TERMITE')) return 'TERMITES'
  if (up.includes('CARREZ') || up.includes('BOUTIN') || up.includes('SURFACE')) return 'CARREZ'
  if (up.includes('ERP') || up.includes('RISQUE')) return 'ERP'
  return null
}

function parseDhupDate(value: string | null): string | null {
  if (!value) return null
  const t = value.trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const fr = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`
  return null
}

// ────────────────────────────────────────────────────────────
// CSV parsing
// ────────────────────────────────────────────────────────────

function parseCsvCells(line: string, separator: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === separator && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  cells.push(current.trim())
  return cells
}

interface ParsedRow {
  dhupSourceId: string
  firstName: string
  lastName: string
  city: string
  postalCode: string | null
  departmentCode: string
  address: string | null
  email: string | null
  phone: string | null
  companyName: string | null
  siret: string | null
  certifications: DhupCertJson[]
}

function buildHeaderIndex(headerLine: string): {
  sep: string
  idx: Record<string, number>
} {
  const sep = headerLine.includes(';') ? ';' : ','
  const cols = parseCsvCells(headerLine, sep).map(normalizeHeader)
  const find = (...candidates: string[]): number => {
    for (const c of candidates) {
      const i = cols.indexOf(c)
      if (i !== -1) return i
    }
    return -1
  }
  const idx = {
    nom: find('nom', 'last_name'),
    prenom: find('prenom', 'first_name'),
    societe: find('societe', 'raison_sociale', 'entreprise'),
    adresse: find('adresse', 'address'),
    cp: find('cp', 'code_postal', 'postcode'),
    ville: find('ville', 'commune', 'city'),
    tel1: find('tel1', 'tel_1', 'telephone', 'phone'),
    email: find('email', 'courriel', 'mail'),
    organisme: find('organisme', 'organisme_certif'),
    typeCertif: find('type_de_certificat', 'type_certificat', 'certifications', 'certification'),
    numCertif: find('n_de_certificat', 'numero_certificat', 'numero'),
    finValidite: find(
      'date_fin_validite',
      'date_de_fin_validite',
      'date_validite',
      'validite',
      'valid_until',
    ),
    siret: find('siret', 'n_siret'),
    dept: find('departement', 'code_departement'),
  }
  return { sep, idx }
}

function parseLine(line: string, sep: string, idx: Record<string, number>): ParsedRow | null {
  const cells = parseCsvCells(line, sep).map((c) => c.replace(/^"|"$/g, '').trim())
  const get = (k: string): string => (idx[k] !== -1 ? (cells[idx[k]] ?? '') : '')

  const lastName = get('nom')
  const firstName = get('prenom')
  const city = get('ville')
  if (!lastName || !firstName || !city) return null

  const postalCode = get('cp') || null
  const departmentCode = get('dept') || (postalCode ? postalCode.substring(0, 2) : '')
  if (!departmentCode) return null

  const rawSiret = get('siret').replace(/\s+/g, '')
  const siret = /^\d{14}$/.test(rawSiret) ? rawSiret : null

  const certLabel = get('typeCertif')
  const certType = normalizeCertType(certLabel)
  const certifications: DhupCertJson[] = certType
    ? [
        {
          type: certType,
          organism: get('organisme') || 'inconnu',
          number: get('numCertif') || 'inconnu',
          valid_until: parseDhupDate(get('finValidite')),
          status: 'valid',
        },
      ]
    : []

  return {
    dhupSourceId: computeDhupSourceId(siret, firstName, lastName, departmentCode),
    firstName,
    lastName,
    city,
    postalCode,
    departmentCode,
    address: get('adresse') || null,
    email: get('email') || null,
    phone: get('tel1') || null,
    companyName: get('societe') || null,
    siret,
    certifications,
  }
}

function parseCsv(csvText: string): ParsedRow[] {
  const rawLines = csvText.split(/\r?\n/)
  if (rawLines.length < 2) return []
  const headerLine = rawLines[0]?.trim() ?? ''
  if (!headerLine) return []
  const { sep, idx } = buildHeaderIndex(headerLine)
  if (idx.nom === -1 || idx.prenom === -1 || idx.ville === -1) {
    console.error('ERREUR parsing : colonnes Nom/Prenom/Ville introuvables.')
    console.error('Index detecte :', idx)
    return []
  }

  const byId = new Map<string, ParsedRow>()
  let skipped = 0
  for (let i = 1; i < rawLines.length; i++) {
    const line = rawLines[i]
    if (!line?.trim()) continue
    const parsed = parseLine(line, sep, idx)
    if (!parsed) {
      skipped++
      continue
    }
    const existing = byId.get(parsed.dhupSourceId)
    if (existing) {
      const seen = new Set(
        existing.certifications.map((c) => `${c.type}|${c.organism}|${c.number}`),
      )
      for (const c of parsed.certifications) {
        const k = `${c.type}|${c.organism}|${c.number}`
        if (!seen.has(k)) {
          existing.certifications.push(c)
          seen.add(k)
        }
      }
      existing.email = existing.email ?? parsed.email
      existing.phone = existing.phone ?? parsed.phone
      existing.companyName = existing.companyName ?? parsed.companyName
      existing.address = existing.address ?? parsed.address
      existing.siret = existing.siret ?? parsed.siret
    } else {
      byId.set(parsed.dhupSourceId, parsed)
    }
  }
  console.log(
    `[parse] ${rawLines.length - 1} lignes, ${byId.size} diagnostiqueurs uniques, ${skipped} lignes skip.`,
  )
  return Array.from(byId.values())
}

// ────────────────────────────────────────────────────────────
// Slug generation (cote client — collision rare via dhup_source_id UNIQUE)
// ────────────────────────────────────────────────────────────

function buildSlug(firstName: string, lastName: string, postalCode: string | null): string {
  const base = slugify(`${firstName}-${lastName}`)
  const suffix = postalCode ?? 'fr'
  return `${base || 'diagnostiqueur'}-${suffix}`
}

// ────────────────────────────────────────────────────────────
// PostgREST bulk UPSERT
// ────────────────────────────────────────────────────────────

interface UpsertResult {
  ok: boolean
  status: number
  body?: string
}

async function bulkUpsert(rows: DiagPayload[]): Promise<UpsertResult> {
  if (DRY_RUN) return { ok: true, status: 200 }
  // NB : on tente d'abord un POST simple (INSERT). Si l'UNIQUE dhup_source_id
  // est violee (re-run de l'import), on bascule sur strategie alternative :
  //   - dhup_source_id UNIQUE est `DEFERRABLE` cote DB → on_conflict refuse.
  //   - On filtre cote client les dhup_source_id deja en base avant chaque chunk.
  const res = await fetch(`${REST_BASE}/diagnosticians`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY as string,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const body = await res.text()
    return { ok: false, status: res.status, body }
  }
  return { ok: true, status: res.status }
}

/** Recupere les dhup_source_id deja en base (pour skip les doublons). */
async function fetchExistingDhupIds(): Promise<Set<string>> {
  const seen = new Set<string>()
  let offset = 0
  const pageSize = 1000
  while (true) {
    const url = `${REST_BASE}/diagnosticians?select=dhup_source_id&dhup_source_id=not.is.null&offset=${offset}&limit=${pageSize}`
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY as string,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    })
    if (!res.ok) {
      console.error(`[prefetch] HTTP ${res.status}: ${await res.text()}`)
      break
    }
    const rows = (await res.json()) as Array<{ dhup_source_id: string | null }>
    if (rows.length === 0) break
    for (const r of rows) if (r.dhup_source_id) seen.add(r.dhup_source_id)
    if (rows.length < pageSize) break
    offset += pageSize
  }
  return seen
}

async function purgeFixtures(): Promise<number> {
  if (DRY_RUN) {
    console.log('[purge] DRY_RUN — skip')
    return 0
  }
  const res = await fetch(`${REST_BASE}/diagnosticians?dhup_source_id=like.fix_*&select=id`, {
    method: 'DELETE',
    headers: {
      apikey: SERVICE_KEY as string,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'return=representation',
    },
  })
  if (!res.ok) {
    console.error(`[purge] echec HTTP ${res.status}: ${await res.text()}`)
    return 0
  }
  const deleted = (await res.json()) as unknown[]
  return deleted.length
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const t0 = Date.now()
  console.log(
    `[KOVAS] Import DHUP — DRY_RUN=${DRY_RUN}, PURGE=${PURGE_FIXTURES}, CHUNK=${CHUNK_SIZE}`,
  )
  console.log(`[KOVAS] Project=${PROJECT_REF}`)

  // 1. Telecharge OU lit le CSV local
  let csvText: string
  if (LOCAL_PATH) {
    console.log(`[download] local file: ${LOCAL_PATH}`)
    csvText = await readFile(LOCAL_PATH, 'utf-8')
  } else {
    console.log(`[download] ${DHUP_URL}`)
    const res = await fetch(DHUP_URL, {
      headers: {
        'User-Agent': 'KOVAS-Sync/1.0 (+https://kovas.fr)',
        Accept: 'text/csv',
      },
      redirect: 'follow',
    })
    if (!res.ok) {
      console.error(`[download] HTTP ${res.status}`)
      process.exit(1)
    }
    csvText = await res.text()
    console.log(`[download] ${csvText.length.toLocaleString()} chars`)
  }

  // 2. Parse + dedup
  const rows = parseCsv(csvText)
  if (rows.length === 0) {
    console.error('[parse] aucune ligne exploitable — abort.')
    process.exit(1)
  }

  // 3. Build payloads avec slug applicatif
  const now = new Date().toISOString()
  const payloads: DiagPayload[] = rows.map((r) => ({
    dhup_source_id: r.dhupSourceId,
    first_name: r.firstName,
    last_name: r.lastName,
    full_name: `${r.firstName} ${r.lastName}`.trim(),
    city: r.city,
    postcode: r.postalCode,
    department_code: r.departmentCode,
    address: r.address,
    certifications: r.certifications,
    email: r.email,
    phone: r.phone,
    slug: buildSlug(r.firstName, r.lastName, r.postalCode),
    slug_city: slugify(r.city),
    dhup_imported_at: now,
    dhup_last_synced_at: now,
  }))

  // Dedoublonne les slugs (rare mais possible si 2 diagnostiqueurs avec meme
  // nom+prenom+CP — on suffixe -2, -3 sur les doublons posterieurs).
  const slugSeen = new Map<string, number>()
  for (const p of payloads) {
    const count = slugSeen.get(p.slug) ?? 0
    if (count > 0) {
      p.slug = `${p.slug}-${count + 1}`
    }
    slugSeen.set(p.slug, count + 1)
  }

  // 4a. Purge fixtures EN PREMIER (libere les slots, evite contention UNIQUE
  // sur reruns ou doublons entre fixtures et vrais diagnostiqueurs).
  let purged = 0
  if (PURGE_FIXTURES) {
    console.log('[purge] suppression fixtures fix_*…')
    purged = await purgeFixtures()
    console.log(`[purge] ${purged} fixtures supprimees.`)
  }

  // 4b. Prefetch des dhup_source_id deja en base (idempotence : on skip)
  console.log('[prefetch] dhup_source_id existants…')
  const existingIds = DRY_RUN ? new Set<string>() : await fetchExistingDhupIds()
  console.log(`[prefetch] ${existingIds.size} dhup_source_id deja en base — seront skip.`)

  const toInsert = payloads.filter((p) => !existingIds.has(p.dhup_source_id))
  console.log(
    `[upsert] ${toInsert.length} nouvelles fiches a inserer (sur ${payloads.length} totales).`,
  )

  // 4c. Bulk INSERT en chunks
  let success = 0
  let failed = 0
  const errors: string[] = []
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE)
    const t1 = Date.now()
    const res = await bulkUpsert(chunk)
    const dt = Date.now() - t1
    if (res.ok) {
      success += chunk.length
      console.log(
        `[insert] chunk ${i / CHUNK_SIZE + 1}/${Math.ceil(toInsert.length / CHUNK_SIZE)}: OK (+${chunk.length}) ${dt}ms`,
      )
    } else {
      failed += chunk.length
      const msg = `chunk@${i}: HTTP ${res.status} — ${res.body?.substring(0, 300)}`
      console.error(`[insert] ${msg}`)
      errors.push(msg)
      if (errors.length > 10) {
        console.error('[insert] trop d erreurs consecutives — abort.')
        break
      }
    }
  }

  // 6. Summary
  const dt = (Date.now() - t0) / 1000
  console.log('────────────────────────────────────────')
  console.log(`[KOVAS] Import termine en ${dt.toFixed(1)}s`)
  console.log(`  diagnostiqueurs traites : ${success.toLocaleString()}`)
  console.log(`  echecs                  : ${failed}`)
  console.log(`  fixtures purgees        : ${purged}`)
  if (errors.length > 0) {
    console.log('\nPremiers messages d erreur :')
    for (const e of errors.slice(0, 5)) console.log(`  - ${e}`)
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
