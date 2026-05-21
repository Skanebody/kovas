/**
 * Seed 5 dossiers de démo + properties + missions pour le compte démo.
 *
 * Cible : organization_id de benjaminbel@outlook.fr (f011d7dc-3cbb-4377-842e-fb3ba7219db1)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing env vars')
  process.exit(1)
}

const ORG_ID = 'f011d7dc-3cbb-4377-842e-fb3ba7219db1'
const USER_ID = '513d8b4c-424d-41b4-849a-fc49a958e70a'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const seedData = [
  {
    address: '15 Avenue de la Résistance, 76200 Dieppe',
    city: 'Dieppe', postal_code: '76200', insee_code: '76217',
    property_type: 'maison', year_built: 1985,
    surface_carrez: 95, surface_boutin: 95,
    status: 'scheduled', scheduled_at: '2026-05-22T09:00:00Z',
    mission_types: ['dpe_vente', 'amiante_vente'],
  },
  {
    address: '3 Rue du Faubourg de la Barre, 76200 Dieppe',
    city: 'Dieppe', postal_code: '76200', insee_code: '76217',
    property_type: 'appartement', year_built: 1972,
    surface_carrez: 68, surface_boutin: 68,
    status: 'draft', scheduled_at: '2026-05-23T14:30:00Z',
    mission_types: ['dpe_location', 'plomb_crep'],
  },
  {
    address: '12 Boulevard de Verdun, 76200 Dieppe',
    city: 'Dieppe', postal_code: '76200', insee_code: '76217',
    property_type: 'appartement', year_built: 1925,
    surface_carrez: 52, surface_boutin: 52,
    status: 'on_site', scheduled_at: '2026-05-21T10:00:00Z',
    started_at: '2026-05-21T10:00:00Z',
    mission_types: ['dpe_location', 'plomb_crep', 'amiante_vente'],
  },
  {
    address: '8 Quai du Carénage, 76200 Dieppe',
    city: 'Dieppe', postal_code: '76200', insee_code: '76217',
    property_type: 'maison', year_built: 1998,
    surface_carrez: 120, surface_boutin: 120,
    status: 'done', scheduled_at: '2026-05-15T14:00:00Z',
    started_at: '2026-05-15T14:00:00Z', completed_at: '2026-05-15T17:30:00Z',
    mission_types: ['dpe_vente', 'electricite', 'gaz'],
  },
  {
    address: '24 Rue Saint-Jacques, 76200 Dieppe',
    city: 'Dieppe', postal_code: '76200', insee_code: '76217',
    property_type: 'maison', year_built: 1960,
    surface_carrez: 145, surface_boutin: 145,
    status: 'back_office', scheduled_at: '2026-05-18T09:00:00Z',
    started_at: '2026-05-18T09:00:00Z', completed_at: '2026-05-18T13:00:00Z',
    mission_types: ['dpe_vente', 'termites', 'erp'],
  },
]

let counter = 1
for (const item of seedData) {
  // 1. Property
  const { data: prop, error: propErr } = await admin
    .from('properties')
    .insert({
      organization_id: ORG_ID,
      address: item.address,
      city: item.city,
      postal_code: item.postal_code,
      insee_code: item.insee_code,
      property_type: item.property_type,
      year_built: item.year_built,
      surface_carrez: item.surface_carrez,
      surface_boutin: item.surface_boutin,
    })
    .select('id')
    .single()
  if (propErr) {
    console.error(`Property ${item.address}: ${propErr.message}`)
    continue
  }

  // 2. Dossier
  const reference = `DOS-2026-${String(counter).padStart(5, '0')}`
  counter += 1
  const { data: dos, error: dosErr } = await admin
    .from('dossiers')
    .insert({
      organization_id: ORG_ID,
      property_id: prop.id,
      reference,
      status: item.status,
      scheduled_at: item.scheduled_at ?? null,
      started_at: item.started_at ?? null,
      completed_at: item.completed_at ?? null,
      assigned_to: USER_ID,
      created_by: USER_ID,
    })
    .select('id, reference')
    .single()
  if (dosErr) {
    console.error(`Dossier ${reference}: ${dosErr.message}`)
    continue
  }
  console.log(`Created ${reference} → ${item.address} [${item.status}]`)

  // 3. Missions (1 par type)
  for (const t of item.mission_types) {
    const { error: misErr } = await admin.from('missions').insert({
      organization_id: ORG_ID,
      dossier_id: dos.id,
      type: t,
      status: item.status === 'done' ? 'completed' : item.status === 'on_site' ? 'in_progress' : 'pending',
    })
    if (misErr && !misErr.message?.includes('duplicate')) {
      console.log(`  Mission ${t}: ${misErr.message}`)
    }
  }
}

console.log('')
console.log('Seed terminé. Reload http://localhost:3000/dashboard/dossiers')
