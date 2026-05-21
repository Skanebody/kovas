/**
 * Add missions to existing demo dossiers.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE) process.exit(1)

const ORG_ID = 'f011d7dc-3cbb-4377-842e-fb3ba7219db1'
const USER_ID = '513d8b4c-424d-41b4-849a-fc49a958e70a'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const MISSION_TYPES_BY_DOSSIER = {
  'DOS-2026-00002': ['dpe_location', 'plomb_crep'],
  'DOS-2026-00003': ['dpe_location', 'plomb_crep', 'amiante_vente'],
  'DOS-2026-00004': ['dpe_vente', 'electricite', 'gaz'],
  'DOS-2026-00005': ['dpe_vente', 'termites', 'erp'],
}

const STATUS_BY_DOSSIER_STATUS = {
  draft: 'draft',
  scheduled: 'draft',
  on_site: 'in_progress',
  back_office: 'in_progress',
  done: 'completed',
}

const { data: dossiers } = await admin
  .from('dossiers')
  .select('id, reference, status')
  .eq('organization_id', ORG_ID)
  .in('reference', Object.keys(MISSION_TYPES_BY_DOSSIER))

let missionCounter = 100  // start at 100 to avoid collision with other orgs

for (const dos of dossiers ?? []) {
  const types = MISSION_TYPES_BY_DOSSIER[dos.reference] ?? []
  const status = STATUS_BY_DOSSIER_STATUS[dos.status] ?? 'draft'

  for (const t of types) {
    const ref = `MIS-2026-${String(missionCounter).padStart(5, '0')}`
    missionCounter += 1
    const { error } = await admin.from('missions').insert({
      organization_id: ORG_ID,
      dossier_id: dos.id,
      type: t,
      status,
      reference: ref,
      assigned_to: USER_ID,
      created_by: USER_ID,
    })
    if (error) {
      // Try without dossier_id if FK column doesn't exist
      if (error.message?.includes('dossier_id')) {
        const { error: e2 } = await admin.from('missions').insert({
          organization_id: ORG_ID,
          type: t,
          status,
          reference: ref,
          assigned_to: USER_ID,
          created_by: USER_ID,
        })
        if (e2) console.log(`  ${ref} ${t}: ${e2.message}`)
        else console.log(`  ${ref} ${t} → ${dos.reference} (sans FK)`)
      } else {
        console.log(`  ${ref} ${t}: ${error.message}`)
      }
    } else {
      console.log(`  ${ref} ${t} → ${dos.reference} [${status}]`)
    }
  }
}

console.log('Done.')
