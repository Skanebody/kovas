/**
 * KOVAS — Edge Function : Tick cron des essais 14j sur modules add-on.
 *
 * Endpoint POST /functions/v1/module-trial-tick
 *
 * Cron : quotidien à 09:00 UTC (= 10:00 ou 11:00 Europe/Paris selon DST).
 *   `0 9 * * *`
 *
 *   SELECT cron.schedule(
 *     'module-trial-tick',
 *     '0 9 * * *',
 *     $$ SELECT net.http_post(
 *          url := current_setting('app.settings.supabase_functions_url') || '/module-trial-tick',
 *          headers := jsonb_build_object(
 *            'Content-Type', 'application/json',
 *            'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
 *          )
 *        ); $$
 *   );
 *
 * Auth : header `Authorization: Bearer <CRON_SECRET>` requis.
 *
 * Workflow (cf. CLAUDE.md §17 + migration 20260526120000_module_trials) :
 *   1. Charge tous les `module_trials WHERE status='active'`.
 *   2. Pour chaque trial :
 *      - Si <= 5 jours restants & reminder_j_minus_5_sent_at NULL → envoie email J-5
 *      - Si <= 2 jours restants & reminder_j_minus_2_sent_at NULL → envoie email J-2
 *      - Si trial_ends_at <= now() :
 *          * user_decision='cancel' → status='cancelled_before_payment' + email "annulé"
 *          * sinon → conversion en `user_addons` actif, création Stripe subscription
 *                    item si stripe_price_id défini, email "premier prélèvement"
 *
 * Idempotence : flags timestamps évitent double-envoi (reminder_j_minus_*).
 */

// @ts-nocheck — Deno-only Edge Function ; non compilée par tsc Node.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const BATCH_SIZE = 200
const MS_PER_DAY = 86_400_000

interface ModuleTrialRow {
  id: string
  organization_id: string
  user_id: string
  module_id: string
  subscription_id: string
  trial_started_at: string
  trial_ends_at: string
  trial_duration_days: number
  status: string
  reminder_j_minus_5_sent_at: string | null
  reminder_j_minus_2_sent_at: string | null
  user_decision: string | null
}

interface AddonModuleRow {
  id: string
  module_code: string
  display_name: string
  price_monthly_cents: number
  stripe_price_id: string | null
  stripe_product_id: string | null
}

interface ProfileRow {
  id: string
  email: string
  full_name: string | null
}

interface SubscriptionRow {
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

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso))
}

function formatDateShortFr(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

function formatEur(v: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(v)
}

const COLOR_INK = '#0F1E3D'
const COLOR_INK_MUTE = '#4A5878'
const COLOR_BG = '#F8F5EE'
const COLOR_PAPER = '#FDFBF6'
const COLOR_RULE = '#D5CDB8'

function wrapEmail(args: { title: string; bodyHtml: string }): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>${escapeHtml(args.title)}</title></head>
<body style="margin:0;padding:0;background:${COLOR_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLOR_INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR_BG};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:${COLOR_PAPER};border:1px solid ${COLOR_RULE};border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px;border-bottom:1px solid ${COLOR_RULE};">
<p style="margin:0 0 6px 0;font-family:'SFMono-Regular',Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COLOR_INK_MUTE};">KOVAS — Essai module</p>
<h1 style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:${COLOR_INK};">${escapeHtml(args.title)}</h1>
</td></tr>
<tr><td style="padding:24px 32px;">
${args.bodyHtml}
<p style="margin:24px 0 0 0;font-size:14px;color:${COLOR_INK};">— Benjamin / KOVAS</p>
</td></tr>
<tr><td style="padding:20px 32px 24px 32px;border-top:1px solid ${COLOR_RULE};background:${COLOR_BG};">
<p style="margin:0;font-size:11px;color:${COLOR_INK_MUTE};">SASU Nexus 1993 · 66 av. des Champs-Élysées, 75008 Paris · SIREN 982 786 154</p>
</td></tr>
</table>
</td></tr></table></body></html>`
}

function ctaButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;"><tr><td style="background:${COLOR_INK};border-radius:999px;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:${COLOR_BG};text-decoration:none;">${escapeHtml(label)}</a></td></tr></table>`
}

function buildJMinus5Email(args: {
  firstName: string
  moduleName: string
  priceEur: number
  trialEndsAtIso: string
  disableUrl: string
  dashboardUrl: string
}) {
  const html = wrapEmail({
    title: `Plus que 5 jours d'essai sur ${args.moduleName}`,
    bodyHtml: `
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;">Bonjour ${escapeHtml(args.firstName)},</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;">Votre essai gratuit de 14 jours sur le module <strong>${escapeHtml(args.moduleName)}</strong> se termine le <strong>${escapeHtml(formatDateFr(args.trialEndsAtIso))}</strong>.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;">Sans action de votre part, le module sera reconduit automatiquement à <strong>${args.priceEur} € HT/mois</strong>, prélevé sur la carte enregistrée à la souscription de votre forfait KOVAS.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;">Si vous ne souhaitez pas poursuivre, vous pouvez désactiver le module en un clic. Aucune justification ne vous sera demandée.</p>
${ctaButton(`Désactiver ${args.moduleName}`, args.disableUrl)}
<p style="margin:8px 0 0 0;font-size:13px;color:${COLOR_INK_MUTE};">Tableau de bord : <a href="${escapeHtml(args.dashboardUrl)}" style="color:${COLOR_INK_MUTE};">${escapeHtml(args.dashboardUrl)}</a></p>`,
  })
  const text = `Bonjour ${args.firstName},

Votre essai gratuit de 14 jours sur le module ${args.moduleName} se termine le ${formatDateFr(args.trialEndsAtIso)}.

Sans action de votre part, le module sera reconduit automatiquement à ${args.priceEur} € HT/mois, prélevé sur la carte enregistrée à la souscription de votre forfait KOVAS.

Désactiver : ${args.disableUrl}

— Benjamin / KOVAS`
  return { subject: `Plus que 5 jours d'essai sur ${args.moduleName}`, html, text }
}

function buildJMinus2Email(args: {
  firstName: string
  moduleName: string
  priceEur: number
  trialEndsAtIso: string
  disableUrl: string
  dashboardUrl: string
}) {
  const html = wrapEmail({
    title: `Plus que 2 jours d'essai sur ${args.moduleName}`,
    bodyHtml: `
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;">Bonjour ${escapeHtml(args.firstName)},</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;">Petit rappel : votre essai du module <strong>${escapeHtml(args.moduleName)}</strong> se termine dans deux jours, le <strong>${escapeHtml(formatDateFr(args.trialEndsAtIso))}</strong>.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;">Si vous décidez de continuer, le premier prélèvement de <strong>${args.priceEur} € HT</strong> sera effectué automatiquement, sans action de votre part.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;">Si le module ne correspond pas à votre besoin, désactivez-le maintenant pour éviter le prélèvement :</p>
${ctaButton(`Désactiver ${args.moduleName}`, args.disableUrl)}`,
  })
  const text = `Bonjour ${args.firstName},

Petit rappel : votre essai du module ${args.moduleName} se termine dans deux jours, le ${formatDateFr(args.trialEndsAtIso)}.

Premier prélèvement automatique de ${args.priceEur} € HT sans action de votre part.

Désactiver : ${args.disableUrl}

— Benjamin / KOVAS`
  return { subject: `Plus que 2 jours d'essai sur ${args.moduleName}`, html, text }
}

function buildConvertedEmail(args: {
  firstName: string
  moduleName: string
  priceEurHt: number
  priceEurTtc: number
  nextChargeIso: string
  manageUrl: string
}) {
  const html = wrapEmail({
    title: `Premier prélèvement effectué — ${args.moduleName}`,
    bodyHtml: `
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;">Bonjour ${escapeHtml(args.firstName)},</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;">Votre essai gratuit de 14 jours sur le module <strong>${escapeHtml(args.moduleName)}</strong> est terminé. Le module est désormais actif sur votre compte.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;"><tr><td style="padding:14px 16px;border:1px solid ${COLOR_RULE};border-radius:8px;background:#FBF8F0;">
<p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${COLOR_INK_MUTE};">Récapitulatif</p>
<p style="margin:0 0 4px 0;font-size:14px;">Montant HT : <strong>${escapeHtml(formatEur(args.priceEurHt))}</strong></p>
<p style="margin:0 0 4px 0;font-size:14px;">Montant TTC (TVA 20 %) : <strong>${escapeHtml(formatEur(args.priceEurTtc))}</strong></p>
<p style="margin:0;font-size:14px;color:${COLOR_INK_MUTE};">Prochain prélèvement : ${escapeHtml(formatDateShortFr(args.nextChargeIso))}</p>
</td></tr></table>
<p style="margin:0 0 16px 0;font-size:14px;line-height:1.55;">Vous pouvez interrompre l'abonnement à tout moment depuis votre tableau de bord, sans engagement.</p>
${ctaButton('Gérer mon abonnement', args.manageUrl)}`,
  })
  const text = `Bonjour ${args.firstName},

Votre essai gratuit de 14 jours sur le module ${args.moduleName} est terminé. Le module est désormais actif.

Récapitulatif :
- Montant HT : ${formatEur(args.priceEurHt)}
- Montant TTC : ${formatEur(args.priceEurTtc)}
- Prochain prélèvement : ${formatDateShortFr(args.nextChargeIso)}

Gérer : ${args.manageUrl}

— Benjamin / KOVAS`
  return {
    subject: `Premier prélèvement effectué — ${args.moduleName} (${formatEur(args.priceEurHt)} HT)`,
    html,
    text,
  }
}

function buildCancelledEmail(args: {
  firstName: string
  moduleName: string
  cancelledAtIso: string
  dashboardUrl: string
}) {
  const html = wrapEmail({
    title: `Essai annulé — ${args.moduleName}`,
    bodyHtml: `
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;">Bonjour ${escapeHtml(args.firstName)},</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;">C'est confirmé : votre essai du module <strong>${escapeHtml(args.moduleName)}</strong> a été annulé le ${escapeHtml(formatDateShortFr(args.cancelledAtIso))}.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;"><strong>Aucun prélèvement n'a été effectué.</strong> Votre forfait KOVAS reste actif aux mêmes conditions.</p>
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;">Vous pourrez réactiver ce module à tout moment depuis votre tableau de bord, sans nouvelle période d'essai gratuit.</p>
${ctaButton('Retour au tableau de bord', args.dashboardUrl)}`,
  })
  const text = `Bonjour ${args.firstName},

Essai annulé pour le module ${args.moduleName} le ${formatDateShortFr(args.cancelledAtIso)}.
Aucun prélèvement effectué. Votre forfait KOVAS reste actif.

Tableau de bord : ${args.dashboardUrl}

— Benjamin / KOVAS`
  return { subject: `Essai annulé — ${args.moduleName}`, html, text }
}

async function sendEmailViaResend(args: {
  apiKey: string
  from: string
  to: string
  subject: string
  text: string
  html: string
  category: string
}): Promise<{ ok: boolean; id?: string; error?: string }> {
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
    if (!resp.ok) {
      const t = await resp.text().catch(() => '')
      return { ok: false, error: t.slice(0, 400) }
    }
    const data = (await resp.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: data.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network_error' }
  }
}

async function createStripeSubscriptionItem(args: {
  stripeKey: string
  stripeSubscriptionId: string
  stripePriceId: string
}): Promise<{ ok: boolean; itemId?: string; error?: string }> {
  try {
    const form = new URLSearchParams()
    form.append('subscription', args.stripeSubscriptionId)
    form.append('price', args.stripePriceId)
    form.append('proration_behavior', 'create_prorations')
    const resp = await fetch('https://api.stripe.com/v1/subscription_items', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })
    if (!resp.ok) {
      const t = await resp.text().catch(() => '')
      return { ok: false, error: t.slice(0, 400) }
    }
    const data = (await resp.json()) as { id?: string }
    return { ok: true, itemId: data.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'stripe_network_error' }
  }
}

async function processTrial(
  supabase: ReturnType<typeof createClient>,
  env: {
    resendApiKey: string | null
    resendFrom: string
    stripeKey: string | null
    appUrl: string
  },
  trial: ModuleTrialRow,
): Promise<{ action: string; detail?: string }> {
  // 1. Charge module + subscription + profile (recipient)
  const [moduleRes, subRes, profileRes] = await Promise.all([
    supabase
      .from('addon_modules')
      .select('id, module_code, display_name, price_monthly_cents, stripe_price_id, stripe_product_id')
      .eq('id', trial.module_id)
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select('id, stripe_subscription_id, stripe_customer_id')
      .eq('id', trial.subscription_id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', trial.user_id)
      .maybeSingle(),
  ])

  const mod = moduleRes.data as AddonModuleRow | null
  const sub = subRes.data as SubscriptionRow | null
  const profile = profileRes.data as ProfileRow | null
  if (!mod || !sub || !profile) {
    return { action: 'skipped', detail: 'missing_module_or_sub_or_profile' }
  }

  const firstName = (profile.full_name ?? profile.email).split(' ')[0] ?? profile.email
  const priceEur = Math.round(mod.price_monthly_cents / 100)
  const dashboardUrl = `${env.appUrl}/app/account/modules`
  const disableUrl = `${env.appUrl}/app/account/modules?cancel=${trial.id}`
  const now = new Date()
  const ends = new Date(trial.trial_ends_at)
  const msRemaining = ends.getTime() - now.getTime()
  const daysRemaining = msRemaining / MS_PER_DAY

  // Si déjà fini → conversion ou cancel
  if (msRemaining <= 0) {
    if (trial.user_decision === 'cancel') {
      // Cancel : status='cancelled_before_payment' + email
      await supabase
        .from('module_trials')
        .update({
          status: 'cancelled_before_payment',
        })
        .eq('id', trial.id)
      if (env.resendApiKey) {
        const emailContent = buildCancelledEmail({
          firstName,
          moduleName: mod.display_name,
          cancelledAtIso: now.toISOString(),
          dashboardUrl,
        })
        await sendEmailViaResend({
          apiKey: env.resendApiKey,
          from: env.resendFrom,
          to: profile.email,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
          category: 'module_trial_cancelled',
        })
      }
      return { action: 'cancelled' }
    }

    // Conversion : crée user_addons + Stripe item + email "premier prélèvement"
    let stripeItemId: string | null = null
    if (env.stripeKey && sub.stripe_subscription_id && mod.stripe_price_id) {
      const stripeResult = await createStripeSubscriptionItem({
        stripeKey: env.stripeKey,
        stripeSubscriptionId: sub.stripe_subscription_id,
        stripePriceId: mod.stripe_price_id,
      })
      if (stripeResult.ok && stripeResult.itemId) {
        stripeItemId = stripeResult.itemId
      } else {
        console.error('[module-trial-tick] stripe item create failed', stripeResult.error)
      }
    }

    const { data: addonInsert, error: addonError } = await supabase
      .from('user_addons')
      .upsert(
        {
          organization_id: trial.organization_id,
          module_id: trial.module_id,
          subscription_id: trial.subscription_id,
          status: 'active',
          stripe_subscription_item_id: stripeItemId,
        },
        { onConflict: 'organization_id,module_id' },
      )
      .select('id')
      .single()

    if (addonError) {
      return { action: 'error', detail: `addon_upsert: ${addonError.message}` }
    }

    const nextChargeIso = new Date(now.getTime() + 30 * MS_PER_DAY).toISOString()

    await supabase
      .from('module_trials')
      .update({
        status: 'converted_to_paid',
        converted_to_addon_id: addonInsert.id,
        first_payment_at: now.toISOString(),
        first_payment_amount_cents: mod.price_monthly_cents,
      })
      .eq('id', trial.id)

    if (env.resendApiKey) {
      const priceTtc = (mod.price_monthly_cents / 100) * 1.2
      const emailContent = buildConvertedEmail({
        firstName,
        moduleName: mod.display_name,
        priceEurHt: mod.price_monthly_cents / 100,
        priceEurTtc: priceTtc,
        nextChargeIso,
        manageUrl: dashboardUrl,
      })
      await sendEmailViaResend({
        apiKey: env.resendApiKey,
        from: env.resendFrom,
        to: profile.email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
        category: 'module_trial_converted',
      })
    }
    return { action: 'converted' }
  }

  // J-5
  if (daysRemaining <= 5 && trial.reminder_j_minus_5_sent_at === null) {
    if (env.resendApiKey) {
      const emailContent = buildJMinus5Email({
        firstName,
        moduleName: mod.display_name,
        priceEur,
        trialEndsAtIso: trial.trial_ends_at,
        disableUrl,
        dashboardUrl,
      })
      const result = await sendEmailViaResend({
        apiKey: env.resendApiKey,
        from: env.resendFrom,
        to: profile.email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
        category: 'module_trial_j_minus_5',
      })
      if (!result.ok) {
        return { action: 'email_failed', detail: `j-5: ${result.error}` }
      }
    }
    await supabase
      .from('module_trials')
      .update({ reminder_j_minus_5_sent_at: now.toISOString() })
      .eq('id', trial.id)
    return { action: 'reminder_j_minus_5' }
  }

  // J-2
  if (daysRemaining <= 2 && trial.reminder_j_minus_2_sent_at === null) {
    if (env.resendApiKey) {
      const emailContent = buildJMinus2Email({
        firstName,
        moduleName: mod.display_name,
        priceEur,
        trialEndsAtIso: trial.trial_ends_at,
        disableUrl,
        dashboardUrl,
      })
      const result = await sendEmailViaResend({
        apiKey: env.resendApiKey,
        from: env.resendFrom,
        to: profile.email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
        category: 'module_trial_j_minus_2',
      })
      if (!result.ok) {
        return { action: 'email_failed', detail: `j-2: ${result.error}` }
      }
    }
    await supabase
      .from('module_trials')
      .update({ reminder_j_minus_2_sent_at: now.toISOString() })
      .eq('id', trial.id)
    return { action: 'reminder_j_minus_2' }
  }

  return { action: 'noop' }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? null
  const resendFrom = Deno.env.get('RESEND_FROM') ?? 'KOVAS <noreply@kovas.fr>'
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? null
  const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://kovas.fr'

  if (!supabaseUrl || !serviceRole || !cronSecret) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }
  if (req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: rows, error } = await supabase
    .from('module_trials')
    .select(
      'id, organization_id, user_id, module_id, subscription_id, trial_started_at, trial_ends_at, trial_duration_days, status, reminder_j_minus_5_sent_at, reminder_j_minus_2_sent_at, user_decision',
    )
    .eq('status', 'active')
    .order('trial_ends_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    return jsonResponse({ error: 'db_error', detail: error.message }, 500)
  }

  const trials = (rows ?? []) as ModuleTrialRow[]
  const tally: Record<string, number> = {
    reminder_j_minus_5: 0,
    reminder_j_minus_2: 0,
    converted: 0,
    cancelled: 0,
    noop: 0,
    skipped: 0,
    email_failed: 0,
    error: 0,
  }

  for (const trial of trials) {
    try {
      const r = await processTrial(
        supabase,
        { resendApiKey, resendFrom, stripeKey, appUrl },
        trial,
      )
      tally[r.action] = (tally[r.action] ?? 0) + 1
    } catch (err) {
      tally.error += 1
      console.error('[module-trial-tick] trial failed', trial.id, err)
    }
  }

  return jsonResponse({ ok: true, batchSize: trials.length, tally })
})
