/**
 * KOVAS — Edge Function : Quota monthly reset (provisionne ligne du mois pour
 * chaque organisation active).
 *
 * Endpoint POST /functions/v1/quota-monthly-reset
 *
 * Cron : 1er du mois 03:00 UTC.
 *   `0 3 1 * *`
 *
 *   SELECT cron.schedule(
 *     'quota-monthly-reset',
 *     '0 3 1 * *',
 *     $$ SELECT net.http_post(
 *          url := current_setting('app.settings.supabase_functions_url') || '/quota-monthly-reset',
 *          headers := jsonb_build_object(
 *            'Content-Type', 'application/json',
 *            'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
 *          )
 *        ); $$
 *   );
 *
 * Workflow :
 *   1. Pour chaque organization ayant une subscription active (status IN active/trialing) :
 *        a. Lit le plan_code → quotas du subscription_plans associé
 *        b. INSERT row user_usage_quotas (period_month = 1er du mois courant)
 *        c. Si la ligne existe déjà (cron rejoué) → log et skip (UNIQUE constraint)
 *   2. Si plan_code = NULL → skip (probablement subscription en cours de setup)
 *   3. Si subscription canceled/paused → skip
 *   4. Cabinet : missions_quota augmenté (incluant les extras users * 60)
 *
 * Auth : `Authorization: Bearer <CRON_SECRET>`.
 */

// @ts-nocheck — Deno-only Edge Function

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface SubscriptionWithPlan {
  id: string
  organization_id: string
  status: string
  plan_code: string | null
  extra_users_count: number | null
}

interface PlanRow {
  plan_code: string
  missions_quota: number
  storage_gb: number
  chatbot_messages_quota: number
  yousign_signatures_quota: number
  geocoding_requests_quota: number
}

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']
// past_due est inclus : on continue à provisionner pour permettre une réactivation
// douce sans perdre l'usage. Le dunning est géré ailleurs.

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function computeCurrentPeriodMonth(): string {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value ?? `${now.getUTCFullYear()}`
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${year}-${month}-01`
}

async function provisionOrgQuota(
  supabase: ReturnType<typeof createClient>,
  sub: SubscriptionWithPlan,
  plansByCode: Map<string, PlanRow>,
  periodMonth: string,
): Promise<{ status: 'inserted' | 'exists' | 'skipped' | 'error'; detail?: string }> {
  if (!sub.plan_code) return { status: 'skipped', detail: 'no_plan_code' }
  const plan = plansByCode.get(sub.plan_code)
  if (!plan) return { status: 'skipped', detail: `unknown_plan_${sub.plan_code}` }

  // Cabinet : missions_quota inclut les extras users
  // (subscription_plans.missions_quota = base ; extras × 60 missions)
  let missionsQuota = plan.missions_quota
  if (sub.plan_code === 'cabinet' && sub.extra_users_count && sub.extra_users_count > 0) {
    if (missionsQuota !== -1) {
      missionsQuota = missionsQuota + sub.extra_users_count * 60
    }
  }

  const { error } = await supabase.from('user_usage_quotas').insert({
    organization_id: sub.organization_id,
    period_month: periodMonth,
    missions_quota: missionsQuota,
    chatbot_messages_quota: plan.chatbot_messages_quota,
    yousign_signatures_quota: plan.yousign_signatures_quota,
    geocoding_requests_quota: plan.geocoding_requests_quota,
    storage_gb_quota: plan.storage_gb,
  })

  if (error) {
    if (error.code === '23505') {
      // UNIQUE constraint violation (cron rejoué) → existe déjà
      return { status: 'exists' }
    }
    return { status: 'error', detail: error.message }
  }
  return { status: 'inserted' }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!supabaseUrl || !serviceRole || !cronSecret) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }
  if (req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const periodMonth = computeCurrentPeriodMonth()

  // 1. Charge tous les plans (~5 lignes)
  const { data: plans, error: plansErr } = await supabase
    .from('subscription_plans')
    .select(
      'plan_code, missions_quota, storage_gb, chatbot_messages_quota, yousign_signatures_quota, geocoding_requests_quota',
    )
    .eq('is_active', true)
  if (plansErr) {
    return jsonResponse({ error: 'plans_load_failed', detail: plansErr.message }, 500)
  }
  const plansByCode = new Map<string, PlanRow>()
  for (const p of plans as PlanRow[]) plansByCode.set(p.plan_code, p)

  // 2. Stream toutes les subscriptions actives par batch (page 200)
  const tally: Record<string, number> = {
    inserted: 0,
    exists: 0,
    skipped: 0,
    error: 0,
  }
  const errors: { org: string; detail: string }[] = []

  const BATCH_SIZE = 200
  let from = 0
  // Boucle pagination
  while (true) {
    const { data: subs, error: subErr } = await supabase
      .from('subscriptions')
      .select('id, organization_id, status, plan_code, extra_users_count')
      .in('status', ACTIVE_STATUSES)
      .order('id', { ascending: true })
      .range(from, from + BATCH_SIZE - 1)
    if (subErr) {
      return jsonResponse({ error: 'subs_load_failed', detail: subErr.message }, 500)
    }
    const list = (subs ?? []) as SubscriptionWithPlan[]
    if (list.length === 0) break

    for (const sub of list) {
      const r = await provisionOrgQuota(supabase, sub, plansByCode, periodMonth)
      tally[r.status] = (tally[r.status] ?? 0) + 1
      if (r.status === 'error' && r.detail) {
        errors.push({ org: sub.organization_id, detail: r.detail })
      }
    }
    if (list.length < BATCH_SIZE) break
    from += BATCH_SIZE
  }

  console.log('[quota-monthly-reset]', { periodMonth, tally, errorsCount: errors.length })

  return jsonResponse({
    ok: true,
    periodMonth,
    tally,
    errors: errors.slice(0, 50),
  })
})
