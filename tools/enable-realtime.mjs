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

const REALTIME_TABLES = [
  'missions',
  'photos',
  'voice_notes',
  'equipment_findings',
  'mission_rooms',
  'incidents', // pour status page temps réel
]

const client = new Client(config)
await client.connect()

for (const table of REALTIME_TABLES) {
  try {
    await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE public.${table}`)
    console.log(`✓ Realtime activé sur public.${table}`)
  } catch (err) {
    if (err.message.includes('is already member of publication')) {
      console.log(`  ${table} déjà dans publication`)
    } else {
      console.error(`❌ ${table}: ${err.message}`)
    }
  }
}

// Vérification
const { rows } = await client.query(
  `SELECT tablename FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
   ORDER BY tablename`,
)
console.log(`\n✓ Tables Realtime actives (${rows.length}):`)
for (const r of rows) console.log(`  - ${r.tablename}`)

await client.end()
