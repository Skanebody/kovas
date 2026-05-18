#!/usr/bin/env node
/**
 * E2E test J11+J12 : export ZIP universel + ZIP Liciel stub.
 * Vérifie la génération côté API en simulant un user authentifié via cookie.
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { Client } from 'pg'
import JSZip from '/Users/benjaminbel/Desktop/KOVAS/node_modules/.pnpm/jszip@3.10.1/node_modules/jszip/dist/jszip.min.js'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8')
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const projectRoot = process.cwd()
const runnerPath = `${projectRoot}/tools/.export-runner.mts`
writeFileSync(
  runnerPath,
  `
import { buildMissionExportData } from '${projectRoot}/apps/web/src/lib/exports/build-mission-data.ts'
import { buildExportZip } from '${projectRoot}/apps/web/src/lib/exports/zip-bundle.ts'
import { buildLicielZip } from '${projectRoot}/apps/web/src/lib/exports/zip-liciel.ts'
import { generatePdf } from '${projectRoot}/apps/web/src/lib/exports/pdf.ts'
import { generateCsv } from '${projectRoot}/apps/web/src/lib/exports/csv.ts'
import { writeFileSync as wfs } from 'node:fs'

const [missionId, orgId, format] = process.argv.slice(2)
const data = await buildMissionExportData(missionId, orgId)

if (format === 'pdf-only') {
  const pdf = generatePdf(data)
  wfs('/tmp/test-mission.pdf', pdf)
  console.log(JSON.stringify({ pdf_bytes: pdf.length, mission_ref: data.mission.reference }))
} else if (format === 'csv-only') {
  console.log(generateCsv(data))
} else if (format === 'liciel') {
  const zip = await buildLicielZip(data)
  wfs('/tmp/test-mission-liciel.zip', zip)
  console.log(JSON.stringify({ zip_bytes: zip.length }))
} else {
  const zip = await buildExportZip(data)
  wfs('/tmp/test-mission-bundle.zip', zip)
  console.log(JSON.stringify({ zip_bytes: zip.length }))
}
`,
)

function run(...args) {
  const res = spawnSync('npx', ['-y', 'tsx', '--tsconfig', `${projectRoot}/apps/web/tsconfig.json`, runnerPath, ...args], {
    cwd: `${projectRoot}/apps/web`,
    encoding: 'utf-8',
  })
  if (res.status !== 0) throw new Error(`tsx: ${res.stderr}`)
  return res.stdout
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('→ Create test user + mission')
const u = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: `j11-test+${Date.now()}@kovas-e2e.fr`, password: 'Pass1234!', email_confirm: true, user_metadata: { full_name: 'J11 E2E' } }),
})
const userId = (await u.json()).id

const pg = new Client({
  host: 'db.jlizdkffwjdiokvmhcwg.supabase.co',
  port: 5432, user: 'postgres', password: process.env.SUPABASE_DB_PASSWORD,
  database: 'postgres', ssl: { rejectUnauthorized: false },
})
await pg.connect()
const { rows: profiles } = await pg.query('SELECT default_org_id FROM profiles WHERE id = $1', [userId])
const orgId = profiles[0].default_org_id
let ok = true
let cleanup = []

try {
  // Create mission with everything
  const { rows: c } = await pg.query(
    `INSERT INTO clients (organization_id, type, display_name, email, created_by) VALUES ($1, 'particulier', 'Client export test', 'export@test.fr', $2) RETURNING id`,
    [orgId, userId],
  )
  cleanup.push(['clients', c[0].id])
  const { rows: p } = await pg.query(
    `INSERT INTO properties (organization_id, client_id, address, city, postal_code, property_type, surface_total, year_built) VALUES ($1, $2, '5 rue export', 'Paris', '75001', 'appartement', 75, 1985) RETURNING id`,
    [orgId, c[0].id],
  )
  cleanup.push(['properties', p[0].id])
  const { rows: refs } = await pg.query(`SELECT public.next_reference($1, 'mission') AS ref`, [orgId])
  const { rows: m } = await pg.query(
    `INSERT INTO missions (organization_id, property_id, client_id, reference, type, status, completed_at, created_by, assigned_to) VALUES ($1, $2, $3, $4, 'dpe_vente', 'done', NOW(), $5, $5) RETURNING id`,
    [orgId, p[0].id, c[0].id, refs[0].ref, userId],
  )
  cleanup.push(['missions', m[0].id])

  // Add 2 rooms + 1 voice note
  const { rows: rooms } = await pg.query(
    `INSERT INTO mission_rooms (mission_id, organization_id, name, room_type, surface_m2, position) VALUES ($1, $2, 'Salon', 'salon', 30, 0), ($1, $2, 'Cuisine', 'cuisine', 12, 1) RETURNING id`,
    [m[0].id, orgId],
  )
  await pg.query(
    `INSERT INTO voice_notes (mission_id, organization_id, storage_path, duration_seconds, status, transcript_raw, transcript_structured, parser_used, ai_confidence, recorded_by, language)
     VALUES ($1, $2, $3, 45, 'transcribed', $4, $5::jsonb, 'custom_js', 0.85, $6, 'fr')`,
    [
      m[0].id, orgId, `${orgId}/${m[0].id}/test.webm`,
      'Salon de 30 mètres carrés, chaudière Saunier Duval, double vitrage PVC.',
      JSON.stringify({ surface_m2: 30, equipment: [{ kind: 'chaudiere', brand: 'Saunier Duval' }], observations: [], raw_keywords: [], confidence: 0.85 }),
      userId,
    ],
  )

  // ===== Tests =====
  console.log(`\n=== Generate PDF for ${refs[0].ref} ===`)
  const pdfOut = JSON.parse(run(m[0].id, orgId, 'pdf-only'))
  if (pdfOut.pdf_bytes > 1000) {
    console.log(`  ✓ PDF généré : ${pdfOut.pdf_bytes} bytes`)
  } else {
    console.log(`  ❌ PDF trop petit`)
    ok = false
  }

  console.log('\n=== Generate CSV ===')
  const csv = run(m[0].id, orgId, 'csv-only')
  if (csv.includes(refs[0].ref) && csv.includes('Salon') && csv.includes('chaudiere')) {
    console.log(`  ✓ CSV contient référence + Salon + chaudière`)
  } else {
    console.log(`  ❌ CSV incomplet`)
    ok = false
  }

  console.log('\n=== Generate ZIP universel ===')
  const zipOut = JSON.parse(run(m[0].id, orgId, 'bundle'))
  if (zipOut.zip_bytes > 5000) {
    console.log(`  ✓ ZIP universel : ${zipOut.zip_bytes} bytes`)
  } else {
    console.log(`  ❌ ZIP trop petit`)
    ok = false
  }

  // Verify ZIP contents
  const zipBuf = readFileSync('/tmp/test-mission-bundle.zip')
  const zip = await JSZip.loadAsync(zipBuf)
  const expectedFiles = ['README.txt', 'rapport.pdf', 'rapport.docx', 'donnees.csv', 'donnees.json']
  const missing = expectedFiles.filter((f) => !zip.files[f])
  if (missing.length === 0) {
    console.log(`  ✓ ZIP contient les 5 fichiers attendus`)
  } else {
    console.log(`  ❌ ZIP manque: ${missing.join(', ')}`)
    ok = false
  }

  console.log('\n=== Generate ZIP Liciel ===')
  const lOut = JSON.parse(run(m[0].id, orgId, 'liciel'))
  const lZip = await JSZip.loadAsync(readFileSync('/tmp/test-mission-liciel.zip'))
  const expectedLiciel = ['LISEZ-MOI.txt', 'XML/LIV_administratif.xml', 'XML/LIV_donnees.xml', 'XML/LIV_DPE.xml']
  const missingL = expectedLiciel.filter((f) => !lZip.files[f])
  if (missingL.length === 0) {
    console.log(`  ✓ ZIP Liciel : ${lOut.zip_bytes} bytes, ${expectedLiciel.length} fichiers attendus présents`)
  } else {
    console.log(`  ❌ ZIP Liciel manque: ${missingL.join(', ')}`)
    ok = false
  }
} catch (err) {
  console.log(`  ❌ ${err.message}`)
  ok = false
} finally {
  console.log('\n→ Cleanup')
  for (const [t, id] of cleanup.reverse()) await pg.query(`DELETE FROM ${t} WHERE id = $1`, [id])
  await pg.query('UPDATE profiles SET default_org_id = NULL WHERE id = $1', [userId])
  await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  await pg.query('DELETE FROM memberships WHERE organization_id = $1', [orgId])
  await pg.query('DELETE FROM organizations WHERE id = $1', [orgId])
  await pg.end()
  try { unlinkSync(runnerPath) } catch {}
}

console.log(`\n${ok ? '✅' : '❌'} J11+J12 ${ok ? 'PASSED' : 'FAILED'}`)
process.exit(ok ? 0 : 1)
