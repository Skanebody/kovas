// ============================================
// KOVAS — Edge Function `migrate-legacy-plans-v3`
// Migration one-shot des abonnements E2c (2026-06-02) vers la grille V3 dual track.
// Spec : docs/pricing/v3-dual-track-spec.md §6 (grandfather, prix figés à vie)
//
// Mode : POST { dryRun: boolean = true }
// Auth : header `x-cron-secret` ou clé service_role.
// Idempotence : entrée unique dans `migration_runs` (name = MIGRATION_NAME).
// ============================================

import { serve } from 'https://deno.land/std@0.220.1/http/server.ts'
import { type SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

const MIGRATION_NAME = 'migrate-legacy-plans-v3-2026-06-07'

// Mapping legacy → grandfather (cf. spec §6). Le prix mensuel reste figé côté Stripe :
// la migration ne touche que `plan_code` (label interne) et journalise l'évolution.
const PLAN_CODE_MAPPING: Record<string, string> = {
  essential: 'essential_legacy',
  decouverte: 'decouverte_legacy',
  pro: 'pro_legacy',
  all_inclusive: 'all_inclusive_legacy',
  cabinet: 'cabinet_legacy',
}

const LEGACY_PLAN_CODES = Object.keys(PLAN_CODE_MAPPING)

interface MigrateRequest {
  readonly dryRun?: boolean
}

interface MigrationResultByPlan {
  readonly essential: number
  readonly decouverte: number
  readonly pro: number
  readonly all_inclusive: number
  readonly cabinet: number
}

interface MigrationResult {
  readonly ok: boolean
  readonly dryRun: boolean
  readonly alreadyRan?: boolean
  readonly migrated: number
  readonly byPlan: MigrationResultByPlan
  readonly durationMs: number
}

interface ErrorResult {
  readonly ok: false
  readonly error: string
}

interface SubscriptionRow {
  readonly id: string
  readonly organization_id: string
  readonly plan_code: string
  readonly status: string
}

interface ProfileRow {
  readonly email: string
}

interface OrganizationRow {
  readonly id: string
  readonly name: string | null
}

function jsonResponse(body: MigrationResult | ErrorResult, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function emptyByPlan(): MigrationResultByPlan {
  return {
    essential: 0,
    decouverte: 0,
    pro: 0,
    all_inclusive: 0,
    cabinet: 0,
  }
}

/** Vérifie l'authent admin via service_role (auth header) OU secret cron dédié. */
function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const providedCronSecret = req.headers.get('x-cron-secret') ?? ''

  if (serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) {
    return true
  }
  if (cronSecret && providedCronSecret === cronSecret) {
    return true
  }
  return false
}

/** Récupère email primaire d'une organization via memberships role=owner + profile. */
async function fetchOwnerEmail(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data: membership, error: memErr } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (memErr || !membership) return null

  const userId = (membership as { user_id: string }).user_id
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle()

  if (profErr || !profile) return null
  return (profile as ProfileRow).email
}

async function fetchOrganizationName(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', organizationId)
    .maybeSingle()
  if (error || !data) return null
  return (data as OrganizationRow).name
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)
  }

  if (!isAuthorized(req)) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse(
      { ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
      500,
    )
  }

  let body: MigrateRequest = {}
  try {
    const raw = await req.text()
    if (raw.length > 0) {
      body = JSON.parse(raw) as MigrateRequest
    }
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const dryRun = body.dryRun ?? true
  const startedAt = Date.now()

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Idempotence : si une exécution réelle (non-dryRun) a déjà eu lieu → on s'arrête.
  if (!dryRun) {
    const { data: existing, error: existingErr } = await supabase
      .from('migration_runs')
      .select('id')
      .eq('name', MIGRATION_NAME)
      .maybeSingle()

    if (existingErr) {
      return jsonResponse(
        { ok: false, error: `migration_runs check failed: ${existingErr.message}` },
        500,
      )
    }
    if (existing) {
      return jsonResponse({
        ok: true,
        dryRun,
        alreadyRan: true,
        migrated: 0,
        byPlan: emptyByPlan(),
        durationMs: Date.now() - startedAt,
      })
    }
  }

  // 2. Sélection des subscriptions active sur un plan_code legacy E2c.
  const { data: subsData, error: selectErr } = await supabase
    .from('subscriptions')
    .select('id, organization_id, plan_code, status')
    .eq('status', 'active')
    .in('plan_code', LEGACY_PLAN_CODES)

  if (selectErr) {
    return jsonResponse(
      { ok: false, error: `Subscription select failed: ${selectErr.message}` },
      500,
    )
  }

  const subscriptions: ReadonlyArray<SubscriptionRow> =
    (subsData as ReadonlyArray<SubscriptionRow> | null) ?? []

  const byPlan: MigrationResultByPlan = emptyByPlan()
  let migrated = 0

  // 3. Boucle : update plan_code + journal subscription_history + queue email.
  for (const sub of subscriptions) {
    const newCode = PLAN_CODE_MAPPING[sub.plan_code]
    if (!newCode) continue

    // Comptage par tier d'origine (typé strict).
    switch (sub.plan_code) {
      case 'essential':
        ;(byPlan as { essential: number }).essential++
        break
      case 'decouverte':
        ;(byPlan as { decouverte: number }).decouverte++
        break
      case 'pro':
        ;(byPlan as { pro: number }).pro++
        break
      case 'all_inclusive':
        ;(byPlan as { all_inclusive: number }).all_inclusive++
        break
      case 'cabinet':
        ;(byPlan as { cabinet: number }).cabinet++
        break
      default:
        continue
    }
    migrated++

    if (dryRun) continue

    // 3a. UPDATE plan_code
    const { error: updErr } = await supabase
      .from('subscriptions')
      .update({ plan_code: newCode })
      .eq('id', sub.id)
    if (updErr) {
      return jsonResponse(
        { ok: false, error: `Update subscription ${sub.id} failed: ${updErr.message}` },
        500,
      )
    }

    // 3b. INSERT subscription_history
    const { error: histErr } = await supabase.from('subscription_history').insert({
      subscription_id: sub.id,
      action: 'grandfather_migration_v3',
      old_plan_code: sub.plan_code,
      new_plan_code: newCode,
      metadata: { migration: MIGRATION_NAME, executed_at: new Date().toISOString() },
    })
    if (histErr) {
      return jsonResponse(
        { ok: false, error: `Subscription history insert failed: ${histErr.message}` },
        500,
      )
    }

    // 3c. Queue email Brevo (template `legacy-grandfather-v3`) si email owner trouvé.
    const ownerEmail = await fetchOwnerEmail(supabase, sub.organization_id)
    if (ownerEmail) {
      const orgName = await fetchOrganizationName(supabase, sub.organization_id)
      const { error: emailErr } = await supabase.from('email_queue').insert({
        template: 'legacy-grandfather-v3',
        to_email: ownerEmail,
        subject: 'Votre forfait KOVAS évolue — votre prix reste inchangé',
        data: {
          organization_name: orgName,
          old_plan_code: sub.plan_code,
          new_plan_code: newCode,
          migration: MIGRATION_NAME,
        },
      })
      if (emailErr) {
        // Ne bloque pas la migration sur un échec de queue email — log seulement.
        console.warn(
          `[migrate-legacy-plans-v3] email_queue insert failed for org ${sub.organization_id}: ${emailErr.message}`,
        )
      }
    }
  }

  // 4. Trace d'exécution (uniquement en mode non-dryRun).
  if (!dryRun) {
    const { error: runErr } = await supabase.from('migration_runs').insert({
      name: MIGRATION_NAME,
      affected_rows: migrated,
      metadata: { dryRun: false, byPlan, startedAt: new Date(startedAt).toISOString() },
    })
    if (runErr) {
      return jsonResponse(
        { ok: false, error: `migration_runs insert failed: ${runErr.message}` },
        500,
      )
    }
  }

  return jsonResponse({
    ok: true,
    dryRun,
    migrated,
    byPlan,
    durationMs: Date.now() - startedAt,
  })
})
