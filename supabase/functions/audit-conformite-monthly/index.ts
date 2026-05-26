/**
 * KOVAS — Edge Function : audit-conformite-monthly (Upsell #3 Bouclier Conformité).
 *
 * Orchestrator cron mensuel. Pattern fan-out :
 *
 *   1. Cron pg_cron `0 6 1 * *` (1er du mois 6h UTC) déclenche cette fonction.
 *   2. Cette fonction sélectionne les users avec addon `bouclier_conformite`
 *      actif (status IN ('active','trialing')).
 *   3. Pour chaque user, elle vérifie qu'aucun rapport n'existe déjà pour le
 *      mois courant (idempotency UNIQUE(user_id, month_year)).
 *   4. Elle déclenche `audit-conformite-monthly-user` en fan-out (POST avec
 *      user_id). Batch 20 users / invocation pour rester sous le timeout
 *      Edge Functions (15s).
 *
 * Auth : header `Authorization: Bearer <CRON_SECRET>` requis.
 *
 * Cron pg_cron à provisionner côté DB :
 *
 *   SELECT cron.schedule(
 *     'audit-conformite-monthly',
 *     '0 6 1 * *',
 *     $$ SELECT net.http_post(
 *          url := current_setting('app.settings.supabase_functions_url') || '/audit-conformite-monthly',
 *          headers := jsonb_build_object(
 *            'Content-Type', 'application/json',
 *            'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
 *          )
 *        ); $$
 *   );
 *
 * Variables d'env requises :
 *   - SUPABASE_URL                 (toujours injectée par la plateforme)
 *   - SUPABASE_SERVICE_ROLE_KEY    (toujours injectée par la plateforme)
 *   - CRON_SECRET                  (Bearer cron)
 *
 * Variables d'env optionnelles :
 *   - WORKER_FUNCTION_NAME         (défaut: "audit-conformite-monthly-user")
 *   - BATCH_SIZE                   (défaut: 20)
 *
 * AUCUNE mention de provider IA tiers dans ce code (directive transversale).
 *
 * Authority : CLAUDE.md + brief Bouclier Conformité 2026-05-26.
 */

// @ts-nocheck — Deno-only Edge Function ; non compilée par tsc Node.

import { createClient } from 'jsr:@supabase/supabase-js@2'

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Constantes                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

const DEFAULT_BATCH_SIZE = 20
const DEFAULT_WORKER_FUNCTION = 'audit-conformite-monthly-user'

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types internes                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

interface EligibleSubscription {
  user_id: string
  addon_slug: string
  status: string
  current_period_end: string
}

interface WorkerTriggerResult {
  user_id: string
  ok: boolean
  status: number | null
  reason?: string
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Utility — réponse JSON                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Retourne le mois courant au format `YYYY-MM` en UTC (jamais en local pour
 * éviter les bascules au 1er du mois à minuit fuseau Paris).
 */
function currentMonthYearUtc(now: Date = new Date()): string {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Trigger worker — fan-out vers audit-conformite-monthly-user                */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Invoque la fonction worker via fetch interne avec le `CRON_SECRET`.
 * Le pattern fetch (vs invoke) permet de paralléliser proprement et de
 * récupérer le status de chaque invocation.
 */
async function triggerWorker(args: {
  workerUrl: string
  cronSecret: string
  userId: string
  monthYear: string
}): Promise<WorkerTriggerResult> {
  try {
    const resp = await fetch(args.workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${args.cronSecret}`,
      },
      body: JSON.stringify({
        user_id: args.userId,
        month_year: args.monthYear,
      }),
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      return {
        user_id: args.userId,
        ok: false,
        status: resp.status,
        reason: `worker_http_${resp.status}: ${text.slice(0, 200)}`,
      }
    }

    return { user_id: args.userId, ok: true, status: resp.status }
  } catch (err) {
    return {
      user_id: args.userId,
      ok: false,
      status: null,
      reason: err instanceof Error ? err.message : 'network_error',
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Entry point — Deno.serve                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const workerFunction = Deno.env.get('WORKER_FUNCTION_NAME') ?? DEFAULT_WORKER_FUNCTION
  const batchSizeEnv = Deno.env.get('BATCH_SIZE')
  const batchSize =
    batchSizeEnv && /^\d+$/.test(batchSizeEnv) ? Number(batchSizeEnv) : DEFAULT_BATCH_SIZE

  if (!supabaseUrl || !serviceRole || !cronSecret) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }

  // Auth Bearer
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  // Permet override du month_year via body (utile pour replay manuel)
  let overrideMonth: string | null = null
  try {
    const body = (await req.json().catch(() => ({}))) as { month_year?: string }
    if (typeof body.month_year === 'string' && /^\d{4}-\d{2}$/.test(body.month_year)) {
      overrideMonth = body.month_year
    }
  } catch {
    // Pas de body = OK, on prend le mois courant
  }

  const monthYear = overrideMonth ?? currentMonthYearUtc()

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Sélection des users éligibles : addon `bouclier_conformite`
  //    actif (status IN active/trialing).
  const { data: subscriptionsRaw, error: subError } = await supabase
    .from('user_addon_subscriptions')
    .select('user_id, addon_slug, status, current_period_end')
    .eq('addon_slug', 'bouclier_conformite')
    .in('status', ['active', 'trialing'])

  if (subError) {
    console.error('[audit-conformite-monthly] db_error_subscriptions', subError)
    return jsonResponse({ error: 'db_error', detail: subError.message }, 500)
  }

  const subscriptions = (subscriptionsRaw ?? []) as EligibleSubscription[]
  if (subscriptions.length === 0) {
    return jsonResponse({
      ok: true,
      monthYear,
      eligibleCount: 0,
      processedCount: 0,
      skippedCount: 0,
      triggeredCount: 0,
      results: [],
    })
  }

  // 2. Idempotency : exclure les users qui ont déjà un rapport pour ce mois.
  const userIds = subscriptions.map((s) => s.user_id)
  const { data: existingReports, error: reportError } = await supabase
    .from('audit_conformite_reports')
    .select('user_id')
    .in('user_id', userIds)
    .eq('month_year', monthYear)

  if (reportError) {
    console.error('[audit-conformite-monthly] db_error_existing_reports', reportError)
    return jsonResponse({ error: 'db_error', detail: reportError.message }, 500)
  }

  const alreadyDone = new Set(
    (existingReports ?? []).map((r) => (r as { user_id: string }).user_id),
  )

  const toProcess = subscriptions.filter((s) => !alreadyDone.has(s.user_id))

  // 3. Fan-out par batch — tronqué à `batchSize` par invocation pour respecter
  //    le timeout. Les users non traités cette fois seront pris au prochain
  //    déclenchement (idempotent grâce au check ci-dessus).
  const batch = toProcess.slice(0, batchSize)

  const workerUrl = `${supabaseUrl}/functions/v1/${workerFunction}`

  // Trigger en parallèle limité (Promise.allSettled, on attend tous)
  const results = await Promise.all(
    batch.map((s) =>
      triggerWorker({
        workerUrl,
        cronSecret,
        userId: s.user_id,
        monthYear,
      }),
    ),
  )

  const triggeredCount = results.filter((r) => r.ok).length
  const failedCount = results.length - triggeredCount

  if (failedCount > 0) {
    console.error(
      '[audit-conformite-monthly] worker_triggers_failed',
      JSON.stringify(results.filter((r) => !r.ok)),
    )
  }

  return jsonResponse({
    ok: true,
    monthYear,
    eligibleCount: subscriptions.length,
    skippedCount: alreadyDone.size,
    processedCount: batch.length,
    triggeredCount,
    failedCount,
    remainingForNextTick: Math.max(0, toProcess.length - batch.length),
    results,
  })
})
