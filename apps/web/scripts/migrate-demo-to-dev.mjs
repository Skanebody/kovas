/**
 * Migre les 4 dossiers démo créés sur l'org "KOVAS Démo" (benjaminbel@outlook.fr)
 * vers l'org existante dev@kovas-e2e.fr.
 *
 * Puis delete le compte benjaminbel@outlook.fr (cleanup).
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE) process.exit(1)

const FROM_ORG = 'f011d7dc-3cbb-4377-842e-fb3ba7219db1' // KOVAS Démo (benjaminbel@outlook.fr)
const FROM_USER = '513d8b4c-424d-41b4-849a-fc49a958e70a'
const TO_ORG = '2d1f2105-3ed5-4c8e-bdf4-b615b89808dc' // dev@kovas-e2e.fr
const TO_USER = '18343baa-0ca2-47d4-b44f-81bdb081a7e9'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// 1. Re-org properties
const { data: props, error: propsErr } = await admin
  .from('properties')
  .update({ organization_id: TO_ORG })
  .eq('organization_id', FROM_ORG)
  .select('id, address')
if (propsErr) console.error('properties:', propsErr)
else console.log(`Properties migrated: ${props?.length ?? 0}`)

// 2. Re-org dossiers
const { data: dos, error: dosErr } = await admin
  .from('dossiers')
  .update({ organization_id: TO_ORG, assigned_to: TO_USER, created_by: TO_USER })
  .eq('organization_id', FROM_ORG)
  .select('id, reference')
if (dosErr) console.error('dossiers:', dosErr)
else console.log(`Dossiers migrated: ${dos?.length ?? 0}`)

// 3. Re-org missions
const { data: mis, error: misErr } = await admin
  .from('missions')
  .update({ organization_id: TO_ORG, assigned_to: TO_USER, created_by: TO_USER })
  .eq('organization_id', FROM_ORG)
  .select('id, reference')
if (misErr) console.error('missions:', misErr)
else console.log(`Missions migrated: ${mis?.length ?? 0}`)

// 4. Drop subscription on old org
const { error: subErr } = await admin
  .from('subscriptions')
  .delete()
  .eq('organization_id', FROM_ORG)
if (subErr) console.log(`subscription cleanup: ${subErr.message}`)

// 5. Drop membership + profile.default_org_id reference
await admin.from('memberships').delete().eq('user_id', FROM_USER)
await admin.from('profiles').update({ default_org_id: null }).eq('id', FROM_USER)

// 6. Drop org
const { error: orgErr } = await admin.from('organizations').delete().eq('id', FROM_ORG)
if (orgErr) console.log(`org delete: ${orgErr.message}`)
else console.log(`Org ${FROM_ORG} deleted`)

// 7. Delete auth user
const { error: userErr } = await admin.auth.admin.deleteUser(FROM_USER)
if (userErr) console.log(`user delete: ${userErr.message}`)
else console.log(`User benjaminbel@outlook.fr deleted`)

console.log('')
console.log('Migration terminée — toutes les données démo sont maintenant sur dev@kovas-e2e.fr')
