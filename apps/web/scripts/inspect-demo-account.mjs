/**
 * Inspecte l'état du compte demo dev@kovas-e2e.fr en DB.
 * Vérifie : subscription, user_addons, modules disponibles, organization.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')
const envText = fs.readFileSync(envPath, 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) {
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    process.env[m[1]] = v
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing env vars')
  process.exit(1)
}

const DEMO_EMAIL = 'dev@kovas-e2e.fr'
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// 1. Find user
let userId = null
let pageToken = 1
while (true) {
  const { data, error } = await admin.auth.admin.listUsers({ page: pageToken, perPage: 1000 })
  if (error) throw error
  const found = data.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL.toLowerCase())
  if (found) {
    userId = found.id
    break
  }
  if (data.users.length < 1000) break
  pageToken += 1
}

if (!userId) {
  console.log(`❌ User ${DEMO_EMAIL} introuvable dans auth.users`)
  process.exit(1)
}
console.log(`✓ user_id = ${userId}`)

// 2. Profile
const { data: profile } = await admin
  .from('profiles')
  .select('id, default_org_id, is_admin')
  .eq('id', userId)
  .maybeSingle()
console.log(`profile:`, profile)

const orgId = profile?.default_org_id
if (!orgId) {
  console.log('❌ Pas d\'organization rattachée')
  process.exit(1)
}

// 3. Organization
const { data: org } = await admin
  .from('organizations')
  .select('id, name, trial_ends_at, has_payment_method')
  .eq('id', orgId)
  .maybeSingle()
  .then((r) => r)
  .catch(() => ({ data: null }))
console.log(`org:`, org)

// Si trial_ends_at/has_payment_method n'existent pas, fallback
const { data: orgBasic } = await admin
  .from('organizations')
  .select('id, name')
  .eq('id', orgId)
  .maybeSingle()
console.log(`org_basic:`, orgBasic)

// 4. Subscription
const { data: sub } = await admin
  .from('subscriptions')
  .select('*')
  .eq('organization_id', orgId)
  .maybeSingle()
console.log(`subscription:`, sub)

// 5. user_addons
const { data: addons, error: addonsErr } = await admin
  .from('user_addons')
  .select('id, addon_module_id, status, started_at, current_period_end, addon_modules(module_code, name)')
  .eq('organization_id', orgId)
console.log(`user_addons (${addons?.length ?? 0}):`, addons, addonsErr?.message)

// 6. addon_modules disponibles
const { data: modules } = await admin
  .from('addon_modules')
  .select('id, module_code, name, monthly_price_cents, active')
  .order('module_code')
console.log(`\naddon_modules disponibles (${modules?.length ?? 0}):`)
for (const m of modules ?? []) {
  console.log(`  ${m.module_code.padEnd(40)} ${m.name} (${m.monthly_price_cents / 100}€)${m.active ? '' : ' [INACTIVE]'}`)
}

// 7. Memberships
const { data: memberships } = await admin
  .from('memberships')
  .select('organization_id, role, status')
  .eq('user_id', userId)
console.log(`\nmemberships:`, memberships)
