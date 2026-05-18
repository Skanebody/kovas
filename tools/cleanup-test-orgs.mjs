#!/usr/bin/env node
/**
 * Nettoie les organizations + users orphelins des tests précédents.
 * Cible : tout user dont l'email contient '@kovas-e2e.fr' + son org + memberships.
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

// 1. List orphan auth users via admin API
const r = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=200`, {
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
})
const { users } = await r.json()
const orphans = (users || []).filter((u) => u.email?.includes('kovas-e2e.fr'))
console.log(`→ ${orphans.length} orphan auth users to clean`)

const pg = new Client({
  host: 'db.jlizdkffwjdiokvmhcwg.supabase.co',
  port: 5432,
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})
await pg.connect()

for (const u of orphans) {
  const { rows: profiles } = await pg.query(
    'SELECT default_org_id FROM profiles WHERE id = $1',
    [u.id],
  )
  const orgId = profiles[0]?.default_org_id
  if (orgId) {
    await pg.query('UPDATE profiles SET default_org_id = NULL WHERE id = $1', [u.id])
    await pg.query('DELETE FROM memberships WHERE organization_id = $1', [orgId])
    await pg.query('DELETE FROM cabinet_trials WHERE organization_id = $1', [orgId])
    await pg.query('DELETE FROM photos WHERE organization_id = $1', [orgId])
    await pg.query('DELETE FROM mission_rooms WHERE organization_id = $1', [orgId])
    await pg.query('DELETE FROM missions WHERE organization_id = $1', [orgId])
    await pg.query('DELETE FROM properties WHERE organization_id = $1', [orgId])
    await pg.query('DELETE FROM clients WHERE organization_id = $1', [orgId])
    await pg.query('DELETE FROM organizations WHERE id = $1', [orgId])
  }
  await fetch(`${supabaseUrl}/auth/v1/admin/users/${u.id}`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  console.log(`  ✓ ${u.email}`)
}

// Orphan orgs without any user
const { rows: orphanOrgs } = await pg.query(`
  SELECT o.id, o.name FROM organizations o
  LEFT JOIN memberships m ON m.organization_id = o.id
  WHERE m.user_id IS NULL
`)
console.log(`→ ${orphanOrgs.length} orphan organizations (no members)`)
for (const org of orphanOrgs) {
  await pg.query('DELETE FROM organizations WHERE id = $1', [org.id])
  console.log(`  ✓ removed org "${org.name}"`)
}

await pg.end()
console.log('\n✓ Cleanup done')
