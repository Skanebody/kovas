#!/usr/bin/env node
/**
 * E2E test J4 : rooms + photos flow.
 *  - Crée un user
 *  - Crée client, property, mission (réutilise pattern J3)
 *  - Crée 2 pièces (salon + cuisine)
 *  - Insère 3 photos (1 par pièce + 1 orpheline)
 *  - Vérifie counts par pièce
 *  - Réassigne la photo orpheline
 *  - Supprime 1 photo
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
const TEST_EMAIL = `j4-test+${Date.now()}@kovas-e2e.fr`

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
    password: 'Pass1234!',
    email_confirm: true,
    user_metadata: { full_name: 'J4 E2E' },
  }),
})
const userId = (await userResp.json()).id
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
let ok = true

try {
  // 1. Client + property + mission
  const { rows: c } = await pg.query(
    `INSERT INTO clients (organization_id, type, display_name, created_by)
     VALUES ($1, 'particulier', 'Client J4', $2) RETURNING id`,
    [orgId, userId],
  )
  const clientId = c[0].id

  const { rows: p } = await pg.query(
    `INSERT INTO properties (organization_id, client_id, address, city, postal_code, property_type, surface_total)
     VALUES ($1, $2, '5 rue de la Paix', 'Paris', '75002', 'appartement', 75) RETURNING id`,
    [orgId, clientId],
  )
  const propertyId = p[0].id

  const { rows: refs } = await pg.query(`SELECT public.next_reference($1, 'mission') AS ref`, [orgId])
  const { rows: m } = await pg.query(
    `INSERT INTO missions (organization_id, property_id, client_id, reference, type, status, created_by, assigned_to)
     VALUES ($1, $2, $3, $4, 'dpe_vente', 'in_progress', $5, $5) RETURNING id`,
    [orgId, propertyId, clientId, refs[0].ref, userId],
  )
  const missionId = m[0].id
  console.log(`  ✓ mission ${refs[0].ref}`)

  // 2. Rooms : salon + cuisine
  const { rows: rooms } = await pg.query(
    `INSERT INTO mission_rooms (mission_id, organization_id, name, room_type, position)
     VALUES ($1, $2, 'Salon', 'salon', 0), ($1, $2, 'Cuisine', 'cuisine', 1)
     RETURNING id, name`,
    [missionId, orgId],
  )
  const [salonId, cuisineId] = [rooms[0].id, rooms[1].id]
  console.log(`  ✓ 2 rooms created (salon, cuisine)`)

  // 3. Photos : 1 salon + 1 cuisine + 1 orpheline
  const photoRows = await pg.query(
    `INSERT INTO photos (organization_id, mission_id, room_id, storage_path, width, height, size_bytes, mime_type, uploaded_by, location, taken_at)
     VALUES
       ($1, $2, $3, $4, 1920, 1080, 250000, 'image/webp', $5, ST_SetSRID(ST_Point(2.3522, 48.8566), 4326), NOW()),
       ($1, $2, $6, $7, 1920, 1080, 230000, 'image/webp', $5, ST_SetSRID(ST_Point(2.3522, 48.8566), 4326), NOW()),
       ($1, $2, NULL, $8, 1920, 1080, 280000, 'image/webp', $5, NULL, NOW())
     RETURNING id, room_id`,
    [
      orgId, missionId,
      salonId, `${orgId}/${missionId}/salon-1.webp`,
      userId,
      cuisineId, `${orgId}/${missionId}/cuisine-1.webp`,
      `${orgId}/${missionId}/orpheline-1.webp`,
    ],
  )
  const photos = photoRows.rows
  console.log(`  ✓ 3 photos inserted (1 salon, 1 cuisine, 1 orpheline)`)

  // 4. Verify counts per room
  const { rows: counts } = await pg.query(
    `SELECT room_id, COUNT(*)::int AS n FROM photos
     WHERE mission_id = $1 GROUP BY room_id ORDER BY room_id`,
    [missionId],
  )
  const orpheline = counts.find((c) => c.room_id === null)?.n ?? 0
  const salonCount = counts.find((c) => c.room_id === salonId)?.n ?? 0
  const cuisineCount = counts.find((c) => c.room_id === cuisineId)?.n ?? 0
  console.log(`  ✓ counts : salon ${salonCount}, cuisine ${cuisineCount}, orphelines ${orpheline}`)

  if (orpheline !== 1 || salonCount !== 1 || cuisineCount !== 1) {
    console.log('  ❌ unexpected counts')
    ok = false
  }

  // 5. Reassign the orphan to salon
  const orphanPhoto = photos.find((p) => p.room_id === null)
  await pg.query(`UPDATE photos SET room_id = $1 WHERE id = $2`, [salonId, orphanPhoto.id])
  const { rows: newSalonCount } = await pg.query(
    `SELECT COUNT(*)::int AS n FROM photos WHERE room_id = $1`,
    [salonId],
  )
  console.log(`  ✓ orphan reassigned to salon → ${newSalonCount[0].n} photos`)
  if (newSalonCount[0].n !== 2) ok = false

  // 6. Delete one photo
  await pg.query(`DELETE FROM photos WHERE id = $1`, [photos[1].id])
  const { rows: finalCount } = await pg.query(
    `SELECT COUNT(*)::int AS n FROM photos WHERE mission_id = $1`,
    [missionId],
  )
  console.log(`  ✓ photo deleted → ${finalCount[0].n} remaining`)
  if (finalCount[0].n !== 2) ok = false
} catch (err) {
  console.log(`  ❌ ${err.message}`)
  ok = false
} finally {
  console.log('→ Cleanup')
  // Délier la profile de l'org pour éviter FK violation pendant le cleanup
  await pg.query('UPDATE profiles SET default_org_id = NULL WHERE id = $1', [userId])
  await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  await pg.query('DELETE FROM memberships WHERE organization_id = $1', [orgId])
  await pg.query('DELETE FROM organizations WHERE id = $1', [orgId])
  await pg.end()
}

console.log(`\n${ok ? '✅' : '❌'} J4 flow test ${ok ? 'PASSED' : 'FAILED'}`)
process.exit(ok ? 0 : 1)
