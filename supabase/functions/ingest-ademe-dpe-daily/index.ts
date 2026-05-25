/**
 * KOVAS — Ingester ADEME DPE quotidien.
 *
 * Edge Function cron (toutes les nuits 03:00) : pull delta des nouveaux DPE
 * depuis observatoire-dpe-audit.ademe.fr et upsert dans data.ademe_dpe.
 *
 * Stratégie incrémentale :
 *   1. Read last_sync_at depuis internal.ingestion_state WHERE source='ademe_dpe'
 *   2. Query ADEME avec where=date_etablissement_dpe > last_sync_at
 *   3. Pagination par 1000 records
 *   4. Upsert sur numero_dpe (idempotent)
 *   5. Update ingestion_state
 *
 * Rate limit ADEME : 30 rps. On reste à 10 rps par sécurité.
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 chapitre 11.2.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.46.1'

interface AdemeDpeRecord {
  numero_dpe: string
  date_etablissement_dpe: string
  classe_consommation_energie?: string
  classe_estimation_ges?: string
  surface_habitable_logement?: string | number
  conso_5_usages_par_m2?: string | number
  emission_ges_5_usages_par_m2?: string | number
  methode_application_dpe?: string
  code_insee_commune_corrige?: string
  geo_point_2d_lat?: number
  geo_point_2d_lon?: number
}

interface AdemeApiResponse {
  total?: number
  next?: string
  results?: AdemeDpeRecord[]
}

const ADEME_BASE = 'https://observatoire-dpe-audit.ademe.fr/pub/dpe-france/lines'
const PAGE_SIZE = 1000
const MAX_PAGES_PER_RUN = 50
const RATE_DELAY_MS = 100

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase credentials missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function readLastSync(): Promise<string> {
  const supabase = getSupabase()
  const { data } = await supabase
    .schema('internal' as never)
    .from('ingestion_state')
    .select('last_sync_at')
    .eq('source', 'ademe_dpe')
    .maybeSingle()
  return (data as { last_sync_at?: string } | null)?.last_sync_at ?? '2025-01-01T00:00:00Z'
}

async function writeSyncState(opts: {
  status: string
  records: number
  durationMs: number
  error?: string
}): Promise<void> {
  const supabase = getSupabase()
  await supabase
    .schema('internal' as never)
    .from('ingestion_state')
    .upsert({
      source: 'ademe_dpe',
      last_sync_at: new Date().toISOString(),
      last_sync_status: opts.status,
      last_sync_records_count: opts.records,
      last_sync_duration_ms: opts.durationMs,
      next_sync_due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      notes: opts.error ?? null,
    } as never)
}

function computeQualityScore(r: AdemeDpeRecord): number {
  let score = 100
  if (!r.classe_consommation_energie) score -= 30
  if (!r.classe_estimation_ges) score -= 20
  if (!r.surface_habitable_logement || Number(r.surface_habitable_logement) <= 0) score -= 20
  if (!r.geo_point_2d_lat || !r.geo_point_2d_lon) score -= 15
  if (!r.code_insee_commune_corrige) score -= 15
  return Math.max(0, score)
}

async function ingestPage(
  records: AdemeDpeRecord[],
): Promise<{ inserted: number; errors: string[] }> {
  const supabase = getSupabase()
  const rows = records.map((r) => ({
    numero_dpe: r.numero_dpe,
    date_etablissement: r.date_etablissement_dpe,
    commune_insee: r.code_insee_commune_corrige ?? null,
    class_dpe: r.classe_consommation_energie ?? null,
    class_ges: r.classe_estimation_ges ?? null,
    surface_habitable:
      r.surface_habitable_logement != null ? Number(r.surface_habitable_logement) : null,
    consommation_5_usages: r.conso_5_usages_par_m2 != null ? Number(r.conso_5_usages_par_m2) : null,
    emissions_ges_5_usages:
      r.emission_ges_5_usages_par_m2 != null ? Number(r.emission_ges_5_usages_par_m2) : null,
    methode: r.methode_application_dpe ?? null,
    geo_point_lat: r.geo_point_2d_lat ?? null,
    geo_point_lng: r.geo_point_2d_lon ?? null,
    quality_score: computeQualityScore(r),
    raw_jsonb: r as never,
  }))

  const errors: string[] = []
  const { error } = await supabase
    .schema('data' as never)
    .from('ademe_dpe')
    .upsert(rows as never, { onConflict: 'numero_dpe' })
  if (error) errors.push(error.message)

  return { inserted: rows.length, errors }
}

Deno.serve(async () => {
  const startedAt = Date.now()
  let totalInserted = 0
  const errors: string[] = []

  try {
    const lastSync = await readLastSync()
    const where = `date_etablissement_dpe>${lastSync.substring(0, 10)}`

    let nextUrl: string | null =
      `${ADEME_BASE}?q_mode=simple&where=${encodeURIComponent(where)}&sort=date_etablissement_dpe&size=${PAGE_SIZE}`
    let pageCount = 0

    while (nextUrl && pageCount < MAX_PAGES_PER_RUN) {
      const r: Response = await fetch(nextUrl, { signal: AbortSignal.timeout(30000) })
      if (!r.ok) {
        errors.push(`page ${pageCount}: HTTP ${r.status}`)
        break
      }
      const data = (await r.json()) as AdemeApiResponse
      const records = data.results ?? []
      if (records.length === 0) break

      const result = await ingestPage(records)
      totalInserted += result.inserted
      errors.push(...result.errors)

      nextUrl = data.next ?? null
      pageCount += 1
      await new Promise((resolve) => setTimeout(resolve, RATE_DELAY_MS))
    }

    const durationMs = Date.now() - startedAt
    await writeSyncState({
      status: errors.length > 0 ? 'partial' : 'success',
      records: totalInserted,
      durationMs,
      error: errors.slice(0, 3).join('; ') || undefined,
    })

    return new Response(
      JSON.stringify({
        ok: true,
        inserted: totalInserted,
        pages: pageCount,
        durationMs,
        errors: errors.length,
      }),
      { headers: { 'content-type': 'application/json' } },
    )
  } catch (err) {
    const durationMs = Date.now() - startedAt
    const msg = err instanceof Error ? err.message : 'unknown error'
    await writeSyncState({ status: 'failed', records: totalInserted, durationMs, error: msg })
    return new Response(JSON.stringify({ ok: false, error: msg, inserted: totalInserted }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
})
