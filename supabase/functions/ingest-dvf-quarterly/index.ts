/**
 * KOVAS — Ingester DVF trimestriel.
 *
 * Edge Function cron (1er de chaque trimestre, 04:00) : pull dernières mutations
 * DVF depuis app.dvf.etalab.gouv.fr et upsert dans data.dvf_mutations.
 *
 * DVF est publié trimestriellement. On sync les 12 derniers mois pour rattraper.
 *
 * Stratégie incrémentale par commune : on liste les communes top-priority
 * (5000 villes SEO) et on fetch leur mutations récentes.
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 chapitre 11.2.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.46.1'

interface DvfMutation {
  id_mutation?: string
  date_mutation: string
  valeur_fonciere?: string | number
  surface_reelle_bati?: string | number
  surface_terrain?: string | number
  type_local?: string
  nature_mutation?: string
  code_commune: string
  section_prefixe?: string
  numero_parcelle?: string
}

interface DvfApiResponse {
  mutations?: DvfMutation[]
}

const DVF_BASE = 'https://app.dvf.etalab.gouv.fr/api/mutations3'
const RATE_DELAY_MS = 200 // ~5 rps

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase credentials missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function listTopCommunes(limit = 500): Promise<string[]> {
  const supabase = getSupabase()
  // Liste les codes INSEE des communes avec le plus de DPE récents
  const { data } = await supabase
    .schema('data' as never)
    .from('ademe_dpe')
    .select('commune_insee')
    .gte('date_etablissement', new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString())
    .limit(50000)
  if (!data) return []
  const counts = new Map<string, number>()
  for (const row of data as { commune_insee: string | null }[]) {
    if (!row.commune_insee) continue
    counts.set(row.commune_insee, (counts.get(row.commune_insee) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([insee]) => insee)
}

async function ingestCommune(communeInsee: string): Promise<{ inserted: number; error?: string }> {
  const url = `${DVF_BASE}/${communeInsee}`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!r.ok) return { inserted: 0, error: `commune ${communeInsee}: HTTP ${r.status}` }
    const data = (await r.json()) as DvfApiResponse
    const mutations = data.mutations ?? []
    if (mutations.length === 0) return { inserted: 0 }

    const supabase = getSupabase()
    const rows = mutations.map((m, idx) => ({
      mutation_id: m.id_mutation ?? `${communeInsee}-${m.date_mutation}-${idx}`,
      date_mutation: m.date_mutation,
      commune_insee: communeInsee,
      section_cadastre: m.section_prefixe ?? null,
      numero_parcelle: m.numero_parcelle ?? null,
      valeur_fonciere: m.valeur_fonciere != null ? Number(m.valeur_fonciere) : null,
      surface_reelle_bati: m.surface_reelle_bati != null ? Number(m.surface_reelle_bati) : null,
      surface_terrain: m.surface_terrain != null ? Number(m.surface_terrain) : null,
      type_local: m.type_local ?? null,
      nature_mutation: m.nature_mutation ?? null,
      raw_jsonb: m as never,
    }))

    const { error } = await supabase
      .schema('data' as never)
      .from('dvf_mutations')
      .upsert(rows as never, { onConflict: 'mutation_id' })
    if (error) return { inserted: 0, error: error.message }

    return { inserted: rows.length }
  } catch (err) {
    return { inserted: 0, error: err instanceof Error ? err.message : 'unknown' }
  }
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
      source: 'dvf',
      last_sync_at: new Date().toISOString(),
      last_sync_status: opts.status,
      last_sync_records_count: opts.records,
      last_sync_duration_ms: opts.durationMs,
      next_sync_due_at: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
      notes: opts.error ?? null,
    } as never)
}

Deno.serve(async () => {
  const startedAt = Date.now()
  let totalInserted = 0
  const errors: string[] = []

  try {
    const communes = await listTopCommunes(500)
    for (const insee of communes) {
      const result = await ingestCommune(insee)
      totalInserted += result.inserted
      if (result.error) errors.push(result.error)
      await new Promise((resolve) => setTimeout(resolve, RATE_DELAY_MS))
    }

    const durationMs = Date.now() - startedAt
    await writeSyncState({
      status: errors.length > 0 ? 'partial' : 'success',
      records: totalInserted,
      durationMs,
      error: errors.slice(0, 3).join('; ') || undefined,
    })

    // Refresh matview transactions_history_by_commune
    const supabase = getSupabase()
    await supabase
      .rpc('refresh_materialized_view', { view_name: 'analytics.transactions_history_by_commune' })
      .catch(() => null)

    return new Response(
      JSON.stringify({
        ok: true,
        communes_processed: communes.length,
        inserted: totalInserted,
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
