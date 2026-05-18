#!/usr/bin/env node
/**
 * E2E test J9 : lien public upload client.
 *  - Crée user + mission + token
 *  - Vérifie que /upload/[token] retourne 200 avec le bon contenu
 *  - Vérifie que /upload/INVALID retourne 200 + page "Lien invalide"
 *  - Upload un fichier via /api/upload-owner-document
 *  - Vérifie ligne dans owner_documents
 *  - Cleanup
 */
import { readFileSync } from 'node:fs'
import { Client } from 'pg'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8')
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const BASE = 'http://localhost:3000'
const TEST_EMAIL = `j9-test+${Date.now()}@kovas-e2e.fr`

console.log(`→ Create user ${TEST_EMAIL}`)
const u = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TEST_EMAIL, password: 'Pass1234!', email_confirm: true, user_metadata: { full_name: 'J9 E2E' } }),
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
  // Create client + property + mission with token
  const { rows: c } = await pg.query(
    `INSERT INTO clients (organization_id, type, display_name, created_by) VALUES ($1, 'particulier', 'Client J9', $2) RETURNING id`,
    [orgId, userId],
  )
  cleanup.push(['clients', c[0].id])
  const { rows: p } = await pg.query(
    `INSERT INTO properties (organization_id, client_id, address, city, postal_code) VALUES ($1, $2, '5 rue test', 'Paris', '75001') RETURNING id`,
    [orgId, c[0].id],
  )
  cleanup.push(['properties', p[0].id])
  const { rows: refs } = await pg.query(`SELECT public.next_reference($1, 'mission') AS ref`, [orgId])
  const token = `TKN${Math.random().toString(36).slice(2, 20)}TEST`
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
  const { rows: m } = await pg.query(
    `INSERT INTO missions (organization_id, property_id, client_id, reference, type, status, client_upload_token, client_upload_expires_at, created_by, assigned_to)
     VALUES ($1, $2, $3, $4, 'dpe_vente', 'in_progress', $5, $6, $7, $7) RETURNING id`,
    [orgId, p[0].id, c[0].id, refs[0].ref, token, expiresAt, userId],
  )
  const missionId = m[0].id
  cleanup.push(['missions', missionId])
  console.log(`  ✓ mission ${refs[0].ref} avec token ${token.slice(0, 8)}...`)

  // 1. Public page accessible without auth
  const r1 = await fetch(`${BASE}/upload/${token}`)
  const body1 = await r1.text()
  if (r1.status === 200 && body1.includes('Documents pour votre diagnostic') && body1.includes(refs[0].ref)) {
    console.log('  ✓ /upload/[token] valide rend la page')
  } else {
    console.log(`  ❌ /upload/[token] status=${r1.status}, contient référence ? ${body1.includes(refs[0].ref)}`)
    ok = false
  }

  // 2. Invalid token shows "Lien invalide"
  const r2 = await fetch(`${BASE}/upload/INVALID_TOKEN_${Date.now()}`)
  const body2 = await r2.text()
  if (r2.status === 200 && body2.includes('Lien invalide')) {
    console.log('  ✓ /upload/INVALID rend "Lien invalide"')
  } else {
    console.log(`  ❌ /upload/INVALID inattendu (${r2.status})`)
    ok = false
  }

  // 3. Upload a fake document via API
  const fd = new FormData()
  fd.append('token', token)
  fd.append('docKind', 'facture_energie')
  const blob = new Blob(['PDF stub content for test'], { type: 'application/pdf' })
  fd.append('file', blob, 'facture-test.pdf')

  const r3 = await fetch(`${BASE}/api/upload-owner-document`, { method: 'POST', body: fd })
  const j3 = await r3.json()
  if (r3.ok && j3.ok) {
    console.log(`  ✓ /api/upload-owner-document accepte le fichier (path: ${j3.storagePath?.slice(0, 50)}...)`)
  } else {
    console.log(`  ❌ upload échoué ${r3.status}: ${JSON.stringify(j3)}`)
    ok = false
  }

  // 4. Verify owner_documents row exists
  const { rows: docs } = await pg.query(
    `SELECT id, original_name, doc_kind, mime_type FROM owner_documents WHERE mission_id = $1`,
    [missionId],
  )
  if (docs.length === 1 && docs[0].original_name === 'facture-test.pdf' && docs[0].doc_kind === 'facture_energie') {
    console.log(`  ✓ owner_documents row OK: ${docs[0].original_name} (${docs[0].doc_kind})`)
  } else {
    console.log(`  ❌ owner_documents inattendu: ${JSON.stringify(docs)}`)
    ok = false
  }
} catch (err) {
  console.log(`  ❌ ${err.message}`)
  ok = false
} finally {
  console.log('→ Cleanup')
  for (const [t, id] of cleanup.reverse()) await pg.query(`DELETE FROM ${t} WHERE id = $1`, [id])
  await pg.query('UPDATE profiles SET default_org_id = NULL WHERE id = $1', [userId])
  await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  await pg.query('DELETE FROM memberships WHERE organization_id = $1', [orgId])
  await pg.query('DELETE FROM organizations WHERE id = $1', [orgId])
  await pg.end()
}

console.log(`\n${ok ? '✅' : '❌'} J9 flow ${ok ? 'PASSED' : 'FAILED'}`)
process.exit(ok ? 0 : 1)
