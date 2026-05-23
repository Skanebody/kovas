/**
 * KOVAS — Edge Function : Quota tracker (incrément atomique + alertes + overflow).
 *
 * Endpoint POST /functions/v1/quota-tracker
 *
 * Pas de cron : appelé synchronement depuis :
 *   - Workers (Edge Functions IA, schedulers)
 *   - API routes Next.js (via helper apps/web/src/lib/billing/quotas.ts)
 *
 * Auth : header `Authorization: Bearer <CRON_SECRET>` (secret partagé, pas un JWT user).
 *
 * Body :
 *   {
 *     organizationId: uuid,
 *     periodMonth?: 'YYYY-MM-01',   // optionnel, défaut = 1er du mois Europe/Paris
 *     column: 'missions_used' | 'chatbot_messages_used' | 'yousign_signatures_used'
 *           | 'geocoding_requests_used' | 'storage_gb_used',
 *     delta: number                  // peut être >1 (ex batch import 50 missions)
 *   }
 *
 * Workflow :
 *   1. Ensure row du mois courant (RPC ensure_current_month_quota_row si absent)
 *   2. Increment compteur via RPC increment_quota_usage (whitelist colonnes + atomique)
 *   3. Calcule % usage = used / quota (si quota=-1 → 0)
 *   4. Si passage de <80% à >=80% → email + UPDATE alert_80pct_sent_at
 *   5. Si passage à >=100% :
 *        - Si auto_overflow_enabled=true → incrément *_overflow_count
 *        - Sinon → retourne 429 + email "quota atteint"
 *
 * Retourne :
 *   { used, quota, percentage, isOverflowing, overflowCount, overflowAmountCents,
 *     autoOverflowEnabled }
 *
 * NB : storage_gb_used n'est pas incrémenté ici (delta numeric), il est snapshotté
 * périodiquement par un autre worker. Ce endpoint ne gère que les compteurs int.
 */

// @ts-nocheck — Deno-only Edge Function

import { createClient } from 'jsr:@supabase/supabase-js@2'

type IncrementColumn =
  | 'missions_used'
  | 'chatbot_messages_used'
  | 'yousign_signatures_used'
  | 'geocoding_requests_used'

type AnyQuotaColumn = IncrementColumn | 'storage_gb_used'

interface QuotaRow {
  organization_id: string
  period_month: string
  missions_used: number
  missions_quota: number
  missions_overflow_count: number
  missions_overflow_amount_cents: number
  chatbot_messages_used: number
  chatbot_messages_quota: number
  chatbot_overflow_count: number
  chatbot_overflow_amount_cents: number
  yousign_signatures_used: number
  yousign_signatures_quota: number
  yousign_overflow_count: number
  yousign_overflow_amount_cents: number
  geocoding_requests_used: number
  geocoding_requests_quota: number
  geocoding_overflow_count: number
  geocoding_overflow_amount_cents: number
  storage_gb_used: number
  storage_gb_quota: number
  storage_overflow_gb: number
  storage_overflow_amount_cents: number
  auto_overflow_enabled: boolean
  alert_80pct_sent_at: string | null
  alert_100pct_sent_at: string | null
}

const ALLOWED_COLUMNS: AnyQuotaColumn[] = [
  'missions_used',
  'chatbot_messages_used',
  'yousign_signatures_used',
  'geocoding_requests_used',
  'storage_gb_used',
]

const COLUMN_MAP: Record<
  AnyQuotaColumn,
  {
    quotaCol: keyof QuotaRow
    overflowCountCol: keyof QuotaRow
    overflowAmountCol: keyof QuotaRow
    /** Code Stripe pricing pour calcul overflow amount cents. */
    overflowPriceField: keyof OverflowPricing
    /** Label humain pour emails. */
    label: string
  }
> = {
  missions_used: {
    quotaCol: 'missions_quota',
    overflowCountCol: 'missions_overflow_count',
    overflowAmountCol: 'missions_overflow_amount_cents',
    overflowPriceField: 'mission_price_cents',
    label: 'missions',
  },
  chatbot_messages_used: {
    quotaCol: 'chatbot_messages_quota',
    overflowCountCol: 'chatbot_overflow_count',
    overflowAmountCol: 'chatbot_overflow_amount_cents',
    overflowPriceField: 'chatbot_price_cents',
    label: 'messages chatbot',
  },
  yousign_signatures_used: {
    quotaCol: 'yousign_signatures_quota',
    overflowCountCol: 'yousign_overflow_count',
    overflowAmountCol: 'yousign_overflow_amount_cents',
    overflowPriceField: 'signature_price_cents',
    label: 'signatures Yousign',
  },
  geocoding_requests_used: {
    quotaCol: 'geocoding_requests_quota',
    overflowCountCol: 'geocoding_overflow_count',
    overflowAmountCol: 'geocoding_overflow_amount_cents',
    overflowPriceField: 'geocoding_price_cents',
    label: 'requêtes geocoding',
  },
  storage_gb_used: {
    quotaCol: 'storage_gb_quota',
    overflowCountCol: 'storage_overflow_gb',
    overflowAmountCol: 'storage_overflow_amount_cents',
    overflowPriceField: 'storage_price_cents_per_gb',
    label: 'Go de stockage',
  },
}

interface OverflowPricing {
  mission_price_cents: number
  chatbot_price_cents: number
  signature_price_cents: number
  geocoding_price_cents: number
  storage_price_cents_per_gb: number
}

const DEFAULT_OVERFLOW_PRICING: OverflowPricing = {
  mission_price_cents: 200,
  chatbot_price_cents: 5,
  signature_price_cents: 50,
  geocoding_price_cents: 1,
  storage_price_cents_per_gb: 10,
}

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

async function loadPricingForOrg(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
): Promise<OverflowPricing> {
  // Lit le plan_code de la subscription active, puis les colonnes overage_* du plan.
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan_code')
    .eq('organization_id', organizationId)
    .maybeSingle()
  const planCode = (sub as { plan_code?: string | null } | null)?.plan_code ?? null
  if (!planCode) return DEFAULT_OVERFLOW_PRICING

  const { data: plan } = await supabase
    .from('subscription_plans')
    .select(
      'overage_mission_price_cents, overage_chatbot_price_cents, overage_signature_price_cents, overage_geocoding_price_cents, overage_storage_price_cents_per_gb',
    )
    .eq('plan_code', planCode)
    .maybeSingle()
  if (!plan) return DEFAULT_OVERFLOW_PRICING

  const p = plan as {
    overage_mission_price_cents: number
    overage_chatbot_price_cents: number
    overage_signature_price_cents: number
    overage_geocoding_price_cents: number
    overage_storage_price_cents_per_gb: number
  }
  return {
    mission_price_cents: p.overage_mission_price_cents,
    chatbot_price_cents: p.overage_chatbot_price_cents,
    signature_price_cents: p.overage_signature_price_cents,
    geocoding_price_cents: p.overage_geocoding_price_cents,
    storage_price_cents_per_gb: p.overage_storage_price_cents_per_gb,
  }
}

async function loadOrgOwnerEmail(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
): Promise<{ email: string; firstName: string; orgName: string } | null> {
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .maybeSingle()
  const { data: mship } = await supabase
    .from('memberships')
    .select('user_id, profiles:user_id(email, full_name)')
    .eq('organization_id', organizationId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  const profile = (mship as { profiles?: { email: string; full_name: string | null } } | null)
    ?.profiles
  if (!profile) return null
  return {
    email: profile.email,
    firstName: (profile.full_name ?? profile.email).split(' ')[0] ?? profile.email,
    orgName: (org as { name?: string } | null)?.name ?? 'votre cabinet',
  }
}

async function sendAlert(args: {
  resendApiKey: string
  resendFrom: string
  to: string
  subject: string
  bodyText: string
  bodyHtml: string
  category: string
}): Promise<{ ok: boolean }> {
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: args.resendFrom,
        to: [args.to],
        subject: args.subject,
        text: args.bodyText,
        html: args.bodyHtml,
        tags: [{ name: 'category', value: args.category }],
      }),
    })
    return { ok: resp.ok }
  } catch {
    return { ok: false }
  }
}

function build80pctEmail(args: {
  firstName: string
  resourceLabel: string
  used: number
  quota: number
  percentage: number
  appUrl: string
}) {
  const pct = Math.round(args.percentage * 100)
  const subject = `Vous avez consommé ${pct} % de votre quota mensuel de ${args.resourceLabel}`
  const text = `Bonjour ${args.firstName},

Vous avez consommé ${args.used} ${args.resourceLabel} sur ${args.quota} ce mois-ci (${pct} % du forfait).

Sans changement, votre forfait basculera en mode "auto-débordement" dès que vous atteindrez 100 %. Chaque ${args.resourceLabel.replace(/s$/, '')} supplémentaire sera alors facturé(e) au tarif unitaire défini dans votre forfait.

Vous pouvez à tout moment :
- Désactiver l'auto-débordement (les missions au-delà du quota seront refusées)
- Passer à un forfait supérieur (économie immédiate si dépassement régulier)

Voir le détail : ${args.appUrl}/app/account/usage

— Benjamin / KOVAS`
  const html = `<p>Bonjour ${args.firstName},</p>
<p>Vous avez consommé <strong>${args.used} ${args.resourceLabel} sur ${args.quota}</strong> ce mois-ci (${pct} % du forfait).</p>
<p>Sans changement, votre forfait basculera en mode auto-débordement dès 100 %. Chaque ${args.resourceLabel.replace(/s$/, '')} supplémentaire sera alors facturé(e) au tarif unitaire défini dans votre forfait.</p>
<p><a href="${args.appUrl}/app/account/usage">Voir le détail de votre consommation</a></p>
<p>— Benjamin / KOVAS</p>`
  return { subject, text, html }
}

function buildQuotaReachedBlockedEmail(args: {
  firstName: string
  resourceLabel: string
  quota: number
  appUrl: string
}) {
  const subject = `Quota mensuel de ${args.resourceLabel} atteint`
  const text = `Bonjour ${args.firstName},

Vous avez atteint la limite de ${args.quota} ${args.resourceLabel} pour le mois en cours, et l'auto-débordement est désactivé sur votre forfait.

Pour continuer à utiliser ce service ce mois-ci, vous pouvez :
1. Activer l'auto-débordement (facturation unitaire à l'usage)
2. Passer à un forfait supérieur (effet immédiat, prorata facturé)
3. Attendre le 1er du mois prochain (quota réinitialisé automatiquement)

Gérer mon forfait : ${args.appUrl}/app/account/plan

— Benjamin / KOVAS`
  const html = `<p>Bonjour ${args.firstName},</p>
<p>Vous avez atteint la limite de <strong>${args.quota} ${args.resourceLabel}</strong> pour le mois en cours, et l'auto-débordement est désactivé sur votre forfait.</p>
<p>Trois options :</p>
<ol>
  <li>Activer l'auto-débordement (facturation unitaire à l'usage)</li>
  <li>Passer à un forfait supérieur (effet immédiat)</li>
  <li>Attendre le 1er du mois prochain (quota réinitialisé)</li>
</ol>
<p><a href="${args.appUrl}/app/account/plan">Gérer mon forfait</a></p>
<p>— Benjamin / KOVAS</p>`
  return { subject, text, html }
}

interface RequestBody {
  organizationId: string
  periodMonth?: string
  column: AnyQuotaColumn
  delta: number
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? null
  const resendFrom = Deno.env.get('RESEND_FROM') ?? 'KOVAS <contact@kovas.fr>'
  const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://kovas.fr'

  if (!supabaseUrl || !serviceRole || !cronSecret) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }
  if (req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  if (!body.organizationId || !body.column || typeof body.delta !== 'number') {
    return jsonResponse({ error: 'missing_fields' }, 400)
  }
  if (!ALLOWED_COLUMNS.includes(body.column)) {
    return jsonResponse({ error: 'invalid_column' }, 400)
  }
  if (body.column === 'storage_gb_used') {
    return jsonResponse({ error: 'storage_gb_used_not_increment_here' }, 400)
  }
  if (body.delta <= 0) {
    return jsonResponse({ error: 'delta_must_be_positive' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const periodMonth = body.periodMonth ?? computeCurrentPeriodMonth()

  // 1. Ensure row exists
  const { error: ensureErr } = await supabase.rpc('ensure_current_month_quota_row', {
    p_organization_id: body.organizationId,
  })
  if (ensureErr) {
    return jsonResponse({ error: 'ensure_row_failed', detail: ensureErr.message }, 500)
  }

  // 2. Read current state
  const { data: beforeRow, error: beforeErr } = await supabase
    .from('user_usage_quotas')
    .select('*')
    .eq('organization_id', body.organizationId)
    .eq('period_month', periodMonth)
    .maybeSingle()
  if (beforeErr || !beforeRow) {
    return jsonResponse({ error: 'read_failed', detail: beforeErr?.message ?? 'no_row' }, 500)
  }
  const before = beforeRow as QuotaRow

  const map = COLUMN_MAP[body.column]
  const usedBefore = Number(before[body.column])
  const quota = Number(before[map.quotaCol])

  // 3. Increment via RPC
  const { error: incErr } = await supabase.rpc('increment_quota_usage', {
    p_organization_id: body.organizationId,
    p_period_month: periodMonth,
    p_column: body.column,
    p_delta: body.delta,
  })
  if (incErr) {
    return jsonResponse({ error: 'increment_failed', detail: incErr.message }, 500)
  }

  const usedAfter = usedBefore + body.delta

  // 4. Calcule %
  const percentage = quota === -1 ? 0 : usedAfter / quota
  const percentageBefore = quota === -1 ? 0 : usedBefore / quota
  const isOverflowing = quota !== -1 && usedAfter > quota
  const overflowAmount = isOverflowing ? usedAfter - quota : 0

  // Owner info pour emails
  const ownerInfo = resendApiKey ? await loadOrgOwnerEmail(supabase, body.organizationId) : null

  // 5. 80% alert (passage <80% → >=80%)
  if (
    quota !== -1 &&
    percentageBefore < 0.8 &&
    percentage >= 0.8 &&
    percentage < 1 &&
    before.alert_80pct_sent_at === null
  ) {
    if (resendApiKey && ownerInfo) {
      const mail = build80pctEmail({
        firstName: ownerInfo.firstName,
        resourceLabel: map.label,
        used: usedAfter,
        quota,
        percentage,
        appUrl,
      })
      await sendAlert({
        resendApiKey,
        resendFrom,
        to: ownerInfo.email,
        subject: mail.subject,
        bodyText: mail.text,
        bodyHtml: mail.html,
        category: 'quota_80pct',
      })
    }
    await supabase
      .from('user_usage_quotas')
      .update({ alert_80pct_sent_at: new Date().toISOString() })
      .eq('organization_id', body.organizationId)
      .eq('period_month', periodMonth)
    // INSERT notification in-app (table notifications si existe)
    try {
      await supabase.from('notifications').insert({
        organization_id: body.organizationId,
        type: 'quota_warning',
        title: `80 % de votre quota ${map.label} consommé`,
        body: `${usedAfter} / ${quota} ${map.label} ce mois-ci`,
        severity: 'warning',
      })
    } catch {
      // Table peut ne pas exister encore - tolérant
    }
  }

  // 6. 100% : overflow billing ou block
  if (isOverflowing) {
    if (before.auto_overflow_enabled) {
      // Calcul amount via plan pricing
      const pricing = await loadPricingForOrg(supabase, body.organizationId)
      const unitPrice = pricing[map.overflowPriceField]
      const overflowAmountCents = Math.round(overflowAmount * unitPrice)

      // Met à jour overflow_count + overflow_amount (idempotence : on remplace par
      // la valeur recalculée totale plutôt que +delta, plus simple à raisonner).
      const updateObj: Record<string, unknown> = {}
      updateObj[map.overflowCountCol] = overflowAmount
      updateObj[map.overflowAmountCol] = overflowAmountCents
      await supabase
        .from('user_usage_quotas')
        .update(updateObj)
        .eq('organization_id', body.organizationId)
        .eq('period_month', periodMonth)
    } else {
      // Block + email
      if (resendApiKey && ownerInfo && before.alert_100pct_sent_at === null) {
        const mail = buildQuotaReachedBlockedEmail({
          firstName: ownerInfo.firstName,
          resourceLabel: map.label,
          quota,
          appUrl,
        })
        await sendAlert({
          resendApiKey,
          resendFrom,
          to: ownerInfo.email,
          subject: mail.subject,
          bodyText: mail.text,
          bodyHtml: mail.html,
          category: 'quota_100pct_blocked',
        })
        await supabase
          .from('user_usage_quotas')
          .update({ alert_100pct_sent_at: new Date().toISOString() })
          .eq('organization_id', body.organizationId)
          .eq('period_month', periodMonth)
      }
      return jsonResponse(
        {
          error: 'quota_exceeded',
          reason: 'auto_overflow_disabled',
          used: usedAfter,
          quota,
          percentage,
          isOverflowing: true,
          overflowCount: 0,
          overflowAmountCents: 0,
          autoOverflowEnabled: false,
        },
        429,
      )
    }
  }

  // Re-read final
  const { data: afterRow } = await supabase
    .from('user_usage_quotas')
    .select('*')
    .eq('organization_id', body.organizationId)
    .eq('period_month', periodMonth)
    .maybeSingle()
  const after = (afterRow as QuotaRow) ?? before

  return jsonResponse({
    used: Number(after[body.column]),
    quota,
    percentage,
    isOverflowing,
    overflowCount: Number(after[map.overflowCountCol]),
    overflowAmountCents: Number(after[map.overflowAmountCol]),
    autoOverflowEnabled: after.auto_overflow_enabled,
  })
})
