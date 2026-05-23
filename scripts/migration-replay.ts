#!/usr/bin/env tsx
/**
 * KOVAS — Replay sequential des migrations non appliquées sur Supabase prod
 *
 * Lit `migration-status-result.json` (généré par migration-status-audit.ts)
 * et pour chaque migration `needs_apply` ou `partial` :
 *   1. Lit le fichier .sql
 *   2. Pousse le contenu via Supabase Management API (/database/query)
 *   3. Log le résultat (success / error détail)
 *   4. Si success → insère dans `supabase_migrations.schema_migrations`
 *
 * Modes :
 *   --dry-run  : affiche ce qui serait exécuté, n'exécute rien
 *   --apply    : exécute pour de vrai
 *   --only=YYYYMMDDHHMMSS  : ne traite qu'une seule migration (debug)
 *   --skip-tracking  : ne pas mettre à jour schema_migrations
 *
 * Idempotence : si une migration est déjà partiellement appliquée, on tolère
 * les erreurs « already exists » courantes et on continue.
 *
 * Usage :
 *   SUPABASE_ACCESS_TOKEN=sbp_... pnpm tsx scripts/migration-replay.ts --apply
 */
import { readFileSync, writeFileSync } from 'node:fs'
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
const AUDIT_FILE = join(__dirname, 'migration-status-result.json')
const REPLAY_LOG = join(__dirname, 'migration-replay-log.json')

const args = new Set(process.argv.slice(2))
const DRY_RUN = !args.has('--apply')
const SKIP_TRACKING = args.has('--skip-tracking')
const onlyArg = [...args].find((a) => a.startsWith('--only='))
const ONLY_VERSION = onlyArg ? onlyArg.split('=')[1] : null

interface AuditResult {
  migrations: Array<{
    version: string
    filename: string
    status: 'applied' | 'needs_apply' | 'partial' | 'empty'
  }>
}

interface ReplayLogEntry {
  version: string
  filename: string
  status_before: string
  result: 'success' | 'error' | 'skipped' | 'dry_run'
  duration_ms: number
  error?: string
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runQuery(query: string, retries = 3): Promise<{ ok: boolean; error?: string }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
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
        // Rate limit — exponential backoff
        const wait = 3000 * 2 ** attempt
        console.warn(`  [rate-limit] backoff ${wait}ms (attempt ${attempt + 1}/${retries})…`)
        await sleep(wait)
        continue
      }
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` }
      }
      return { ok: true }
    } catch (err) {
      if (attempt < retries) {
        await sleep(1000 * 2 ** attempt)
        continue
      }
      return { ok: false, error: String(err) }
    }
  }
  return { ok: false, error: 'max retries exceeded' }
}

/** Some errors are benign during replay (idempotency). */
function isBenignError(error: string): boolean {
  return (
    /already exists/i.test(error) ||
    /duplicate_object/i.test(error) ||
    /relation .* already exists/i.test(error) ||
    /type .* already exists/i.test(error) ||
    /constraint .* for relation .* already exists/i.test(error)
  )
}

async function ensureTrackingTable(): Promise<void> {
  const sql = `
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version    text PRIMARY KEY,
      name       text,
      statements text[],
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `
  const { ok, error } = await runQuery(sql)
  if (!ok) {
    throw new Error(`Failed to create schema_migrations tracking: ${error}`)
  }
}

async function recordMigration(version: string, name: string): Promise<void> {
  if (SKIP_TRACKING) return
  const escName = name.replace(/'/g, "''")
  const sql = `
    INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
    VALUES ('${version}', '${escName}', ARRAY[]::text[])
    ON CONFLICT (version) DO NOTHING;
  `
  await runQuery(sql)
}

async function main(): Promise<void> {
  console.log(`[replay] Mode : ${DRY_RUN ? 'DRY RUN (no changes)' : 'APPLY (writing to prod)'}`)
  console.log(`[replay] Project : ${PROJECT_REF}`)

  const audit: AuditResult = JSON.parse(readFileSync(AUDIT_FILE, 'utf-8'))
  console.log(`[replay] Audit chargé : ${audit.migrations.length} migrations`)

  if (!DRY_RUN) {
    console.log('[replay] Création schema_migrations tracking…')
    await ensureTrackingTable()
  }

  // 1. Pour les migrations APPLIED ou EMPTY (déjà jouées indirectement), on tracke juste leur version.
  const alreadyDone = audit.migrations.filter((m) => m.status === 'applied' || m.status === 'empty')
  console.log(
    `[replay] Tracking ${alreadyDone.length} migrations déjà appliquées (status=applied|empty)…`,
  )
  if (!DRY_RUN) {
    for (const m of alreadyDone) {
      await recordMigration(m.version, m.filename.replace('.sql', ''))
    }
  }

  // 2. Pour les migrations NEEDS_APPLY ou PARTIAL, on rejoue le SQL.
  const toReplay = audit.migrations.filter(
    (m) => m.status === 'needs_apply' || m.status === 'partial',
  )
  console.log(`[replay] À rejouer : ${toReplay.length} migrations`)

  const log: ReplayLogEntry[] = []
  let successCount = 0
  let errorCount = 0
  let benignErrorCount = 0

  for (const m of toReplay) {
    if (ONLY_VERSION && m.version !== ONLY_VERSION) continue

    const filepath = join(MIGRATIONS_DIR, m.filename)
    const sql = readFileSync(filepath, 'utf-8')
    const start = Date.now()

    process.stdout.write(`[replay] ${m.filename} (${m.status})... `)

    if (DRY_RUN) {
      process.stdout.write('DRY\n')
      log.push({
        version: m.version,
        filename: m.filename,
        status_before: m.status,
        result: 'dry_run',
        duration_ms: 0,
      })
      continue
    }

    const { ok, error } = await runQuery(sql)
    const duration = Date.now() - start

    // Petit délai entre migrations pour éviter le rate-limit Supabase Management API
    await sleep(500)

    if (ok) {
      process.stdout.write(`OK (${duration}ms)\n`)
      successCount++
      log.push({
        version: m.version,
        filename: m.filename,
        status_before: m.status,
        result: 'success',
        duration_ms: duration,
      })
      await recordMigration(m.version, m.filename.replace('.sql', ''))
    } else if (error && isBenignError(error)) {
      process.stdout.write(`OK (benign error: ${error.slice(0, 80)}…)\n`)
      benignErrorCount++
      log.push({
        version: m.version,
        filename: m.filename,
        status_before: m.status,
        result: 'success',
        duration_ms: duration,
        error: `benign: ${error.slice(0, 200)}`,
      })
      await recordMigration(m.version, m.filename.replace('.sql', ''))
    } else {
      process.stdout.write(`FAIL: ${error?.slice(0, 120)}…\n`)
      errorCount++
      log.push({
        version: m.version,
        filename: m.filename,
        status_before: m.status,
        result: 'error',
        duration_ms: duration,
        error: error ?? 'unknown',
      })
    }
  }

  writeFileSync(
    REPLAY_LOG,
    JSON.stringify(
      {
        run_at: new Date().toISOString(),
        summary: { success: successCount, benign: benignErrorCount, error: errorCount },
        log,
      },
      null,
      2,
    ),
    'utf-8',
  )

  console.log('\n[replay] === SUMMARY ===')
  console.log(`  Success      : ${successCount}`)
  console.log(`  Benign error : ${benignErrorCount}`)
  console.log(`  Error        : ${errorCount}`)
  console.log(`  Log         → ${REPLAY_LOG}`)
}

main().catch((err) => {
  console.error('[replay] FATAL :', err)
  process.exit(1)
})
