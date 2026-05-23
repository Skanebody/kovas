// ============================================
// KOVAS — Edge Function : verify-cofrac-batch
//
// Mission : exécution quotidienne par batch de la fonction verify-cofrac
// (créée par VAL-3) sur les diagnostiqueurs dont le dernier contrôle remonte
// à plus de 24h. Permet de détecter suspensions / radiations / renouvellements.
//
// Stratégie : rotation LRU par cofrac_last_api_check ASC (les plus anciens
// d'abord). Default limit=500 / appel cron => couverture complète d'un parc de
// 13k diagnostiqueurs en ~26 jours.
//
// Trigger : pg_cron quotidien 04:00 UTC
//   (migration 20260524250000_verification_continuous_crons.sql)
//
// Auth :
//   - Header Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>, OU
//   - Header x-cron-secret: <CRON_SECRET>
//
// Payload : { mode?: 'recurring' | 'manual', limit?: number, offset?: number }
//
// Log : 1 entrée verification_checks_log par diagnostician avec
//       check_type='cofrac_recurring', check_source='cron'.
// ============================================

/// <reference lib="deno.ns" />
// @ts-nocheck — Deno-only Edge Function ; non compilée par tsc Node.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const DEFAULT_LIMIT = 500
const STALE_HOURS = 24

interface DiagToCheck {
  diagnostician_id: string
  cofrac_number: string | null
  cofrac_last_api_check: string | null
  cofrac_status: string
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
    // ignore — payload optionnel
  }

  const limit = Math.min(Math.max(payload.limit ?? DEFAULT_LIMIT, 1), 2000)
  const offset = Math.max(payload.offset ?? 0, 0)
  const mode = payload.mode ?? 'recurring'

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const staleCutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString()

  // On sélectionne les diagnosticians dont l'état COFRAC est verified (priorité
  // surveillance) OU expired/suspended (pour ne pas figer un statut faux).
  // LRU sur cofrac_last_api_check ASC NULLS FIRST.
  const { data: candidatesRaw, error } = await supabase
    .from('diagnostician_verification_status')
    .select('diagnostician_id, cofrac_number, cofrac_last_api_check, cofrac_status')
    .in('cofrac_status', ['verified', 'expired', 'suspended'])
    .not('cofrac_number', 'is', null)
    .or(`cofrac_last_api_check.is.null,cofrac_last_api_check.lt.${staleCutoff}`)
    .order('cofrac_last_api_check', { ascending: true, nullsFirst: true })
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

  // Limite la concurrence à 5 appels simultanés pour ne pas saturer l'API COFRAC
  const CONCURRENCY = 5
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const chunk = candidates.slice(i, i + CONCURRENCY)
    await Promise.all(
      chunk.map(async (c) => {
        const start = Date.now()
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/verify-cofrac`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${serviceRole}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              diagnostician_id: c.diagnostician_id,
              cofrac_number: c.cofrac_number,
              mode: 'recurring',
            }),
          })

          const durationMs = Date.now() - start

          if (!resp.ok) {
            const t = await resp.text().catch(() => '')
            failed++
            errors.push({
              diagId: c.diagnostician_id,
              reason: `verify-cofrac ${resp.status}: ${t.slice(0, 200)}`,
            })
            await supabase.from('verification_checks_log').insert({
              diagnostician_id: c.diagnostician_id,
              check_type: 'cofrac_recurring',
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
            check_type: 'cofrac_recurring',
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
            check_type: 'cofrac_recurring',
            check_source: 'cron',
            status: 'timeout',
            duration_ms: Date.now() - start,
            result: { exception: msg },
            triggered_by: 'cron',
          })
        }
      }),
    )
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
