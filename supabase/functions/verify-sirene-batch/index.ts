// ============================================
// KOVAS — Edge Function : verify-sirene-batch
//
// Mission : re-vérifier annuellement (par lots) chaque diagnostician au
// répertoire SIRENE (INSEE) pour détecter : radiation, mise en liquidation,
// changement de dirigeant, changement de forme juridique.
//
// Stratégie : LRU par sirene_last_api_check ASC NULLS FIRST. Cible par
// défaut tous les diagnosticians dont le dernier check remonte à >365 jours.
//
// Trigger : pg_cron annuel 1er janvier 06:00 UTC.
//   Peut aussi être déclenché manuellement (mode='manual', limit personnalisé)
//
// Auth :
//   - Header Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>, OU
//   - Header x-cron-secret: <CRON_SECRET>
//
// Payload : { mode?: 'annual_recheck' | 'manual', limit?: number, offset?: number }
//
// Log : 1 entrée verification_checks_log par diagnostician avec
//       check_type='sirene_annual', check_source='cron'.
// ============================================

/// <reference lib="deno.ns" />
// @ts-nocheck — Deno-only Edge Function ; non compilée par tsc Node.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const DEFAULT_LIMIT = 500
const STALE_DAYS = 365

interface DiagToCheck {
  diagnostician_id: string
  sirene_siret: string | null
  sirene_last_api_check: string | null
  sirene_status: string
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')

  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'missing_supabase_env' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const cronHeader = req.headers.get('x-cron-secret') ?? ''
  const authorized =
    authHeader === `Bearer ${serviceRole}` ||
    (cronSecret !== undefined && cronHeader === cronSecret)
  if (!authorized) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  let payload: { mode?: string; limit?: number; offset?: number } = {}
  try {
    payload = await req.json()
  } catch {
    // payload optionnel
  }

  const limit = Math.min(Math.max(payload.limit ?? DEFAULT_LIMIT, 1), 5000)
  const offset = Math.max(payload.offset ?? 0, 0)
  const mode = payload.mode ?? 'annual_recheck'

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const staleCutoff = new Date(Date.now() - STALE_DAYS * 86400 * 1000).toISOString()

  const { data: candidatesRaw, error } = await supabase
    .from('diagnostician_verification_status')
    .select('diagnostician_id, sirene_siret, sirene_last_api_check, sirene_status')
    .in('sirene_status', ['verified', 'radiated', 'liquidation'])
    .not('sirene_siret', 'is', null)
    .or(`sirene_last_api_check.is.null,sirene_last_api_check.lt.${staleCutoff}`)
    .order('sirene_last_api_check', { ascending: true, nullsFirst: true })
    .range(offset, offset + limit - 1)

  if (error) {
    return jsonResponse({ error: 'db_error', detail: error.message }, 500)
  }

  const candidates = (candidatesRaw ?? []) as DiagToCheck[]

  if (candidates.length === 0) {
    return jsonResponse({ ok: true, mode, processed: 0, message: 'no_candidates' })
  }

  let success = 0
  let failed = 0
  const errors: Array<{ diagId: string; reason: string }> = []

  // INSEE Sirene API : limite à 30 req/min — concurrency 2 + throttle 1500ms entre chunks
  const CONCURRENCY = 2
  const THROTTLE_MS = 1500
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const chunk = candidates.slice(i, i + CONCURRENCY)
    await Promise.all(
      chunk.map(async (c) => {
        const start = Date.now()
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/verify-sirene`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${serviceRole}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              diagnostician_id: c.diagnostician_id,
              siret: c.sirene_siret,
              mode: 'annual_recheck',
            }),
          })

          const durationMs = Date.now() - start

          if (!resp.ok) {
            const t = await resp.text().catch(() => '')
            failed++
            errors.push({
              diagId: c.diagnostician_id,
              reason: `verify-sirene ${resp.status}: ${t.slice(0, 200)}`,
            })
            await supabase.from('verification_checks_log').insert({
              diagnostician_id: c.diagnostician_id,
              check_type: 'sirene_annual',
              check_source: 'cron',
              status: 'failure',
              duration_ms: durationMs,
              result: { http_status: resp.status, body: t.slice(0, 500) },
              triggered_by: 'cron',
            })
            return
          }

          const body = (await resp.json().catch(() => ({}))) as Record<string, unknown>
          success++
          await supabase.from('verification_checks_log').insert({
            diagnostician_id: c.diagnostician_id,
            check_type: 'sirene_annual',
            check_source: 'cron',
            status: 'success',
            duration_ms: durationMs,
            result: body,
            triggered_by: 'cron',
          })
        } catch (e) {
          failed++
          const msg = String(e).slice(0, 200)
          errors.push({ diagId: c.diagnostician_id, reason: `exception: ${msg}` })
          await supabase.from('verification_checks_log').insert({
            diagnostician_id: c.diagnostician_id,
            check_type: 'sirene_annual',
            check_source: 'cron',
            status: 'timeout',
            duration_ms: Date.now() - start,
            result: { exception: msg },
            triggered_by: 'cron',
          })
        }
      }),
    )
    // Throttle pour respecter quota INSEE 30 req/min
    if (i + CONCURRENCY < candidates.length) {
      await new Promise((r) => setTimeout(r, THROTTLE_MS))
    }
  }

  return jsonResponse({
    ok: true,
    mode,
    processed: candidates.length,
    success,
    failed,
    errors: errors.length ? errors.slice(0, 20) : undefined,
  })
})
