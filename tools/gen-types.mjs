#!/usr/bin/env node
/**
 * Generate TypeScript types from Supabase Postgres schema.
 * No Docker required. Uses direct pg connection + information_schema.
 *
 * Usage: SUPABASE_DB_PASSWORD='...' node tools/gen-types.mjs
 * Writes to packages/database/src/types.ts
 */

import { writeFileSync } from 'node:fs'
import { Client } from 'pg'

const config = {
  host: 'db.jlizdkffwjdiokvmhcwg.supabase.co',
  port: 5432,
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
}

const PG_TO_TS = {
  uuid: 'string',
  text: 'string',
  varchar: 'string',
  char: 'string',
  bool: 'boolean',
  boolean: 'boolean',
  int2: 'number',
  int4: 'number',
  int8: 'string', // bigint as string (JS Number precision)
  numeric: 'number',
  float4: 'number',
  float8: 'number',
  date: 'string',
  time: 'string',
  timetz: 'string',
  timestamp: 'string',
  timestamptz: 'string',
  json: 'Json',
  jsonb: 'Json',
  bytea: 'string',
  inet: 'string',
  cidr: 'string',
  macaddr: 'string',
  geography: 'unknown',
  geometry: 'unknown',
  vector: 'string',
}

function pgTypeToTs(pgType, isArray) {
  let base = PG_TO_TS[pgType]
  if (!base) {
    // Custom enum or composite type
    base = `Database['public']['Enums'] extends infer E ? (E extends Record<string, unknown> ? (E['${pgType}'] extends infer T ? T : string) : string) : string`
    // Fallback simple
    base = 'string'
  }
  return isArray ? `${base}[]` : base
}

const client = new Client(config)
await client.connect()

// 1. Get all enums
const { rows: enums } = await client.query(`
  SELECT n.nspname AS schema, t.typname AS name,
         ARRAY_AGG(e.enumlabel::text ORDER BY e.enumsortorder)::text[] AS labels
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
  GROUP BY n.nspname, t.typname
  ORDER BY t.typname
`)

// 2. Get all tables + columns
const { rows: cols } = await client.query(`
  SELECT
    c.table_schema,
    c.table_name,
    c.column_name,
    c.is_nullable,
    c.column_default,
    c.udt_name,
    c.data_type,
    (SELECT EXISTS (
      SELECT 1 FROM information_schema.element_types et
      WHERE et.object_schema = c.table_schema
        AND et.object_name = c.table_name
        AND et.object_type = 'TABLE'
        AND et.collection_type_identifier = c.dtd_identifier
    )) AS is_array
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON c.table_schema = t.table_schema AND c.table_name = t.table_name
  WHERE c.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND c.table_name NOT IN ('spatial_ref_sys')
    AND c.table_name NOT LIKE 'photos_2026_%'
    AND c.table_name NOT LIKE 'events_2026_%'
  ORDER BY c.table_schema, c.table_name, c.ordinal_position
`)

await client.end()

// 3. Group columns by table
const tables = {}
for (const col of cols) {
  const key = col.table_name
  if (!tables[key]) tables[key] = []
  tables[key].push(col)
}

// 4. Generate TypeScript
const enumNames = enums.map((e) => e.name)
function resolveType(udt, dataType, isArray) {
  let base
  if (enumNames.includes(udt)) {
    // Custom enum
    base = enums.find((e) => e.name === udt).labels.map((v) => `'${v}'`).join(' | ')
  } else if (PG_TO_TS[udt]) {
    base = PG_TO_TS[udt]
  } else if (dataType === 'ARRAY') {
    // Array of unknown element type
    base = 'unknown'
  } else if (dataType === 'USER-DEFINED') {
    base = 'unknown'
  } else {
    base = 'string' // fallback
  }
  return isArray ? `(${base})[]` : base
}

let ts = `// Auto-generated TypeScript types from Supabase schema
// Generated: ${new Date().toISOString()}
// Source: db.jlizdkffwjdiokvmhcwg.supabase.co:5432 (public schema)
// Do NOT edit manually. Regenerate via: pnpm db:gen-types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
`

for (const [tableName, columns] of Object.entries(tables)) {
  ts += `      ${tableName}: {\n        Row: {\n`
  for (const col of columns) {
    const tsType = resolveType(col.udt_name, col.data_type, col.is_array)
    const nullable = col.is_nullable === 'YES' ? ' | null' : ''
    ts += `          ${col.column_name}: ${tsType}${nullable}\n`
  }
  ts += `        }\n        Insert: {\n`
  for (const col of columns) {
    const tsType = resolveType(col.udt_name, col.data_type, col.is_array)
    const hasDefault = col.column_default !== null
    const nullable = col.is_nullable === 'YES'
    const optional = hasDefault || nullable ? '?' : ''
    const nullableType = nullable ? ' | null' : ''
    ts += `          ${col.column_name}${optional}: ${tsType}${nullableType}\n`
  }
  ts += `        }\n        Update: {\n`
  for (const col of columns) {
    const tsType = resolveType(col.udt_name, col.data_type, col.is_array)
    const nullable = col.is_nullable === 'YES' ? ' | null' : ''
    ts += `          ${col.column_name}?: ${tsType}${nullable}\n`
  }
  ts += `        }\n      }\n`
}

ts += `    }\n    Views: Record<string, never>\n    Functions: Record<string, never>\n    Enums: {\n`
for (const e of enums) {
  ts += `      ${e.name}: ${e.labels.map((v) => `'${v}'`).join(' | ')}\n`
}
ts += `    }\n    CompositeTypes: Record<string, never>\n  }\n}\n`

writeFileSync('packages/database/src/types.ts', ts)
console.log(`✓ Generated packages/database/src/types.ts`)
console.log(`  - ${Object.keys(tables).length} tables`)
console.log(`  - ${enums.length} enums`)
console.log(`  - ${ts.split('\n').length} lines`)
