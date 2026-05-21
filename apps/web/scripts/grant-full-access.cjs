/**
 * Grant full access via direct Postgres IPv6 connection.
 */

const { Client } = require('pg')
const net = require('net')

const REF = 'jlizdkffwjdiokvmhcwg'
const PG_PASSWORD = process.env.SUPABASE_DB_PASSWORD

if (!PG_PASSWORD) {
  console.error('Missing SUPABASE_DB_PASSWORD')
  process.exit(1)
}

const DEV_USER_ID = '18343baa-0ca2-47d4-b44f-81bdb081a7e9'
const DEV_ORG_ID = '2d1f2105-3ed5-4c8e-bdf4-b615b89808dc'

const ADDON_CODES = [
  'signatures_eidas', 'bilingual_reports', 'sms_reminders', 'pennylane_sync',
  'facturx_ppf', 'community_pro', 'analytics_advanced', 'regulatory_watch',
  'cockpit_ademe_m2',
]

async function tryConnect(config, label) {
  const client = new Client(config)
  try {
    await client.connect()
    console.log(`✓ Connected via ${label}`)
    return client
  } catch (e) {
    console.log(`✗ ${label}: ${e.message}`)
    return null
  }
}

async function main() {
  // Try multiple connection strategies
  let client = await tryConnect({
    host: `aws-0-eu-west-3.pooler.supabase.com`,
    port: 6543,
    user: `postgres.${REF}`,
    password: PG_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  }, 'pooler eu-west-3 (transaction mode 6543)')

  if (!client) {
    client = await tryConnect({
      host: `aws-0-eu-west-3.pooler.supabase.com`,
      port: 5432,
      user: `postgres.${REF}`,
      password: PG_PASSWORD,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    }, 'pooler eu-west-3 (session mode 5432)')
  }

  if (!client) {
    client = await tryConnect({
      host: `db.${REF}.supabase.co`,
      port: 5432,
      user: 'postgres',
      password: PG_PASSWORD,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    }, 'direct db host IPv6')
  }

  if (!client) {
    console.error('All connections failed')
    process.exit(1)
  }

  console.log('')
  console.log('=== [1] Add profiles.is_admin column ===')
  try {
    await client.query(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false`)
    console.log('  ✓ is_admin column ready')
  } catch (e) { console.log('  ✗', e.message) }

  console.log('\n=== [2] Set dev user as admin ===')
  try {
    const r = await client.query(
      `UPDATE public.profiles SET is_admin = true WHERE id = $1 RETURNING email, is_admin`,
      [DEV_USER_ID],
    )
    console.log('  ✓ ', r.rows[0])
  } catch (e) { console.log('  ✗', e.message) }

  console.log('\n=== [3] Boost subscription quotas (5 years + unlimited) ===')
  try {
    const r = await client.query(`
      UPDATE public.subscriptions
      SET missions_included = 99999,
          overage_price_cents = 0,
          monthly_cap_eur = 99999,
          current_period_end = now() + interval '5 years',
          status = 'active'
      WHERE organization_id = $1
      RETURNING tier, status, missions_included
    `, [DEV_ORG_ID])
    console.log('  ✓', r.rows[0])
  } catch (e) { console.log('  ✗', e.message) }

  console.log('\n=== [4] Bypass cabinet_trials block ===')
  try {
    const r = await client.query(`
      UPDATE public.cabinet_trials
      SET converted_to_paid = true, blocked_reason = NULL
      WHERE organization_id = $1
      RETURNING email
    `, [DEV_ORG_ID])
    console.log(`  ✓ ${r.rowCount} cabinet_trials updated`)
  } catch (e) {
    if (e.message.includes('does not exist')) console.log('  (cabinet_trials absent — skip)')
    else console.log('  ✗', e.message)
  }

  console.log('\n=== [5] Find addon/module tables ===')
  const tablesQ = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public'
      AND (table_name ~ 'addon|module|entitlement|feature|upsell')
    ORDER BY table_name
  `)
  console.log('  Tables:')
  for (const r of tablesQ.rows) console.log(`    - ${r.table_name}`)

  console.log('\n=== [6] Inspect schema of addon-like tables ===')
  for (const t of tablesQ.rows.map(r => r.table_name)) {
    const c = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position
    `, [t])
    console.log(`  ${t}: ${c.rows.map(r => r.column_name).join(', ')}`)
  }

  console.log('\n=== [7] Try activate addon modules in all candidate tables ===')
  const ADDON_TABLES = ['addon_subscriptions', 'organization_modules', 'module_subscriptions', 'module_trials']
  for (const table of ADDON_TABLES) {
    const exists = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=$1
    `, [table])
    if (exists.rowCount === 0) continue
    console.log(`  Targeting ${table}:`)
    // Get column names
    const cols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1
    `, [table])
    const colSet = new Set(cols.rows.map(r => r.column_name))
    const codeCol = ['addon_code', 'module_code', 'code'].find(c => colSet.has(c))
    if (!codeCol) {
      console.log(`    no code column found`)
      continue
    }
    for (const code of ADDON_CODES) {
      try {
        const insertCols = ['organization_id', codeCol]
        const values = [DEV_ORG_ID, code]
        const placeholders = ['$1', '$2']
        if (colSet.has('status')) { insertCols.push('status'); values.push('active'); placeholders.push(`$${values.length}`) }
        if (colSet.has('started_at')) { insertCols.push('started_at'); values.push(new Date()); placeholders.push(`$${values.length}`) }
        if (colSet.has('trial_ends_at')) {
          insertCols.push('trial_ends_at')
          values.push(new Date(Date.now() + 365 * 24 * 3600 * 1000))
          placeholders.push(`$${values.length}`)
        }
        await client.query(
          `INSERT INTO public.${table} (${insertCols.join(',')}) VALUES (${placeholders.join(',')}) ON CONFLICT DO NOTHING`,
          values,
        )
        console.log(`    + ${code}`)
      } catch (e) {
        console.log(`    ? ${code}: ${e.message.slice(0, 100)}`)
      }
    }
  }

  console.log('\n=== [8] Final state ===')
  const f = await client.query(`
    SELECT
      p.email, p.is_admin,
      o.name as org,
      s.tier, s.status, s.missions_included, s.monthly_cap_eur,
      s.current_period_end
    FROM public.profiles p
    LEFT JOIN public.organizations o ON o.id = p.default_org_id
    LEFT JOIN public.subscriptions s ON s.organization_id = p.default_org_id
    WHERE p.id = $1
  `, [DEV_USER_ID])
  console.log(JSON.stringify(f.rows[0], null, 2))

  await client.end()
  console.log('\n✓ Done.')
}

main().catch(e => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
