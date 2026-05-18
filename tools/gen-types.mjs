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

// 2b. FK relationships between public tables
const { rows: fks } = await client.query(`
  SELECT
    tc.table_name AS source_table,
    kcu.column_name AS source_column,
    ccu.table_name AS target_table,
    ccu.column_name AS target_column,
    tc.constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND ccu.table_schema = 'public'
  ORDER BY tc.table_name, kcu.column_name
`)

// 2c. RPC functions (public schema, user-defined only — exclude extension-owned)
const { rows: funcs } = await client.query(`
  SELECT
    p.proname AS name,
    pg_catalog.pg_get_function_result(p.oid) AS returns_text,
    pg_catalog.pg_get_function_arguments(p.oid) AS args_text
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.objid = p.oid
        AND d.deptype = 'e'  -- extension dependency
    )
    AND p.proname NOT IN ('handle_new_user', 'audit_table_changes', 'block_events_mutation', 'update_updated_at')
  ORDER BY p.proname
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
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
  public: {
    Tables: {
`

// Group FKs by source table
const fksByTable = {}
for (const fk of fks) {
  if (!fksByTable[fk.source_table]) fksByTable[fk.source_table] = []
  fksByTable[fk.source_table].push(fk)
}

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
  // Relationships
  const tableFks = fksByTable[tableName] ?? []
  // Only keep FKs whose target table exists in our public tables list
  const validFks = tableFks.filter((fk) => tables[fk.target_table])
  if (validFks.length === 0) {
    ts += `        }\n        Relationships: []\n      }\n`
  } else {
    ts += `        }\n        Relationships: [\n`
    for (const fk of validFks) {
      ts += `          {\n`
      ts += `            foreignKeyName: '${fk.constraint_name}'\n`
      ts += `            columns: ['${fk.source_column}']\n`
      ts += `            isOneToOne: false\n`
      ts += `            referencedRelation: '${fk.target_table}'\n`
      ts += `            referencedColumns: ['${fk.target_column}']\n`
      ts += `          },\n`
    }
    ts += `        ]\n      }\n`
  }
}

ts += `    }\n    Views: Record<string, never>\n    Functions: {\n`

// Parse function args/returns
function parsePgType(text) {
  // Strip trailing arg name in 'p_org uuid' form
  const t = text.trim()
  // Map common PG types to TS
  if (/uuid/i.test(t)) return 'string'
  if (/text|varchar|char/i.test(t)) return 'string'
  if (/bool/i.test(t)) return 'boolean'
  if (/int|bigint|smallint|numeric|float|real|double/i.test(t)) return 'number'
  if (/json/i.test(t)) return 'Json'
  if (/timestamp|date|time/i.test(t)) return 'string'
  return 'unknown'
}

for (const fn of funcs) {
  // Parse args like "p_org uuid, p_kind text"
  const argsText = fn.args_text?.trim() ?? ''
  ts += `      ${fn.name}: {\n        Args: `
  if (!argsText) {
    ts += 'Record<string, never>'
  } else {
    ts += '{\n'
    for (const arg of argsText.split(',')) {
      const parts = arg.trim().split(/\s+/)
      if (parts.length >= 2) {
        const argName = parts[0]
        const argType = parts.slice(1).join(' ')
        ts += `          ${argName}: ${parsePgType(argType)}\n`
      }
    }
    ts += '        }'
  }
  ts += `\n        Returns: ${parsePgType(fn.returns_text ?? 'unknown')}\n      }\n`
}

ts += `    }\n    Enums: {\n`
for (const e of enums) {
  ts += `      ${e.name}: ${e.labels.map((v) => `'${v}'`).join(' | ')}\n`
}
ts += `    }\n    CompositeTypes: Record<string, never>\n  }\n}\n`

writeFileSync('packages/database/src/types.ts', ts)
console.log(`✓ Generated packages/database/src/types.ts`)
console.log(`  - ${Object.keys(tables).length} tables`)
console.log(`  - ${fks.length} FK relationships`)
console.log(`  - ${funcs.length} RPC functions`)
console.log(`  - ${enums.length} enums`)
console.log(`  - ${ts.split('\n').length} lines`)
