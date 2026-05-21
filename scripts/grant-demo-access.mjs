/**
 * One-shot script : grant full access to demo account benjaminbel@outlook.fr
 *
 * - Find user in auth.users
 * - Add is_admin column to profiles (if not exists) + set TRUE for this user
 * - Create active subscription tied to logiciel_enterprise (highest tier)
 * - Subscribe to all 4 add-ons
 * - Activate bundle dual track
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing env vars')
  process.exit(1)
}

const DEMO_EMAIL = 'benjaminbel@outlook.fr'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// 1. Find user
let userId = null
let pageToken = undefined
while (true) {
  const { data, error } = await admin.auth.admin.listUsers({ page: pageToken ?? 1, perPage: 1000 })
  if (error) throw error
  const found = data.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL.toLowerCase())
  if (found) {
    userId = found.id
    break
  }
  if (data.users.length < 1000) break
  pageToken = (pageToken ?? 1) + 1
}

if (!userId) {
  console.log(`User ${DEMO_EMAIL} not found in auth. Creating...`)
  const { data: created, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: 'KovasDemo2026!',
    email_confirm: true,
    user_metadata: { full_name: 'Benjamin Bel', first_name: 'Benjamin', last_name: 'Bel' },
  })
  if (error) throw error
  userId = created.user.id
  console.log(`Created user ${userId}`)
}
console.log(`User ID: ${userId}`)

// 2. Profile + org
const { data: profile, error: profileErr } = await admin
  .from('profiles')
  .select('id, default_org_id')
  .eq('id', userId)
  .maybeSingle()

if (profileErr) console.error('profile fetch err:', profileErr)
let orgId = profile?.default_org_id ?? null
console.log(`Profile.default_org_id: ${orgId ?? 'NULL'}`)

if (!orgId) {
  // Create organization
  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .insert({ name: 'KOVAS Démo' })
    .select('id')
    .single()
  if (orgErr) {
    console.error('org create err:', orgErr)
  } else {
    orgId = org.id
    console.log(`Created org ${orgId}`)
    // Update profile
    await admin.from('profiles').update({ default_org_id: orgId }).eq('id', userId)
    // Add membership
    const { error: memErr } = await admin
      .from('memberships')
      .insert({ user_id: userId, organization_id: orgId, role: 'owner', status: 'active' })
    if (memErr && !memErr.message?.includes('duplicate')) {
      console.error('membership err:', memErr)
    }
  }
}

// 3. Add is_admin column if missing + set TRUE
const { error: alterErr } = await admin.rpc('exec_sql', {
  sql: "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;",
}).catch(() => ({ error: { message: 'no exec_sql rpc' } }))

// Fallback: try direct update (column might already exist via earlier admin migration)
const { error: adminErr } = await admin
  .from('profiles')
  .update({ is_admin: true })
  .eq('id', userId)

if (adminErr) {
  console.log(`is_admin update failed (column probably missing): ${adminErr.message}`)
  console.log('TODO : ajouter colonne profiles.is_admin via migration séparée')
} else {
  console.log('is_admin set to TRUE')
}

// 4. Subscription logiciel_enterprise (highest tier)
if (orgId) {
  const { data: existingSub } = await admin
    .from('subscriptions')
    .select('id, plan_code, status')
    .eq('organization_id', orgId)
    .maybeSingle()

  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()

  if (existingSub) {
    const { error } = await admin
      .from('subscriptions')
      .update({
        plan_code: 'logiciel_enterprise',
        status: 'active',
        current_period_end: oneYearFromNow,
      })
      .eq('id', existingSub.id)
    if (error) console.error('sub update err:', error)
    else console.log(`Updated subscription ${existingSub.id} → logiciel_enterprise active`)
  } else {
    const { error } = await admin.from('subscriptions').insert({
      organization_id: orgId,
      plan_code: 'logiciel_enterprise',
      status: 'active',
      current_period_end: oneYearFromNow,
    })
    if (error) console.error('sub insert err:', error)
    else console.log('Created subscription logiciel_enterprise active')
  }

  // 5. All 4 add-ons (if addon_subscriptions table exists)
  const addonCodes = ['addon_signatures_eidas', 'addon_pennylane_sync', 'addon_sms_reminders', 'addon_community_pro']
  for (const code of addonCodes) {
    const { error } = await admin.from('addon_subscriptions').insert({
      organization_id: orgId,
      addon_code: code,
      status: 'active',
    })
    if (error && !error.message?.includes('duplicate') && !error.message?.includes('does not exist')) {
      console.log(`addon ${code}: ${error.message}`)
    } else if (!error) {
      console.log(`Addon ${code} active`)
    }
  }

  // 6. Bundle (if bundle_subscriptions exists)
  const { error: bundleErr } = await admin.from('bundle_subscriptions').insert({
    organization_id: orgId,
    bundle_code: 'bundle_cabinet_visibility',
    status: 'active',
    current_period_end: oneYearFromNow,
  })
  if (bundleErr && !bundleErr.message?.includes('duplicate') && !bundleErr.message?.includes('does not exist')) {
    console.log(`bundle: ${bundleErr.message}`)
  } else if (!bundleErr) {
    console.log('Bundle bundle_cabinet_visibility active')
  }
}

console.log('')
console.log(`✓ Demo account ${DEMO_EMAIL} (${userId}) configured`)
console.log(`  Password: KovasDemo2026! (si user créé just now)`)
console.log(`  Org: ${orgId ?? 'NULL'}`)
console.log(`  Login: http://localhost:3000/login`)
