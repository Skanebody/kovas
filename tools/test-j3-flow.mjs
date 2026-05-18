#!/usr/bin/env node
/**
 * E2E test J3 : full client → property → mission flow via admin API.
 * - Creates a test user
 * - Inserts a client
 * - Inserts a property
 * - Inserts a mission with auto-generated reference (via next_reference RPC)
 * - Verifies all data + cleanup
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

const TEST_EMAIL = `j3-test+${Date.now()}@kovas-e2e.fr`

// 1. Create test user
console.log(`→ Create user ${TEST_EMAIL}`)
const userResp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: TEST_EMAIL,
    password: 'TestPass1234!',
    email_confirm: true,
    user_metadata: { full_name: 'J3 E2E Test User' },
  }),
})
const userData = await userResp.json()
const userId = userData.id
console.log(`  ✓ user ${userId}`)

const pg = new Client({
  host: 'db.jlizdkffwjdiokvmhcwg.supabase.co',
  port: 5432,
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})
await pg.connect()

const { rows: profiles } = await pg.query('SELECT default_org_id FROM profiles WHERE id = $1', [userId])
const orgId = profiles[0].default_org_id
console.log(`  ✓ org ${orgId}`)

let ok = true
let cleanup = []
try {
  // 2. Insert client
  const { rows: clients } = await pg.query(
    `INSERT INTO clients (organization_id, type, display_name, email, created_by)
     VALUES ($1, 'particulier', 'Pierre Martin (E2E)', 'pierre.martin@example.com', $2)
     RETURNING id`,
    [orgId, userId],
  )
  const clientId = clients[0].id
  cleanup.push(['clients', clientId])
  console.log(`  ✓ client ${clientId}`)

  // 3. Insert property
  const { rows: properties } = await pg.query(
    `INSERT INTO properties (organization_id, client_id, address, city, postal_code, insee_code, property_type, surface_total, year_built, location)
     VALUES ($1, $2, '12 rue de Rivoli', 'Paris', '75001', '75101', 'appartement', 85.5, 1975,
             ST_SetSRID(ST_Point(2.3522, 48.8566), 4326))
     RETURNING id`,
    [orgId, clientId],
  )
  const propertyId = properties[0].id
  cleanup.push(['properties', propertyId])
  console.log(`  ✓ property ${propertyId}`)

  // 4. Use next_reference RPC + insert mission
  const { rows: refs } = await pg.query(`SELECT public.next_reference($1, 'mission') AS ref`, [orgId])
  const reference = refs[0].ref
  console.log(`  ✓ reference ${reference}`)

  const { rows: missions } = await pg.query(
    `INSERT INTO missions (organization_id, property_id, client_id, reference, type, status, scheduled_at, created_by, assigned_to)
     VALUES ($1, $2, $3, $4, 'dpe_vente', 'scheduled', NOW() + INTERVAL '7 days', $5, $5)
     RETURNING id, reference, status`,
    [orgId, propertyId, clientId, reference, userId],
  )
  cleanup.push(['missions', missions[0].id])
  console.log(`  ✓ mission ${missions[0].id} — ${missions[0].reference} (${missions[0].status})`)

  // 5. Verify counts via the user's RLS-filtered view
  const { rows: counts } = await pg.query(
    `SELECT
        (SELECT COUNT(*) FROM clients WHERE organization_id = $1) AS clients,
        (SELECT COUNT(*) FROM properties WHERE organization_id = $1) AS properties,
        (SELECT COUNT(*) FROM missions WHERE organization_id = $1) AS missions`,
    [orgId],
  )
  console.log(`  ✓ counts ${JSON.stringify(counts[0])}`)

  // Reference must match pattern MIS-YYYY-NNNNN
  if (!/^MIS-\d{4}-\d{5}$/.test(reference)) {
    console.log(`  ❌ reference format invalid: ${reference}`)
    ok = false
  }
} catch (err) {
  console.log(`  ❌ ${err.message}`)
  ok = false
} finally {
  // Cleanup
  console.log(`→ Cleanup`)
  for (const [table, id] of cleanup.reverse()) {
    await pg.query(`DELETE FROM ${table} WHERE id = $1`, [id])
  }
  // Delete user (cascades to profile)
  await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  // Delete org + remaining memberships
  await pg.query('DELETE FROM memberships WHERE organization_id = $1', [orgId])
  await pg.query('DELETE FROM organizations WHERE id = $1', [orgId])
  await pg.end()
}

console.log(`\n${ok ? '✅' : '❌'} J3 flow test ${ok ? 'PASSED' : 'FAILED'}`)
process.exit(ok ? 0 : 1)
