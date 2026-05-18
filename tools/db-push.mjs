#!/usr/bin/env node
/**
 * Push Supabase migration via node-pg.
 * Tries multiple connection strategies (direct IPv6, pooler IPv4 multiple regions).
 * Usage : node tools/db-push.mjs <path/to/migration.sql>
 */

import { readFileSync } from 'node:fs'
import { Client } from 'pg'

const PROJECT_REF = 'jlizdkffwjdiokvmhcwg'
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD
const REGIONS = ['eu-west-3', 'eu-west-1', 'eu-central-1', 'eu-central-2', 'eu-north-1']

if (!DB_PASSWORD) {
  console.error('❌ SUPABASE_DB_PASSWORD env var required')
  process.exit(1)
}

const migrationFile = process.argv[2]
if (!migrationFile) {
  console.error('❌ Usage: node tools/db-push.mjs <path/to/migration.sql>')
  process.exit(1)
}

const strategies = [
  // 1. Direct IPv6 (only works if local IPv6 available)
  {
    name: 'Direct IPv6 db.<ref>.supabase.co:5432',
    config: {
      host: `db.${PROJECT_REF}.supabase.co`,
      port: 5432,
      user: 'postgres',
      password: DB_PASSWORD,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      statement_timeout: 60_000,
      connectionTimeoutMillis: 10_000,
    },
  },
  // 2. Session pooler IPv4 (port 5432) — multiple regions
  ...REGIONS.map((region) => ({
    name: `Session pooler ${region}:5432`,
    config: {
      host: `aws-0-${region}.pooler.supabase.com`,
      port: 5432,
      user: `postgres.${PROJECT_REF}`,
      password: DB_PASSWORD,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      statement_timeout: 60_000,
      connectionTimeoutMillis: 10_000,
    },
  })),
]

let workingConfig = null
for (const strat of strategies) {
  process.stdout.write(`→ Trying ${strat.name}... `)
  const client = new Client(strat.config)
  try {
    await client.connect()
    const { rows } = await client.query('SELECT 1 as ok')
    console.log(`✓ Connected (${rows[0].ok})`)
    workingConfig = strat.config
    await client.end()
    break
  } catch (err) {
    console.log(`❌ ${err.code ?? err.message}`)
    try {
      await client.end()
    } catch {}
  }
}

if (!workingConfig) {
  console.error('\n❌ Aucune stratégie de connexion n\'a fonctionné.')
  console.error("Vérifie : project ref correct, DB password correct, projet bien provisionné.")
  process.exit(1)
}

console.log(`\n→ Using ${workingConfig.host}:${workingConfig.port}`)

const sql = readFileSync(migrationFile, 'utf-8')
console.log(`→ Applying migration: ${migrationFile} (${(sql.length / 1024).toFixed(1)} KB)`)

const client = new Client(workingConfig)
await client.connect()

try {
  await client.query(sql)
  console.log('✓ Migration applied successfully')
} catch (err) {
  console.error(`\n❌ Migration failed: ${err.message}`)
  if (err.position) {
    const pos = Number.parseInt(err.position, 10)
    const start = Math.max(0, pos - 300)
    const end = Math.min(sql.length, pos + 200)
    console.error('\n--- Context around error ---')
    console.error(sql.slice(start, end))
    console.error('--- End context ---\n')
  }
  process.exit(1)
} finally {
  await client.end()
}

// Verify table count
const verifyClient = new Client(workingConfig)
await verifyClient.connect()
const { rows } = await verifyClient.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
)
console.log(`\n✓ Tables in public schema (${rows.length}):`)
for (const row of rows) {
  console.log(`  - ${row.table_name}`)
}
await verifyClient.end()
