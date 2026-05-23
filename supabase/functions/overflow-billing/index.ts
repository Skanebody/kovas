/**
 * KOVAS — Edge Function : Overflow billing (facturation des dépassements mensuels).
 *
 * Endpoint POST /functions/v1/overflow-billing
 *
 * Cron : 1er du mois 05:00 UTC (après quota-monthly-reset à 03:00).
 *   `0 5 1 * *`
 *
 *   SELECT cron.schedule(
 *     'overflow-billing',
 *     '0 5 1 * *',
 *     $$ SELECT net.http_post(
 *          url := current_setting('app.settings.supabase_functions_url') || '/overflow-billing',
 *          headers := jsonb_build_object(
 *            'Content-Type', 'application/json',
 *            'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
 *          )
 *        ); $$
 *   );
 *
 * Workflow :
 *   1. SELECT user_usage_quotas WHERE period_month = (previous month) AND billed_at IS NULL
 *   2. Pour chaque ligne :
 *        a. Calcule total overflow_amount_cents (missions + chatbot + signatures + geocoding + storage)
 *        b. Si total > 0 et auto_overflow_enabled=true :
 *             - Crée Stripe Usage Record (subscription_item dédiée "overflow" + quantity en cents)
 *             - UPDATE stripe_usage_record_id, billed_at = now()
 *             - Email récapitulatif au owner
 *        c. Si total > 0 et auto_overflow_enabled=false :
 *             - Marque billed_at=now() avec un log "blocked" pour ne pas reboucler
 *   3. Retry exponentiel sur erreurs Stripe (3×, backoff 1s/3s/9s), puis admin alert
 *
 * Auth : `Authorization: Bearer <CRON_SECRET>`.
 */

// @ts-nocheck — Deno-only Edge Function

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface QuotaRow {
  id: string
  organization_id: string
  period_month: string
  missions_overflow_count: number
  missions_overflow_amount_cents: number
  chatbot_overflow_count: number
  chatbot_overflow_amount_cents: number
  yousign_overflow_count: number
  yousign_overflow_amount_cents: number
  geocoding_overflow_count: number
  geocoding_overflow_amount_cents: number
  storage_overflow_gb: number
  storage_overflow_amount_cents: number
  auto_overflow_enabled: boolean
  billed_at: string | null
  stripe_usage_record_id: string | null
}

interface SubRow {
  id: string
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function computePreviousPeriodMonth(): string {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(now)
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? '2026')
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? '1')
  // Mois précédent
  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Crée un Stripe Invoice Item ad hoc (one-shot) plutôt qu'un Usage Record :
 * - V1 : pas de tier metered dans le subscription_item, on facture en lump sum
 *   à la fin du mois via InvoiceItem rattaché à la prochaine invoice.
 * - V2 : passer à des subscription_items metered + usage records si besoin.
 *
 * Cette approche est plus simple à comprendre côté user (1 ligne "Dépassements
 * janvier 2026 : 13,50 €") et n'impose pas d'avoir un price metered actif.
 */
async function createStripeOverflowInvoiceItem(args: {
  stripeKey: string
  stripeCustomerId: string
  stripeSubscriptionId: string | null
  amountCents: number
  periodMonth: string
  description: string
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  let attempt = 0
  const maxAttempts = 3
  const delays = [1000, 3000, 9000]
  while (attempt < maxAttempts) {
    try {
      const form = new URLSearchParams()
      form.append('customer', args.stripeCustomerId)
      if (args.stripeSubscriptionId) {
        form.append('subscription', args.stripeSubscriptionId)
      }
      form.append('amount', String(args.amountCents))
      form.append('currency', 'eur')
      form.append('description', args.description)
      form.append('metadata[type]', 'overflow_billing')
      form.append('metadata[period_month]', args.periodMonth)
      const resp = await fetch('https://api.stripe.com/v1/invoiceitems', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${args.stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      })
      if (resp.ok) {
        const data = (await resp.json()) as { id?: string }
        return { ok: true, id: data.id }
      }
      const errText = await resp.text().catch(() => '')
      // 4xx pas de retry (sauf 429)
      if (resp.status < 500 && resp.status !== 429) {
        return { ok: false, error: errText.slice(0, 400) }
      }
      attempt += 1
      if (attempt < maxAttempts) await sleep(delays[attempt - 1] ?? 1000)
    } catch (err) {
      attempt += 1
      if (attempt < maxAttempts) await sleep(delays[attempt - 1] ?? 1000)
      else return { ok: false, error: err instanceof Error ? err.message : 'network' }
    }
  }
  return { ok: false, error: 'max_retries_exceeded' }
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

function monthLabel(period: string): string {
  // 'YYYY-MM-01' → 'janvier 2026'
  const d = new Date(`${period}T00:00:00Z`)
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function buildOverflowRecapEmail(args: {
  firstName: string
  monthLabel: string
  details: { label: string; count: number; amountCents: number }[]
  totalCents: number
  appUrl: string
}) {
  const lines = args.details
    .filter((d) => d.amountCents > 0)
    .map((d) => `- ${d.count} ${d.label} hors forfait : ${formatEur(d.amountCents)}`)
    .join('\n')
  const subject = `Récapitulatif dépassements ${args.monthLabel} : ${formatEur(args.totalCents)} HT`
  const text = `Bonjour ${args.firstName},

Récapitulatif de vos dépassements pour ${args.monthLabel} :
${lines}

Total HT facturé : ${formatEur(args.totalCents)}
(facture jointe à votre prochain prélèvement mensuel)

Détail complet et facture PDF : ${args.appUrl}/app/account/usage

— Benjamin / KOVAS`
  const detailsHtml = args.details
    .filter((d) => d.amountCents > 0)
    .map(
      (d) =>
        `<li><strong>${d.count} ${d.label}</strong> hors forfait : ${formatEur(d.amountCents)}</li>`,
    )
    .join('')
  const html = `<p>Bonjour ${args.firstName},</p>
<p>Récapitulatif de vos dépassements pour <strong>${args.monthLabel}</strong> :</p>
<ul>${detailsHtml}</ul>
<p><strong>Total HT facturé : ${formatEur(args.totalCents)}</strong> (joint à votre prochain prélèvement).</p>
<p><a href="${args.appUrl}/app/account/usage">Détail et facture PDF</a></p>
<p>— Benjamin / KOVAS</p>`
  return { subject, text, html }
}

async function sendEmail(args: {
  apiKey: string
  from: string
  to: string
  subject: string
  text: string
  html: string
  category: string
}): Promise<{ ok: boolean }> {
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: args.from,
        to: [args.to],
        subject: args.subject,
        text: args.text,
        html: args.html,
        tags: [{ name: 'category', value: args.category }],
      }),
    })
    return { ok: resp.ok }
  } catch {
    return { ok: false }
  }
}

async function processQuotaRow(
  supabase: ReturnType<typeof createClient>,
  env: {
    stripeKey: string | null
    resendApiKey: string | null
    resendFrom: string
    appUrl: string
    adminEmail: string | null
  },
  row: QuotaRow,
): Promise<{ status: string; detail?: string }> {
  const total =
    row.missions_overflow_amount_cents +
    row.chatbot_overflow_amount_cents +
    row.yousign_overflow_amount_cents +
    row.geocoding_overflow_amount_cents +
    row.storage_overflow_amount_cents

  if (total <= 0) {
    // Pas d'overflow : on marque quand même billed_at pour ne pas relire
    await supabase
      .from('user_usage_quotas')
      .update({ billed_at: new Date().toISOString() })
      .eq('id', row.id)
    return { status: 'zero_overflow' }
  }

  if (!row.auto_overflow_enabled) {
    // Audit log : pas de facturation, blocked
    await supabase
      .from('user_usage_quotas')
      .update({ billed_at: new Date().toISOString() })
      .eq('id', row.id)
    return { status: 'blocked_no_auto_overflow' }
  }

  if (!env.stripeKey) {
    return { status: 'error', detail: 'no_stripe_key' }
  }

  // Charge la subscription pour Stripe customer/subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, stripe_subscription_id, stripe_customer_id')
    .eq('organization_id', row.organization_id)
    .maybeSingle()
  const subscription = sub as SubRow | null
  if (!subscription || !subscription.stripe_customer_id) {
    return { status: 'error', detail: 'no_stripe_customer' }
  }

  const description = `Dépassements forfait ${monthLabel(row.period_month)}`
  const stripeResult = await createStripeOverflowInvoiceItem({
    stripeKey: env.stripeKey,
    stripeCustomerId: subscription.stripe_customer_id,
    stripeSubscriptionId: subscription.stripe_subscription_id,
    amountCents: total,
    periodMonth: row.period_month,
    description,
  })

  if (!stripeResult.ok) {
    // Admin alert (best-effort)
    if (env.resendApiKey && env.adminEmail) {
      await sendEmail({
        apiKey: env.resendApiKey,
        from: env.resendFrom,
        to: env.adminEmail,
        subject: `[KOVAS admin] overflow-billing échec org=${row.organization_id}`,
        text: `Overflow billing failed for org ${row.organization_id}, period ${row.period_month}, amount ${total}c.\nError: ${stripeResult.error}`,
        html: `<p>Overflow billing failed</p><pre>org=${row.organization_id}\nperiod=${row.period_month}\namount=${total}c\nerror=${stripeResult.error}</pre>`,
        category: 'admin_alert',
      })
    }
    return { status: 'stripe_error', detail: stripeResult.error }
  }

  await supabase
    .from('user_usage_quotas')
    .update({
      stripe_usage_record_id: stripeResult.id ?? null,
      billed_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  // Récap email au owner
  if (env.resendApiKey) {
    const { data: ownerProfile } = await supabase
      .from('memberships')
      .select('user_id, profiles:user_id(email, full_name)')
      .eq('organization_id', row.organization_id)
      .eq('role', 'owner')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    const profile = (
      ownerProfile as { profiles?: { email: string; full_name: string | null } } | null
    )?.profiles
    if (profile) {
      const firstName = (profile.full_name ?? profile.email).split(' ')[0] ?? profile.email
      const mail = buildOverflowRecapEmail({
        firstName,
        monthLabel: monthLabel(row.period_month),
        details: [
          {
            label: 'missions',
            count: row.missions_overflow_count,
            amountCents: row.missions_overflow_amount_cents,
          },
          {
            label: 'messages chatbot',
            count: row.chatbot_overflow_count,
            amountCents: row.chatbot_overflow_amount_cents,
          },
          {
            label: 'signatures',
            count: row.yousign_overflow_count,
            amountCents: row.yousign_overflow_amount_cents,
          },
          {
            label: 'requêtes geocoding',
            count: row.geocoding_overflow_count,
            amountCents: row.geocoding_overflow_amount_cents,
          },
          {
            label: 'Go de stockage',
            count: Number(row.storage_overflow_gb),
            amountCents: row.storage_overflow_amount_cents,
          },
        ],
        totalCents: total,
        appUrl: env.appUrl,
      })
      await sendEmail({
        apiKey: env.resendApiKey,
        from: env.resendFrom,
        to: profile.email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        category: 'overflow_recap',
      })
    }
  }

  return { status: 'billed' }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? null
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? null
  const resendFrom = Deno.env.get('RESEND_FROM') ?? 'KOVAS <contact@kovas.fr>'
  const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://kovas.fr'
  const adminEmail = Deno.env.get('KOVAS_ADMIN_EMAIL') ?? null

  if (!supabaseUrl || !serviceRole || !cronSecret) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }
  if (req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const previous = computePreviousPeriodMonth()

  const { data: rows, error } = await supabase
    .from('user_usage_quotas')
    .select(
      'id, organization_id, period_month, missions_overflow_count, missions_overflow_amount_cents, chatbot_overflow_count, chatbot_overflow_amount_cents, yousign_overflow_count, yousign_overflow_amount_cents, geocoding_overflow_count, geocoding_overflow_amount_cents, storage_overflow_gb, storage_overflow_amount_cents, auto_overflow_enabled, billed_at, stripe_usage_record_id',
    )
    .eq('period_month', previous)
    .is('billed_at', null)
    .limit(500)
  if (error) {
    return jsonResponse({ error: 'db_error', detail: error.message }, 500)
  }
  const list = (rows ?? []) as QuotaRow[]
  const tally: Record<string, number> = {
    billed: 0,
    zero_overflow: 0,
    blocked_no_auto_overflow: 0,
    stripe_error: 0,
    error: 0,
  }
  for (const row of list) {
    try {
      const r = await processQuotaRow(
        supabase,
        { stripeKey, resendApiKey, resendFrom, appUrl, adminEmail },
        row,
      )
      tally[r.status] = (tally[r.status] ?? 0) + 1
    } catch (err) {
      tally.error += 1
      console.error('[overflow-billing] failed', row.id, err)
    }
  }

  return jsonResponse({
    ok: true,
    periodMonth: previous,
    processed: list.length,
    tally,
  })
})
