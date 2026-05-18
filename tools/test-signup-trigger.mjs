#!/usr/bin/env node
/**
 * E2E test : crée un user via Supabase Admin API
 * et vérifie que le trigger handle_new_user() crée
 * profile + organization + membership owner.
 */
import { readFileSync } from 'node:fs'
import { Client } from 'pg'

// Load .env.local manually (shell parsing chokes on special chars like `:)`)
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8')
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const config = {
  host: 'db.jlizdkffwjdiokvmhcwg.supabase.co',
  port: 5432,
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
}

const TEST_EMAIL = `test+${Date.now()}@kovas-e2e.fr`
const TEST_NAME = 'Pierre Martin (test E2E)'

const supabaseUrl = 'https://jlizdkffwjdiokvmhcwg.supabase.co'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

console.log(`→ Creating test user via Supabase Admin API : ${TEST_EMAIL}`)
const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: TEST_EMAIL,
    password: 'TestPassword1234!',
    email_confirm: true,
    user_metadata: { full_name: TEST_NAME },
  }),
})

if (!resp.ok) {
  console.error(`❌ Admin user creation failed: HTTP ${resp.status}`)
  console.error(await resp.text())
  process.exit(1)
}

const userData = await resp.json()
const userId = userData.id
console.log(`✓ User created: ${userId}`)

// Verify trigger ran : profile + org + membership
const pg = new Client(config)
await pg.connect()

const { rows: profiles } = await pg.query('SELECT id, email, full_name, default_org_id FROM profiles WHERE id = $1', [userId])
console.log(`\n=== profile (${profiles.length}) ===`)
console.log(profiles[0])

const { rows: memberships } = await pg.query('SELECT organization_id, user_id, role, status FROM memberships WHERE user_id = $1', [userId])
console.log(`\n=== membership (${memberships.length}) ===`)
console.log(memberships[0])

const { rows: orgs } = await pg.query('SELECT id, name FROM organizations WHERE id = $1', [memberships[0]?.organization_id])
console.log(`\n=== organization (${orgs.length}) ===`)
console.log(orgs[0])

// Cleanup — deleting auth user cascades to profiles (FK ON DELETE CASCADE).
// Then we can remove memberships + organization safely.
console.log(`\n→ Cleanup test data...`)
await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
  method: 'DELETE',
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
})
await pg.query('DELETE FROM memberships WHERE organization_id = $1', [memberships[0]?.organization_id])
await pg.query('DELETE FROM organizations WHERE id = $1', [memberships[0]?.organization_id])
console.log(`✓ Cleanup done`)

await pg.end()

// Validate
const ok =
  profiles.length === 1 &&
  profiles[0].full_name === TEST_NAME &&
  profiles[0].default_org_id === memberships[0]?.organization_id &&
  memberships.length === 1 &&
  memberships[0].role === 'owner' &&
  memberships[0].status === 'active' &&
  orgs.length === 1 &&
  orgs[0].name.includes(TEST_NAME)

console.log(`\n${ok ? '✅' : '❌'} Trigger test ${ok ? 'PASSED' : 'FAILED'}`)
process.exit(ok ? 0 : 1)
