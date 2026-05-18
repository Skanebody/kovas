#!/usr/bin/env node
import { Client } from 'pg'

const config = {
  host: 'db.jlizdkffwjdiokvmhcwg.supabase.co',
  port: 5432,
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
}

const client = new Client(config)
await client.connect()

// Extensions
const { rows: exts } = await client.query(
  `SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto', 'postgis', 'pg_trgm', 'vector') ORDER BY extname`,
)
console.log(`Extensions actives (${exts.length}/5):`)
for (const r of exts) console.log(`  ✓ ${r.extname}`)
const missing = ['uuid-ossp', 'pgcrypto', 'postgis', 'pg_trgm', 'vector'].filter(
  (e) => !exts.some((r) => r.extname === e),
)
for (const m of missing) console.log(`  ❌ ${m} MANQUANTE`)

// Functions
const { rows: fns } = await client.query(
  `SELECT routine_schema, routine_name FROM information_schema.routines
   WHERE routine_schema IN ('public', 'auth')
     AND routine_name IN ('is_member_of', 'handle_new_user', 'audit_table_changes', 'next_reference', 'block_events_mutation', 'update_updated_at')
   ORDER BY routine_schema, routine_name`,
)
console.log(`\nFunctions KOVAS (${fns.length}):`)
for (const r of fns) console.log(`  ✓ ${r.routine_schema}.${r.routine_name}`)

// Triggers
const { rows: triggers } = await client.query(
  `SELECT trigger_schema, event_object_table, trigger_name FROM information_schema.triggers
   WHERE trigger_schema IN ('public', 'auth')
   ORDER BY trigger_schema, event_object_table, trigger_name`,
)
console.log(`\nTriggers (${triggers.length}):`)
for (const r of triggers) console.log(`  ✓ ${r.trigger_schema}.${r.event_object_table} → ${r.trigger_name}`)

// RLS enabled
const { rows: rls } = await client.query(
  `SELECT schemaname, tablename, rowsecurity FROM pg_tables
   WHERE schemaname = 'public' AND tablename IN (
     'organizations','profiles','memberships','clients','properties','missions',
     'mission_rooms','equipment_findings','voice_notes','sketches','photos',
     'owner_documents','quotes','invoices','events','ai_usage',
     'support_tickets','support_messages','incidents','vision_corrections','jobs'
   )
   ORDER BY tablename`,
)
const rlsEnabled = rls.filter((r) => r.rowsecurity).length
console.log(`\nRLS activé (${rlsEnabled}/${rls.length} tables business):`)
for (const r of rls) {
  console.log(`  ${r.rowsecurity ? '✓' : '❌'} ${r.tablename}`)
}

// RLS policies count
const { rows: policiesCount } = await client.query(
  `SELECT tablename, COUNT(*) AS n FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename ORDER BY tablename`,
)
console.log(`\nRLS policies (${policiesCount.length} tables avec policies):`)
let totalPolicies = 0
for (const r of policiesCount) {
  console.log(`  - ${r.tablename}: ${r.n} policies`)
  totalPolicies += Number.parseInt(r.n, 10)
}
console.log(`  Total: ${totalPolicies} policies`)

// auth.users trigger check
const { rows: authTrigger } = await client.query(
  `SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created'`,
)
console.log(`\nTrigger auth.users : ${authTrigger.length > 0 ? '✓ on_auth_user_created actif' : '❌ MANQUANT'}`)

await client.end()
