/**
 * 1. Crée tables addon_modules + user_addons (minimal — match lib/upsell/load-access.ts)
 * 2. Seed les 9 addons + 3 packs dans addon_modules
 * 3. Active tous les 12 pour la dev org
 */

const { Client } = require('pg')

const REF = 'jlizdkffwjdiokvmhcwg'
const PG_PASSWORD = process.env.SUPABASE_DB_PASSWORD
if (!PG_PASSWORD) { console.error('Missing SUPABASE_DB_PASSWORD'); process.exit(1) }

const DEV_ORG_ID = '2d1f2105-3ed5-4c8e-bdf4-b615b89808dc'

const MODULES = [
  { code: 'signatures_eidas', name: 'Signatures électroniques eIDAS', kind: 'addon' },
  { code: 'bilingual_reports', name: 'Rapports bilingues FR/EN', kind: 'addon' },
  { code: 'sms_reminders', name: 'SMS rappel client J-1', kind: 'addon' },
  { code: 'pennylane_sync', name: 'Synchronisation Pennylane', kind: 'addon' },
  { code: 'facturx_ppf', name: 'Facturation Factur-X PPF', kind: 'addon' },
  { code: 'community_pro', name: 'Communauté Pro', kind: 'addon' },
  { code: 'analytics_advanced', name: 'Analytics avancés cabinet', kind: 'addon' },
  { code: 'regulatory_watch', name: 'Veille IA hebdomadaire', kind: 'addon' },
  { code: 'cockpit_ademe_m2', name: 'Cockpit ADEME Mode 2', kind: 'addon' },
  { code: 'pack_growth', name: 'Pack Croissance', kind: 'pack' },
  { code: 'pack_cabinet', name: 'Pack Cabinet', kind: 'pack' },
  { code: 'pack_international', name: 'Pack International', kind: 'pack' },
]

async function main() {
  const c = new Client({
    host: `db.${REF}.supabase.co`, port: 5432, user: 'postgres',
    password: PG_PASSWORD, database: 'postgres',
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()
  console.log('✓ Connected')

  // 1. Create tables if not exist
  console.log('\n[1] Creating tables addon_modules + user_addons...')
  await c.query(`
    CREATE TABLE IF NOT EXISTS public.addon_modules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      module_code text UNIQUE NOT NULL,
      name text NOT NULL,
      description text,
      kind text NOT NULL DEFAULT 'addon' CHECK (kind IN ('addon', 'pack')),
      monthly_price_cents integer,
      included_quantity integer,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  console.log('  ✓ addon_modules ready')

  await c.query(`
    CREATE TABLE IF NOT EXISTS public.user_addons (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      addon_module_id uuid NOT NULL REFERENCES public.addon_modules(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'cancelled', 'expired')),
      started_at timestamptz NOT NULL DEFAULT now(),
      trial_ends_at timestamptz,
      cancelled_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, addon_module_id)
    )
  `)
  console.log('  ✓ user_addons ready')

  await c.query(`
    ALTER TABLE public.user_addons ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "owner read addons" ON public.user_addons;
    CREATE POLICY "owner read addons" ON public.user_addons
      FOR SELECT TO authenticated
      USING (
        organization_id IN (
          SELECT default_org_id FROM public.profiles WHERE id = auth.uid()
        )
      );
  `)
  console.log('  ✓ RLS policies applied')

  // 2. Seed addon_modules
  console.log('\n[2] Seed 12 addon_modules:')
  for (const m of MODULES) {
    await c.query(
      `INSERT INTO addon_modules (module_code, name, kind)
       VALUES ($1, $2, $3)
       ON CONFLICT (module_code) DO UPDATE SET name = EXCLUDED.name, kind = EXCLUDED.kind`,
      [m.code, m.name, m.kind],
    )
    console.log(`    + ${m.code} (${m.kind})`)
  }

  // 3. Activate all for dev org
  console.log('\n[3] Activate all 12 for dev org:')
  const r = await c.query(`
    INSERT INTO user_addons (organization_id, addon_module_id, status, trial_ends_at)
    SELECT $1, id, 'active', now() + interval '5 years'
    FROM addon_modules
    ON CONFLICT (organization_id, addon_module_id)
    DO UPDATE SET status = 'active', updated_at = now()
    RETURNING (SELECT module_code FROM addon_modules WHERE id = user_addons.addon_module_id)
  `, [DEV_ORG_ID])
  for (const row of r.rows) console.log(`    ✓ ${row.module_code}`)

  // 4. Final state
  console.log('\n[4] Final state:')
  const finalQ = await c.query(`
    SELECT am.module_code, am.kind, ua.status
    FROM user_addons ua
    JOIN addon_modules am ON am.id = ua.addon_module_id
    WHERE ua.organization_id = $1
    ORDER BY am.kind, am.module_code
  `, [DEV_ORG_ID])
  console.log(`    Total active: ${finalQ.rowCount}`)
  for (const row of finalQ.rows) console.log(`    ${row.module_code} (${row.kind}) — ${row.status}`)

  await c.end()
  console.log('\n✓ Done.')
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
