/**
 * KOVAS — Edge Function : refresh-city-stats-batch
 *
 * Sélectionne jusqu'à 200 villes éligibles au rafraîchissement
 * (`next_refresh_due < now()` et pas en `fetching`) et invoque l'Edge
 * Function unitaire `refresh-city-stats` en parallèle (concurrence 5).
 *
 * Invocation :
 *   POST /functions/v1/refresh-city-stats-batch
 *   Body : { mode?: 'recurring'|'manual', limit?: number }
 *
 * Cron quotidien :
 *   pg_cron `kovas-refresh-city-stats-daily` 02:00 UTC → 200 villes/jour
 *   → 5000 villes en rotation continue (~25 jours par ville).
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

interface CityRow {
  city_slug: string
  city_name: string
  dept_code: string
  insee_code: string | null
}

interface BatchResult {
  ok: boolean
  total_selected: number
  succeeded: number
  failed: number
  durations: { p50_ms: number; p95_ms: number; total_ms: number }
  errors: Array<{ city_slug: string; message: string }>
}

async function invokeUnit(
  city: CityRow,
): Promise<{ ok: boolean; durationMs: number; error?: string }> {
  const t0 = Date.now()
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/refresh-city-stats`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        city_slug: city.city_slug,
        city_name: city.city_name,
        dept_code: city.dept_code,
        insee_code: city.insee_code ?? undefined,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    return {
      ok: res.ok && json.ok !== false,
      durationMs: Date.now() - t0,
      error: json.error,
    }
  } catch (err) {
    return { ok: false, durationMs: Date.now() - t0, error: (err as Error).message }
  }
}

/** Concurrence simple par batch de N (au lieu de pool dynamique pour rester portable). */
async function runWithConcurrency(
  cities: CityRow[],
  concurrency: number,
): Promise<Array<{ city: CityRow; ok: boolean; durationMs: number; error?: string }>> {
  const out: Array<{ city: CityRow; ok: boolean; durationMs: number; error?: string }> = []
  let i = 0
  while (i < cities.length) {
    const slice = cities.slice(i, i + concurrency)
    const results = await Promise.all(
      slice.map(async (c) => {
        const r = await invokeUnit(c)
        return { city: c, ...r }
      }),
    )
    out.push(...results)
    i += concurrency
  }
  return out
}

Deno.serve(async (req) => {
  const t0 = Date.now()

  const authHeader = req.headers.get('Authorization') ?? ''
  const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
  const isServiceRole = SERVICE_ROLE_KEY && authHeader === `Bearer ${SERVICE_ROLE_KEY}`
  const isCron = CRON_SECRET && cronSecretHeader === CRON_SECRET

  if (!isServiceRole && !isCron) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  let limit = 200
  try {
    const body = (await req.json().catch(() => ({}))) as { limit?: number }
    if (typeof body.limit === 'number' && body.limit > 0 && body.limit <= 500) {
      limit = body.limit
    }
  } catch {
    // ignore
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Sélection : villes en pending OU dont next_refresh_due < now() OU NULL,
  // hors fetching (pour éviter double-run concurrent).
  const { data, error } = await (supabase as any)
    .from('city_real_stats')
    .select('city_slug, city_name, dept_code, insee_code')
    .neq('refresh_status', 'fetching')
    .or(`next_refresh_due.is.null,next_refresh_due.lt.${new Date().toISOString()}`)
    .order('next_refresh_due', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const cities = (data ?? []) as CityRow[]
  if (cities.length === 0) {
    return new Response(
      JSON.stringify({
        ok: true,
        total_selected: 0,
        succeeded: 0,
        failed: 0,
        durations: { p50_ms: 0, p95_ms: 0, total_ms: Date.now() - t0 },
        errors: [],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }

  const results = await runWithConcurrency(cities, 5)

  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b)
  const p50 = durations[Math.floor(durations.length * 0.5)] ?? 0
  const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0
  const succeeded = results.filter((r) => r.ok).length
  const failed = results.length - succeeded
  const errors = results
    .filter((r) => !r.ok)
    .map((r) => ({ city_slug: r.city.city_slug, message: r.error ?? 'unknown' }))

  const result: BatchResult = {
    ok: true,
    total_selected: cities.length,
    succeeded,
    failed,
    durations: { p50_ms: p50, p95_ms: p95, total_ms: Date.now() - t0 },
    errors: errors.slice(0, 20),
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
})
