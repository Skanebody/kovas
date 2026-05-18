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

const { rows: exts } = await client.query(
  `SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto', 'postgis', 'pg_trgm', 'vector') ORDER BY extname`,
)
console.log(`Extensions actives (${exts.length}):`)
for (const r of exts) console.log(`  ✓ ${r.extname}`)

const { rows: tables } = await client.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
)
console.log(`\nTables public (${tables.length}):`)
for (const r of tables) console.log(`  - ${r.table_name}`)

const { rows: fns } = await client.query(
  `SELECT routine_schema, routine_name FROM information_schema.routines
   WHERE routine_schema IN ('public', 'auth') AND routine_name IN ('is_member_of', 'handle_new_user', 'audit_table_changes', 'next_reference', 'block_events_mutation', 'update_updated_at')
   ORDER BY routine_schema, routine_name`,
)
console.log(`\nFunctions KOVAS (${fns.length}):`)
for (const r of fns) console.log(`  - ${r.routine_schema}.${r.routine_name}`)

await client.end()
