#!/usr/bin/env node
/**
 * E2E test J3.5 : trial protection flow.
 *  - Valide SIRET Luhn côté pur (sans réseau)
 *  - Valide email pro côté pur
 *  - Crée un user via admin + cabinet_trials INSERT
 *  - Vérifie qu'un 2e signup même SIRET est bloqué côté table
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

// SIRET test conforme Luhn — celui de la SASU Nexus 1993 réelle (avec NIC inventé pour test)
// SIREN 982786154 + NIC 00010
// Vérif Luhn manuelle : 9*2=18→9, 8, 2*2=4, 7, 8*2=16→7, 6, 1*2=2, 5, 4*2=8, 0, 0, 0, 1*2=2, 0
//                       9+8+4+7+7+6+2+5+8+0+0+0+2+0 = 58 → ❌ pas mod 10
// On va générer un SIRET valide directement par algorithme inverse

function makeValidSiret(siren) {
  // Compute the last digit so that the Luhn checksum is 0
  for (let nicLast = 0; nicLast <= 9; nicLast++) {
    const candidate = siren + '0000' + String(nicLast)
    if (luhnOk(candidate)) return candidate
  }
  return null
}

function luhnOk(siret) {
  if (!/^\d{14}$/.test(siret)) return false
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let d = Number.parseInt(siret[i], 10)
    if (i % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

// 1. Pure unit tests for SIRET
console.log('=== Unit : SIRET Luhn ===')
const validSiret = makeValidSiret('362521879') // SNCF SIREN
console.log(`  valid siret generated: ${validSiret} → Luhn ${luhnOk(validSiret) ? '✓' : '❌'}`)
console.log(`  invalid '12345678901234' → Luhn ${luhnOk('12345678901234') ? '❌' : '✓'}`)

// 2. Pure unit tests for email validation patterns
console.log('\n=== Unit : email pro patterns ===')
const tests = [
  ['benjamin@kovas.fr', true],
  ['test@gmail.com', false],
  ['x@yahoo.fr', false],
  ['ok@cabinet-diagnostic-martin.fr', true],
  ['abuser@10minutemail.com', false],
  ['abuser@mailinator.net', false],
  ['', false],
]
const FREE = new Set(['gmail.com', 'yahoo.fr', 'hotmail.fr', 'outlook.fr'])
const DISPOSABLE = new Set(['10minutemail.com', 'mailinator.net', 'tempmail.com'])
function checkEmailPro(email) {
  const m = email.match(/^[^\s@]+@([^\s@]+\.[^\s@]+)$/)
  if (!m) return false
  const d = m[1].toLowerCase()
  return !FREE.has(d) && !DISPOSABLE.has(d)
}
for (const [email, expected] of tests) {
  const got = checkEmailPro(email)
  const ok = got === expected
  console.log(`  ${ok ? '✓' : '❌'} ${email || '(empty)'} → ${got} (expected ${expected})`)
}

// 3. E2E test cabinet_trials uniqueness
console.log('\n=== E2E : cabinet_trials uniqueness ===')
const TEST_EMAIL = `j35-test+${Date.now()}@kovas-e2e.fr`
const TEST_SIRET = validSiret

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
    user_metadata: { full_name: 'J3.5 Trial Test' },
  }),
})
const userData = await userResp.json()
const userId = userData.id
console.log(`  ✓ user created ${userId}`)

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
  // 1st insert succeeds
  await pg.query(
    `INSERT INTO cabinet_trials (siret, email, user_id, organization_id) VALUES ($1, $2, $3, $4)`,
    [TEST_SIRET, TEST_EMAIL, userId, orgId],
  )
  console.log(`  ✓ 1st cabinet_trials insert OK (SIRET ${TEST_SIRET})`)

  // 2nd insert with same SIRET MUST fail (unique constraint)
  try {
    await pg.query(
      `INSERT INTO cabinet_trials (siret, email, user_id, organization_id) VALUES ($1, $2, $3, $4)`,
      [TEST_SIRET, 'other@cabinet.fr', userId, orgId],
    )
    console.log(`  ❌ 2nd insert should have failed!`)
    ok = false
  } catch (err) {
    if (err.message.includes('duplicate') || err.message.includes('unique')) {
      console.log(`  ✓ 2nd insert blocked (unique constraint on SIRET)`)
    } else {
      console.log(`  ❌ unexpected error: ${err.message}`)
      ok = false
    }
  }
} finally {
  // Cleanup
  await pg.query('DELETE FROM cabinet_trials WHERE siret = $1', [TEST_SIRET])
  await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  await pg.query('DELETE FROM memberships WHERE organization_id = $1', [orgId])
  await pg.query('DELETE FROM organizations WHERE id = $1', [orgId])
  await pg.end()
  console.log(`  ✓ cleanup done`)
}

console.log(`\n${ok ? '✅' : '❌'} Trial protection test ${ok ? 'PASSED' : 'FAILED'}`)
process.exit(ok ? 0 : 1)
