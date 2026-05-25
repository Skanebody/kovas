/**
 * KOVAS — Refresh des vues matérialisées analytics.*.
 *
 * Edge Function cron quotidien (06:00). Refresh CONCURRENTLY pour pas bloquer
 * les lectures pendant le refresh.
 *
 * Vues refresh :
 *   - analytics.passoires_thermiques_by_commune (depuis data.ademe_dpe)
 *   - analytics.transactions_history_by_commune (depuis data.dvf_mutations)
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 chapitre 11.5.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.46.1'

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase credentials missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

Deno.serve(async () => {
  const startedAt = Date.now()
  const supabase = getSupabase()
  const results: Array<{ view: string; ok: boolean; error?: string; ms: number }> = []

  const views = [
    'analytics.passoires_thermiques_by_commune',
    'analytics.transactions_history_by_commune',
  ]

  for (const view of views) {
    const t0 = Date.now()
    try {
      const { error } = await supabase.rpc('execute_sql', {
        sql: `REFRESH MATERIALIZED VIEW CONCURRENTLY ${view};`,
      })
      results.push({ view, ok: !error, error: error?.message, ms: Date.now() - t0 })
    } catch (err) {
      results.push({
        view,
        ok: false,
        error: err instanceof Error ? err.message : 'unknown',
        ms: Date.now() - t0,
      })
    }
  }

  return new Response(
    JSON.stringify({
      ok: results.every((r) => r.ok),
      duration_ms: Date.now() - startedAt,
      results,
    }),
    { headers: { 'content-type': 'application/json' } },
  )
})
