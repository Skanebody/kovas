/**
 * KOVAS — FIX-RR : Backfill de la colonne `diagnosticians.company_name`
 *
 * Re-telecharge le dataset DHUP officiel data.gouv.fr et met a jour le champ
 * `company_name` (raison sociale, colonne "Societe" du CSV) pour les ~13 856
 * lignes existantes en base.
 *
 * Strategie de matching :
 *   1. Reconstruire le dhup_source_id stable (SHA-256 du SIRET ou du couple
 *      nom+prenom+dept) comme dans l'edge function `absorb-dhup-directory`.
 *   2. Update WHERE dhup_source_id = ? AND company_name IS NULL (idempotent).
 *
 * Reconnait egalement les types de certification "Audit energetique" → DPE_MENTION
 * (audit avec mention reglementaire) et met a jour le jsonb `certifications`
 * en consequence (utile si l'edge function n'avait jamais ete redeployee).
 *
 * Usage :
 *   SUPABASE_URL=https://jlizdkffwjdiokvmhcwg.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   pnpm tsx scripts/backfill-company-name-dhup.ts
 *
 * Le script est idempotent : peut etre relance sans risque, ne touche que
 * les fiches dont company_name est NULL (ou DPE_MENTION absent du jsonb).
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const DHUP_URL =
  process.env.DHUP_DATASET_RESOURCE_URL ??
  'https://www.data.gouv.fr/api/1/datasets/r/7987214d-949e-4245-b005-5cc4e7a5df36'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[backfill-company-name] SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const DIACRITICS_RE = /[̀-ͯ]/g

function normalize(s: string | null | undefined): string {
  if (!s) return ''
  return s.trim().normalize('NFD').replace(DIACRITICS_RE, '').toLowerCase()
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function computeDhupSourceId(
  siret: string | null,
  firstName: string,
  lastName: string,
  deptCode: string,
): string {
  const key =
    siret && siret.length === 14
      ? `siret:${siret}`
      : `name:${normalize(lastName)}|${normalize(firstName)}|${deptCode}`
  return `dhup_${sha256Hex(key).substring(0, 24)}`
}

function parseCsvCells(line: string, sep: ',' | ';'): string[] {
  const cells: string[] = []
  let current = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        current += '"'
        i++
      } else inQ = !inQ
    } else if (ch === sep && !inQ) {
      cells.push(current.trim())
      current = ''
    } else current += ch
  }
  cells.push(current.trim())
  return cells.map((c) => c.replace(/^"|"$/g, '').trim())
}

interface ParsedRow {
  dhupSourceId: string
  companyName: string | null
  certType: string | null
}

function normalizeCertType(label: string): string | null {
  const up = label.toUpperCase().normalize('NFD').replace(DIACRITICS_RE, '')
  if (up.includes('AUDIT') || up.includes('MENTION')) return 'DPE_MENTION'
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

async function parseDhupCsv(): Promise<Map<string, { companyName: string | null; certTypes: Set<string> }>> {
  console.log(`[backfill] download CSV ${DHUP_URL} ...`)
  const res = await fetch(DHUP_URL, {
    headers: { Accept: 'text/csv', 'Accept-Encoding': 'gzip' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} download failed`)
  const csv = await res.text()
  const lines = csv.split(/\r?\n/)
  if (lines.length < 2) throw new Error('CSV vide')

  const headerLine = lines[0].trim()
  const sep = headerLine.includes(';') ? ';' : ','
  const cols = parseCsvCells(headerLine, sep).map((c) =>
    c
      .replace(/^﻿/, '')
      .normalize('NFD')
      .replace(DIACRITICS_RE, '')
      .toLowerCase()
      .replace(/[°º]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, ''),
  )

  const idxNom = cols.indexOf('nom')
  const idxPrenom = cols.indexOf('prenom')
  const idxCp = cols.indexOf('cp')
  const idxSocity = cols.indexOf('societe')
  const idxCertif = cols.indexOf('type_de_certificat')
  if (idxNom === -1 || idxPrenom === -1 || idxSocity === -1) {
    throw new Error(`Header CSV inattendu : ${cols.join(',')}`)
  }

  const map = new Map<string, { companyName: string | null; certTypes: Set<string> }>()
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || !line.trim()) continue
    const cells = parseCsvCells(line, sep)
    const lastName = cells[idxNom] ?? ''
    const firstName = cells[idxPrenom] ?? ''
    const cp = idxCp !== -1 ? cells[idxCp] ?? '' : ''
    if (!lastName || !firstName || !cp) continue
    const deptCode = cp.substring(0, 2)
    const companyName = (cells[idxSocity] ?? '').trim() || null
    const certType = idxCertif !== -1 ? normalizeCertType(cells[idxCertif] ?? '') : null

    const id = computeDhupSourceId(null, firstName, lastName, deptCode)
    const existing = map.get(id)
    if (existing) {
      if (companyName && !existing.companyName) existing.companyName = companyName
      if (certType) existing.certTypes.add(certType)
    } else {
      map.set(id, {
        companyName,
        certTypes: certType ? new Set([certType]) : new Set(),
      })
    }
  }
  console.log(`[backfill] CSV parse : ${map.size} fiches uniques`)
  return map
}

async function applyBackfill(
  parsed: Map<string, { companyName: string | null; certTypes: Set<string> }>,
): Promise<{ updatedCompany: number; updatedCerts: number; missing: number; errors: number }> {
  let updatedCompany = 0
  let updatedCerts = 0
  let missing = 0
  let errors = 0

  // Pull all diagnosticians with dhup_source_id, by chunks of 1000.
  const PAGE = 1000
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('diagnosticians')
      .select('id, dhup_source_id, company_name, certifications')
      .not('dhup_source_id', 'is', null)
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (error) {
      console.error(`[backfill] page ${offset} error: ${error.message}`)
      errors++
      break
    }
    if (!data || data.length === 0) break

    for (const row of data) {
      const dhupId = row.dhup_source_id as string
      const target = parsed.get(dhupId)
      if (!target) {
        missing++
        continue
      }

      const update: Record<string, unknown> = {}

      // 1) Company name (only if currently NULL)
      if (target.companyName && !row.company_name) {
        update.company_name = target.companyName
      }

      // 2) Add DPE_MENTION cert if not already present
      const currentCerts: Array<{ type?: string }> = Array.isArray(row.certifications)
        ? (row.certifications as Array<{ type?: string }>)
        : []
      if (target.certTypes.has('DPE_MENTION')) {
        const hasMention = currentCerts.some((c) => c?.type === 'DPE_MENTION')
        if (!hasMention) {
          update.certifications = [
            ...currentCerts,
            {
              type: 'DPE_MENTION',
              organism: 'inconnu',
              number: 'inconnu',
              valid_until: null,
              status: 'valid',
            },
          ]
        }
      }

      if (Object.keys(update).length === 0) continue

      const { error: updateError } = await supabase
        .from('diagnosticians')
        .update(update)
        .eq('id', row.id)
      if (updateError) {
        errors++
        continue
      }
      if ('company_name' in update) updatedCompany++
      if ('certifications' in update) updatedCerts++
    }

    console.log(
      `[backfill] page ${offset}/${offset + data.length} processed (company+${updatedCompany}, mention+${updatedCerts}, missing=${missing}, err=${errors})`,
    )
    if (data.length < PAGE) break
  }

  return { updatedCompany, updatedCerts, missing, errors }
}

async function main() {
  const t0 = Date.now()
  const parsed = await parseDhupCsv()
  const stats = await applyBackfill(parsed)
  const durationMs = Date.now() - t0
  console.log('[backfill] DONE', { ...stats, durationMs })
}

main().catch((err) => {
  console.error('[backfill] FATAL', err)
  process.exit(1)
})
