/**
 * Active TOUS les modules add-on (12) pour le compte démo dev@kovas-e2e.fr.
 * Schema réel : user_addons.addon_module_id (pas module_id), trial_ends_at far future.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const DEMO_EMAIL = 'dev@kovas-e2e.fr'

// 1. Récup user + org
let userId = null
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) throw error
  const found = data.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL.toLowerCase())
  if (found) { userId = found.id; break }
  if (data.users.length < 1000) break
}
if (!userId) { console.error('User introuvable'); process.exit(1) }
const { data: profile } = await admin.from('profiles').select('default_org_id').eq('id', userId).maybeSingle()
const orgId = profile?.default_org_id
console.log(`✓ user=${userId} org=${orgId}`)

// 2. Récup tous les addon_modules
const { data: modules, error: modErr } = await admin
  .from('addon_modules')
  .select('id, module_code, kind, name')
  .order('module_code')
if (modErr) { console.error('modules err:', modErr); process.exit(1) }
console.log(`✓ ${modules.length} modules en DB`)

// 3. Récup user_addons actuels pour cette org
const { data: existing } = await admin
  .from('user_addons')
  .select('addon_module_id, status')
  .eq('organization_id', orgId)
const existingIds = new Set((existing ?? []).map((r) => r.addon_module_id))
console.log(`État actuel : ${existing?.length ?? 0} user_addons (statuts : ${[...new Set((existing ?? []).map((r) => r.status))].join(',')})`)

// 4. Upsert active pour tous les modules
const trialEnd = new Date(Date.now() + 5 * 365 * 24 * 3600 * 1000).toISOString() // 5 ans
const inserts = modules.map((m) => ({
  organization_id: orgId,
  addon_module_id: m.id,
  status: 'active',
  started_at: new Date().toISOString(),
  trial_ends_at: trialEnd,
}))

// Upsert sur (organization_id, addon_module_id) — pas de contrainte unique forcément :
// donc on fait un select-then-update-or-insert manuel
for (const ins of inserts) {
  if (existingIds.has(ins.addon_module_id)) {
    const { error } = await admin
      .from('user_addons')
      .update({ status: 'active', cancelled_at: null, trial_ends_at: trialEnd })
      .eq('organization_id', ins.organization_id)
      .eq('addon_module_id', ins.addon_module_id)
    if (error) console.error('update err', ins.addon_module_id, error.message)
  } else {
    const { error } = await admin.from('user_addons').insert(ins)
    if (error) console.error('insert err', ins.addon_module_id, error.message)
  }
}

// 5. Vérif finale
const { data: verif } = await admin
  .from('user_addons')
  .select('status, addon_modules(module_code, name, kind)')
  .eq('organization_id', orgId)
  .order('addon_modules(module_code)')
console.log(`\n📋 État final user_addons (${verif?.length ?? 0}) :`)
for (const r of verif ?? []) {
  console.log(`  ${r.status.padEnd(10)} [${r.addon_modules?.kind}] ${r.addon_modules?.module_code} — ${r.addon_modules?.name}`)
}
console.log(`\n✓ Compte démo : ${verif?.length ?? 0} modules add-on activés`)
