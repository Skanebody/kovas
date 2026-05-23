#!/usr/bin/env tsx
/**
 * KOVAS — Audit migrations locales vs Supabase prod
 *
 * Pour chaque migration `supabase/migrations/*.sql`, on extrait les objets
 * créés (tables, fonctions, indexes, policies, columns) puis on vérifie
 * via Supabase Management API leur présence en prod.
 *
 * Statuts par migration :
 *  - applied      : tous les objets attendus existent en prod
 *  - needs_apply  : aucun des objets clés n'existe (migration jamais jouée)
 *  - partial      : certains objets existent, d'autres manquent
 *  - empty        : la migration ne crée aucun objet trackable (ex: ALTER seul, INSERT only)
 *
 * Output : scripts/migration-status-result.json
 *
 * Usage :
 *   SUPABASE_ACCESS_TOKEN=sbp_... pnpm tsx scripts/migration-status-audit.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'jlizdkffwjdiokvmhcwg'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
if (!TOKEN) {
  console.error('ERROR: SUPABASE_ACCESS_TOKEN requis')
  process.exit(1)
}

const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations')
const OUTPUT_FILE = join(__dirname, 'migration-status-result.json')

type MigrationStatus = 'applied' | 'needs_apply' | 'partial' | 'empty'

interface ParsedObjects {
  tables: string[]
  functions: string[]
  indexes: string[]
  policies: Array<{ name: string; table: string }>
  views: string[]
  triggers: Array<{ name: string; table: string }>
}

interface MigrationReport {
  version: string
  filename: string
  status: MigrationStatus
  expected: ParsedObjects
  missing: ParsedObjects
  existing: ParsedObjects
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runQuery<T = unknown>(query: string, retries = 5): Promise<T[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'curl/8.0',
      },
      body: JSON.stringify({ query }),
    })
    if (res.status === 429 && attempt < retries) {
      const wait = 5000 * 2 ** attempt
      console.warn(`  [rate-limit] backoff ${wait}ms…`)
      await sleep(wait)
      continue
    }
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Query failed (${res.status}): ${body}`)
    }
    return res.json() as Promise<T[]>
  }
  throw new Error('max retries exceeded')
}

/** Extract objects created by a SQL migration. Very forgiving regex-based parser. */
function parseMigration(sql: string): ParsedObjects {
  const stripped = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const tables = new Set<string>()
  const functions = new Set<string>()
  const indexes = new Set<string>()
  const policies: Array<{ name: string; table: string }> = []
  const views = new Set<string>()
  const triggers: Array<{ name: string; table: string }> = []

  // CREATE TABLE [IF NOT EXISTS] [schema.]name
  const tableRe =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.|"public"\.)?([a-z_][\w]*)/gi
  for (const m of stripped.matchAll(tableRe)) tables.add(m[1].toLowerCase())

  // CREATE [OR REPLACE] FUNCTION [schema.]name (
  const fnRe =
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.|"public"\.)?([a-z_][\w]*)\s*\(/gi
  for (const m of stripped.matchAll(fnRe)) functions.add(m[1].toLowerCase())

  // CREATE [UNIQUE] INDEX [IF NOT EXISTS] name ON [schema.]table
  const idxRe =
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][\w]*)\s+ON\s+/gi
  for (const m of stripped.matchAll(idxRe)) indexes.add(m[1].toLowerCase())

  // CREATE POLICY name ON [schema.]table
  const polRe = /CREATE\s+POLICY\s+"?([^"\s]+)"?\s+ON\s+(?:public\.|"public"\.)?([a-z_][\w]*)/gi
  for (const m of stripped.matchAll(polRe)) {
    policies.push({ name: m[1].toLowerCase(), table: m[2].toLowerCase() })
  }

  // CREATE [OR REPLACE] VIEW [schema.]name
  const viewRe =
    /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.|"public"\.)?([a-z_][\w]*)/gi
  for (const m of stripped.matchAll(viewRe)) views.add(m[1].toLowerCase())

  // CREATE TRIGGER name ... ON [schema.]table
  const trigRe =
    /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([a-z_][\w]*)[\s\S]*?ON\s+(?:public\.|"public"\.)?([a-z_][\w]*)/gi
  for (const m of stripped.matchAll(trigRe)) {
    triggers.push({ name: m[1].toLowerCase(), table: m[2].toLowerCase() })
  }

  return {
    tables: [...tables].sort(),
    functions: [...functions].sort(),
    indexes: [...indexes].sort(),
    policies: policies.sort((a, b) => a.name.localeCompare(b.name)),
    views: [...views].sort(),
    triggers: triggers.sort((a, b) => a.name.localeCompare(b.name)),
  }
}

async function fetchProdInventory() {
  const [tables, fns, idx, pols, views, trigs] = await Promise.all([
    runQuery<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`,
    ),
    runQuery<{ routine_name: string }>(
      `SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' AND routine_type='FUNCTION'`,
    ),
    runQuery<{ indexname: string }>(`SELECT indexname FROM pg_indexes WHERE schemaname='public'`),
    runQuery<{ policyname: string; tablename: string }>(
      `SELECT policyname, tablename FROM pg_policies WHERE schemaname='public'`,
    ),
    runQuery<{ table_name: string }>(
      `SELECT table_name FROM information_schema.views WHERE table_schema='public'`,
    ),
    runQuery<{ trigger_name: string; event_object_table: string }>(
      `SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema='public'`,
    ),
  ])
  return {
    tables: new Set(tables.map((t) => t.table_name.toLowerCase())),
    functions: new Set(fns.map((f) => f.routine_name.toLowerCase())),
    indexes: new Set(idx.map((i) => i.indexname.toLowerCase())),
    policies: new Set(
      pols.map((p) => `${p.tablename.toLowerCase()}::${p.policyname.toLowerCase()}`),
    ),
    views: new Set(views.map((v) => v.table_name.toLowerCase())),
    triggers: new Set(
      trigs.map((t) => `${t.event_object_table.toLowerCase()}::${t.trigger_name.toLowerCase()}`),
    ),
  }
}

function diffObjects(
  expected: ParsedObjects,
  prod: Awaited<ReturnType<typeof fetchProdInventory>>,
) {
  const missing: ParsedObjects = {
    tables: expected.tables.filter((t) => !prod.tables.has(t)),
    functions: expected.functions.filter((f) => !prod.functions.has(f)),
    indexes: expected.indexes.filter((i) => !prod.indexes.has(i)),
    policies: expected.policies.filter((p) => !prod.policies.has(`${p.table}::${p.name}`)),
    views: expected.views.filter((v) => !prod.views.has(v)),
    triggers: expected.triggers.filter((t) => !prod.triggers.has(`${t.table}::${t.name}`)),
  }
  const existing: ParsedObjects = {
    tables: expected.tables.filter((t) => prod.tables.has(t)),
    functions: expected.functions.filter((f) => prod.functions.has(f)),
    indexes: expected.indexes.filter((i) => prod.indexes.has(i)),
    policies: expected.policies.filter((p) => prod.policies.has(`${p.table}::${p.name}`)),
    views: expected.views.filter((v) => prod.views.has(v)),
    triggers: expected.triggers.filter((t) => prod.triggers.has(`${t.table}::${t.name}`)),
  }
  return { missing, existing }
}

function countObjects(o: ParsedObjects): number {
  return (
    o.tables.length +
    o.functions.length +
    o.indexes.length +
    o.policies.length +
    o.views.length +
    o.triggers.length
  )
}

function computeStatus(
  expected: ParsedObjects,
  missing: ParsedObjects,
  existing: ParsedObjects,
): MigrationStatus {
  const total = countObjects(expected)
  const miss = countObjects(missing)
  const exist = countObjects(existing)
  if (total === 0) return 'empty'
  if (miss === 0) return 'applied'
  if (exist === 0) return 'needs_apply'
  return 'partial'
}

async function main(): Promise<void> {
  console.log('[audit] Connexion à Supabase prod…')
  const prod = await fetchProdInventory()
  console.log(
    `[audit] Prod inventory : ${prod.tables.size} tables · ${prod.functions.size} fns · ${prod.indexes.size} indexes · ${prod.policies.size} policies · ${prod.views.size} views · ${prod.triggers.size} triggers`,
  )

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  console.log(`[audit] ${files.length} migrations locales à analyser`)

  const reports: MigrationReport[] = []
  for (const filename of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf-8')
    const expected = parseMigration(sql)
    const { missing, existing } = diffObjects(expected, prod)
    const status = computeStatus(expected, missing, existing)
    const version = filename.split('_')[0]
    reports.push({ version, filename, status, expected, missing, existing })
  }

  const summary = {
    applied: reports.filter((r) => r.status === 'applied').length,
    needs_apply: reports.filter((r) => r.status === 'needs_apply').length,
    partial: reports.filter((r) => r.status === 'partial').length,
    empty: reports.filter((r) => r.status === 'empty').length,
    total: reports.length,
  }

  const result = {
    audited_at: new Date().toISOString(),
    project_ref: PROJECT_REF,
    summary,
    prod_inventory_counts: {
      tables: prod.tables.size,
      functions: prod.functions.size,
      indexes: prod.indexes.size,
      policies: prod.policies.size,
      views: prod.views.size,
      triggers: prod.triggers.size,
    },
    migrations: reports,
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf-8')
  console.log(`[audit] Résultat → ${OUTPUT_FILE}`)
  console.log('[audit] Summary :', summary)

  console.log('\n[audit] PARTIAL migrations :')
  for (const r of reports.filter((r) => r.status === 'partial')) {
    console.log(
      `  - ${r.filename} → missing ${countObjects(r.missing)} / ${countObjects(r.expected)}`,
    )
  }
  console.log('\n[audit] NEEDS_APPLY migrations :')
  for (const r of reports.filter((r) => r.status === 'needs_apply')) {
    console.log(`  - ${r.filename} → ${countObjects(r.expected)} objets manquants`)
  }
}

main().catch((err) => {
  console.error('[audit] FAILED :', err)
  process.exit(1)
})
