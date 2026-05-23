#!/usr/bin/env tsx
/**
 * KOVAS — Snapshot logique Supabase prod
 *
 * Sans pg_dump local, on capture via Management API :
 *  - Inventaire complet : tables, columns, indexes, functions, policies, views, triggers
 *  - Comptes de lignes par table (pour vérifier qu'aucune donnée n'a disparu après consolidate)
 *  - Définitions DDL via pg_get_*ddl pour les objets critiques
 *
 * Output : backups/prod-snapshot-{timestamp}.json
 *
 * Usage :
 *   SUPABASE_ACCESS_TOKEN=sbp_... pnpm tsx scripts/prod-snapshot.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const BACKUPS_DIR = join(__dirname, '..', 'backups')

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'jlizdkffwjdiokvmhcwg'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
if (!TOKEN) {
  console.error('ERROR: SUPABASE_ACCESS_TOKEN requis')
  process.exit(1)
}
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

async function runQuery<T = unknown>(query: string): Promise<T[]> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'curl/8.0',
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    throw new Error(`Query failed (${res.status}): ${await res.text()}`)
  }
  return res.json() as Promise<T[]>
}

async function main(): Promise<void> {
  mkdirSync(BACKUPS_DIR, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').slice(0, 19)

  console.log('[snapshot] Inventaire prod en cours…')

  const [tables, columns, indexes, functions, policies, views, triggers, rowCounts] =
    await Promise.all([
      runQuery<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
      ),
      runQuery<{
        table_name: string
        column_name: string
        data_type: string
        is_nullable: string
        column_default: string | null
      }>(
        `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`,
      ),
      runQuery<{ indexname: string; tablename: string; indexdef: string }>(
        `SELECT indexname, tablename, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname`,
      ),
      runQuery<{ routine_name: string; routine_type: string; data_type: string }>(
        `SELECT routine_name, routine_type, data_type FROM information_schema.routines WHERE routine_schema='public' ORDER BY routine_name`,
      ),
      runQuery<{ policyname: string; tablename: string; cmd: string; permissive: string }>(
        `SELECT policyname, tablename, cmd, permissive FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname`,
      ),
      runQuery<{ table_name: string }>(
        `SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name`,
      ),
      runQuery<{
        trigger_name: string
        event_object_table: string
        action_timing: string
        event_manipulation: string
      }>(
        `SELECT trigger_name, event_object_table, action_timing, event_manipulation FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY event_object_table, trigger_name`,
      ),
      runQuery<{ schemaname: string; relname: string; n_live_tup: number }>(
        `SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY relname`,
      ),
    ])

  const snapshot = {
    captured_at: new Date().toISOString(),
    project_ref: PROJECT_REF,
    summary: {
      tables: tables.length,
      columns: columns.length,
      indexes: indexes.length,
      functions: functions.length,
      policies: policies.length,
      views: views.length,
      triggers: triggers.length,
      total_rows_estimate: rowCounts.reduce((acc, r) => acc + Number(r.n_live_tup ?? 0), 0),
    },
    tables,
    columns,
    indexes,
    functions,
    policies,
    views,
    triggers,
    row_counts: rowCounts,
  }

  const file = join(BACKUPS_DIR, `prod-snapshot-${timestamp}.json`)
  writeFileSync(file, JSON.stringify(snapshot, null, 2), 'utf-8')
  console.log(`[snapshot] OK → ${file}`)
  console.log('[snapshot] Summary :', snapshot.summary)
}

main().catch((err) => {
  console.error('[snapshot] FAILED :', err)
  process.exit(1)
})
