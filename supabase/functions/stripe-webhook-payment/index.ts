/**
 * KOVAS — Edge Function : Webhook Stripe (rapports payés + subscriptions V3 dual track).
 *
 * Endpoint POST /functions/v1/stripe-webhook-payment
 *
 * Événements consommés :
 *   - payment_intent.succeeded       (paiement direct via Stripe Elements / Payment Link)
 *   - invoice.payment_succeeded      (Stripe Billing — abonnements + factures one-off)
 *   - checkout.session.completed     (sessions Checkout — relais éventuel)
 *   - customer.subscription.created  (bundle / sponsored slot / addon V3 — INSERT row)
 *   - customer.subscription.updated  (period roll, status change → UPDATE)
 *   - customer.subscription.deleted  (résiliation → set status='cancelled', cancelled_at=now())
 *
 * Workflow rapport payé :
 *   1. Vérifie la signature Stripe (constructEventAsync — runtime Deno).
 *   2. INSERT stripe_webhook_events ON CONFLICT DO NOTHING (idempotence par event.id).
 *      Si conflict → on retourne 200 immédiatement (déjà traité).
 *   3. Si event = payment / checkout : retrouve la `payment_intent_id` et déverrouille
 *      `report_payment_locks` (locked=false, payment_received_at=now()).
 *   4. Trigger emails : confirmation client + notification diagnostiqueur (Resend).
 *
 * Workflow subscriptions V3 :
 *   - customer.subscription.created avec metadata.bundle_code        → INSERT bundle_subscriptions
 *   - customer.subscription.created avec metadata.sponsored_slot_id  → INSERT sponsored_slot_subscriptions
 *   - customer.subscription.updated                                  → UPDATE current_period_end, status
 *   - customer.subscription.deleted                                  → UPDATE status='cancelled', cancelled_at=now()
 *
 * Idempotence : PRIMARY KEY de stripe_webhook_events = event.id Stripe. Une seconde
 * réception du même event est silencieusement ignorée. Pas de double-déverrouillage.
 *
 * Erreurs : on retourne 500 → Stripe rejoue jusqu'à 3 jours (back-off exponentiel).
 *
 * Authority : CLAUDE.md §8 stack Stripe + migration 20260525140000_report_payment_locks
 * + docs/pricing/v3-dual-track-spec.md (bundles + sponsored slots).
 */

// @ts-nocheck — Deno-only Edge Function ; non compilée par tsc Node.

import Stripe from 'npm:stripe@17.5.0'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const STRIPE_API_VERSION = '2024-12-18.acacia'

interface PaymentLockRow {
  id: string
  mission_id: string
  organization_id: string
  user_id: string | null
  amount_due: number | null
  locked: boolean
  payment_received_at: string | null
}

interface MissionContext {
  id: string
  reference: string | null
  organization_id: string
  client_email: string | null
  client_first_name: string | null
  user_id: string | null
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function sendResendEmail(args: {
  apiKey: string
  from: string
  to: string
  subject: string
  text: string
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
        tags: [{ name: 'category', value: args.category }],
      }),
    })
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '')
      return { ok: false, error: txt.slice(0, 400) }
    }
    const data = (await resp.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: data.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network_error' }
  }
}

// ────────────────────────────────────────────────────────────
// Déverrouillage rapport payé
// ────────────────────────────────────────────────────────────

async function unlockReportForPaymentIntent(
  supabase: ReturnType<typeof createClient>,
  resendApiKey: string | null,
  resendFrom: string,
  paymentIntentId: string,
  eventType: string,
): Promise<{ unlocked: boolean; missionId?: string; reason?: string }> {
  const { data: lock, error: lockErr } = await supabase
    .from('report_payment_locks')
    .select('id, mission_id, organization_id, user_id, amount_due, locked, payment_received_at')
    .eq('payment_intent_id', paymentIntentId)
    .maybeSingle()

  if (lockErr) {
    console.error('[stripe-webhook-payment] select lock failed', lockErr)
    throw new Error(`db_error: ${lockErr.message}`)
  }
  if (!lock) {
    return { unlocked: false, reason: 'no_lock_for_payment_intent' }
  }

  const lockRow = lock as PaymentLockRow

  // Idempotence applicative : si déjà déverrouillé, no-op.
  if (lockRow.locked === false && lockRow.payment_received_at !== null) {
    return { unlocked: false, missionId: lockRow.mission_id, reason: 'already_unlocked' }
  }

  const { error: updErr } = await supabase
    .from('report_payment_locks')
    .update({
      locked: false,
      payment_received_at: new Date().toISOString(),
      payment_provider: 'stripe',
    })
    .eq('id', lockRow.id)
  if (updErr) {
    throw new Error(`failed to unlock report: ${updErr.message}`)
  }

  // Charge contexte mission pour les emails
  const { data: missionRow } = await supabase
    .from('missions')
    .select('id, reference, organization_id, user_id')
    .eq('id', lockRow.mission_id)
    .maybeSingle()
  const mission = (missionRow ?? null) as
    | (Omit<MissionContext, 'client_email' | 'client_first_name'> & {
        client_email?: never
        client_first_name?: never
      })
    | null

  // Charge le diagnostiqueur (profile)
  let diagEmail: string | null = null
  let diagName: string | null = null
  if (lockRow.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', lockRow.user_id)
      .maybeSingle()
    diagEmail = (profile as { email?: string | null } | null)?.email ?? null
    diagName = (profile as { full_name?: string | null } | null)?.full_name ?? null
  }

  // Charge le client de la mission (best effort — schema peut varier)
  let clientEmail: string | null = null
  let clientFirstName: string | null = null
  if (mission?.id) {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('email, first_name, last_name')
      .eq('mission_id', mission.id)
      .maybeSingle()
    clientEmail = (clientRow as { email?: string | null } | null)?.email ?? null
    clientFirstName = (clientRow as { first_name?: string | null } | null)?.first_name ?? null
  }

  // Trigger emails (best effort — n'échoue jamais le webhook)
  if (resendApiKey) {
    const ref = mission?.reference ?? lockRow.mission_id.slice(0, 8)
    if (clientEmail) {
      const greeting = clientFirstName ? `Bonjour ${clientFirstName},` : 'Bonjour,'
      const text = `${greeting}

Nous avons bien reçu votre paiement pour le diagnostic immobilier ${ref}.
Votre rapport complet est désormais accessible.

Vous le retrouverez en pièce jointe d'un prochain message, ou sur votre espace client KOVAS.

Cordialement,
— Benjamin
KOVAS
`
      await sendResendEmail({
        apiKey: resendApiKey,
        from: resendFrom,
        to: clientEmail,
        subject: `Paiement reçu — diagnostic ${ref}`,
        text,
        category: 'payment_unlock_client',
      })
      // TODO : sendReportEmail(missionId) — pièce jointe PDF complet (template pas encore prêt).
    }
    if (diagEmail) {
      const dName = diagName ?? 'cher diagnostiqueur'
      const text = `Bonjour ${dName},

Le paiement du diagnostic ${ref} vient d'être reçu (${lockRow.amount_due ?? 'n/d'} €).
Le rapport est automatiquement déverrouillé.

Source : Stripe — événement ${eventType}.

— KOVAS
`
      await sendResendEmail({
        apiKey: resendApiKey,
        from: resendFrom,
        to: diagEmail,
        subject: `Paiement reçu — ${ref}`,
        text,
        category: 'payment_unlock_diagnostician',
      })
    }
  }

  return { unlocked: true, missionId: lockRow.mission_id }
}

// ────────────────────────────────────────────────────────────
// Extraction du payment_intent.id selon le type d'event
// ────────────────────────────────────────────────────────────

function extractPaymentIntentId(event: Stripe.Event): string | null {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent
      return pi.id ?? null
    }
    case 'invoice.payment_succeeded': {
      const inv = event.data.object as Stripe.Invoice
      const pi = inv.payment_intent
      return typeof pi === 'string' ? pi : (pi?.id ?? null)
    }
    case 'checkout.session.completed': {
      const sess = event.data.object as Stripe.Checkout.Session
      const pi = sess.payment_intent
      return typeof pi === 'string' ? pi : (pi?.id ?? null)
    }
    default:
      return null
  }
}

// ────────────────────────────────────────────────────────────
// Subscriptions V3 — bundles + sponsored slots
// ────────────────────────────────────────────────────────────

function isoFromUnix(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null
  return new Date(seconds * 1000).toISOString()
}

interface SubscriptionPeriod {
  current_period_start: string | null
  current_period_end: string | null
}

function extractSubscriptionPeriod(sub: Stripe.Subscription): SubscriptionPeriod {
  // Stripe API 2024-12-18+ : current_period_* déplacés sur subscription.items.data[0]
  const item = sub.items?.data?.[0]
  // @ts-ignore — Deno + types Stripe peuvent diverger selon la version SDK
  const startUnix = (item?.current_period_start ?? sub.current_period_start) as number | undefined
  // @ts-ignore
  const endUnix = (item?.current_period_end ?? sub.current_period_end) as number | undefined
  return {
    current_period_start: isoFromUnix(startUnix),
    current_period_end: isoFromUnix(endUnix),
  }
}

async function handleBundleSubscriptionCreated(
  supabase: ReturnType<typeof createClient>,
  sub: Stripe.Subscription,
  bundleCode: string,
  orgId: string,
): Promise<void> {
  const period = extractSubscriptionPeriod(sub)
  const payload = {
    organization_id: orgId,
    bundle_code: bundleCode,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    status: sub.status,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    current_period_start: period.current_period_start,
    current_period_end: period.current_period_end,
    cancelled_at: null as string | null,
    billing_cycle: sub.metadata?.billing_cycle ?? null,
  }
  const { error } = await supabase
    .from('bundle_subscriptions')
    .upsert(payload, { onConflict: 'stripe_subscription_id' })
  if (error) {
    throw new Error(`bundle_subscriptions_insert_failed: ${error.message}`)
  }
}

async function handleSponsoredSlotSubscriptionCreated(
  supabase: ReturnType<typeof createClient>,
  sub: Stripe.Subscription,
  sponsoredSlotId: string,
  orgId: string,
): Promise<void> {
  const period = extractSubscriptionPeriod(sub)
  const payload = {
    organization_id: orgId,
    sponsored_slot_id: sponsoredSlotId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    status: sub.status,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    current_period_start: period.current_period_start,
    current_period_end: period.current_period_end,
    cancelled_at: null as string | null,
    billing_cycle: sub.metadata?.billing_cycle ?? null,
  }
  const { error } = await supabase
    .from('sponsored_slot_subscriptions')
    .upsert(payload, { onConflict: 'stripe_subscription_id' })
  if (error) {
    throw new Error(`sponsored_slot_subscriptions_insert_failed: ${error.message}`)
  }
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  sub: Stripe.Subscription,
): Promise<{ updated: number }> {
  const period = extractSubscriptionPeriod(sub)
  const patch = {
    status: sub.status,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    current_period_start: period.current_period_start,
    current_period_end: period.current_period_end,
  }
  let updated = 0
  // Tente d'abord bundle_subscriptions
  const bundleRes = await supabase
    .from('bundle_subscriptions')
    .update(patch)
    .eq('stripe_subscription_id', sub.id)
    .select('id')
  if (!bundleRes.error && Array.isArray(bundleRes.data)) {
    updated += bundleRes.data.length
  }
  // Puis sponsored_slot_subscriptions
  const slotRes = await supabase
    .from('sponsored_slot_subscriptions')
    .update(patch)
    .eq('stripe_subscription_id', sub.id)
    .select('id')
  if (!slotRes.error && Array.isArray(slotRes.data)) {
    updated += slotRes.data.length
  }
  // Et table subscriptions (logiciel / annuaire plans simples)
  const subsRes = await supabase
    .from('subscriptions')
    .update(patch)
    .eq('stripe_subscription_id', sub.id)
    .select('id')
  if (!subsRes.error && Array.isArray(subsRes.data)) {
    updated += subsRes.data.length
  }
  return { updated }
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  sub: Stripe.Subscription,
): Promise<{ cancelled: number }> {
  const patch = {
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    cancel_at_period_end: false,
  }
  let cancelled = 0
  const bundleRes = await supabase
    .from('bundle_subscriptions')
    .update(patch)
    .eq('stripe_subscription_id', sub.id)
    .select('id')
  if (!bundleRes.error && Array.isArray(bundleRes.data)) {
    cancelled += bundleRes.data.length
  }
  const slotRes = await supabase
    .from('sponsored_slot_subscriptions')
    .update(patch)
    .eq('stripe_subscription_id', sub.id)
    .select('id')
  if (!slotRes.error && Array.isArray(slotRes.data)) {
    cancelled += slotRes.data.length
  }
  const subsRes = await supabase
    .from('subscriptions')
    .update(patch)
    .eq('stripe_subscription_id', sub.id)
    .select('id')
  if (!subsRes.error && Array.isArray(subsRes.data)) {
    cancelled += subsRes.data.length
  }
  return { cancelled }
}

async function handleSubscriptionEvent(
  supabase: ReturnType<typeof createClient>,
  event: Stripe.Event,
): Promise<Record<string, unknown>> {
  const sub = event.data.object as Stripe.Subscription
  const orgId = (sub.metadata?.organization_id ?? null) as string | null
  const bundleCode = (sub.metadata?.bundle_code ?? null) as string | null
  const sponsoredSlotId = (sub.metadata?.sponsored_slot_id ?? null) as string | null

  if (event.type === 'customer.subscription.created') {
    if (!orgId) {
      return { ignored: true, reason: 'missing_organization_id_in_metadata' }
    }
    const out: Record<string, unknown> = { subscriptionId: sub.id }
    if (bundleCode) {
      await handleBundleSubscriptionCreated(supabase, sub, bundleCode, orgId)
      out.bundle_code = bundleCode
    }
    if (sponsoredSlotId) {
      await handleSponsoredSlotSubscriptionCreated(supabase, sub, sponsoredSlotId, orgId)
      out.sponsored_slot_id = sponsoredSlotId
    }
    if (!bundleCode && !sponsoredSlotId) {
      // Plan logiciel/annuaire simple — la route Stripe webhook back-end Next.js
      // (apps/web/.../api/billing/webhook) prend déjà le relais via la table
      // `subscriptions`. Pas de double traitement ici.
      return { ignored: true, reason: 'plain_subscription_handled_by_app_webhook' }
    }
    return out
  }

  if (event.type === 'customer.subscription.updated') {
    return await handleSubscriptionUpdated(supabase, sub)
  }

  if (event.type === 'customer.subscription.deleted') {
    return await handleSubscriptionDeleted(supabase, sub)
  }

  return { ignored: true, reason: 'unhandled_subscription_event' }
}

// ────────────────────────────────────────────────────────────
// Entry point
// ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? null
  const resendFrom = Deno.env.get('RESEND_FROM') ?? 'KOVAS <contact@kovas.fr>'

  if (!supabaseUrl || !serviceRole || !stripeKey || !stripeWebhookSecret) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
  })

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return jsonResponse({ error: 'missing_signature' }, 400)
  }

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      stripeWebhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'signature_error'
    return jsonResponse({ error: 'invalid_signature', detail: msg }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ── Idempotence : INSERT du event.id ; si conflict, on a déjà traité.
  const eventPayloadSummary: Record<string, unknown> = { type: event.type }
  const piIdMaybe = extractPaymentIntentId(event)
  if (piIdMaybe) eventPayloadSummary.payment_intent_id = piIdMaybe

  const { error: insertErr } = await supabase.from('stripe_webhook_events').insert({
    id: event.id,
    event_type: event.type,
    livemode: event.livemode === true,
    payload_summary: eventPayloadSummary,
    processing_result: 'ok', // sera mis à jour si erreur
  })

  if (insertErr) {
    // Probablement un duplicate (PRIMARY KEY violation) — déjà traité, on retourne 200.
    if (insertErr.code === '23505') {
      return jsonResponse({ ok: true, idempotent: true, eventId: event.id })
    }
    console.error('[stripe-webhook-payment] insert event failed', insertErr)
    return jsonResponse({ error: 'db_error', detail: insertErr.message }, 500)
  }

  // ── Traitement par type
  try {
    const subscriptionEventTypes = new Set<string>([
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ])
    const paymentEventTypes = new Set<string>([
      'payment_intent.succeeded',
      'invoice.payment_succeeded',
      'checkout.session.completed',
    ])

    // ── Branche 1 : subscription V3 (bundles, sponsored slots, plans simples)
    if (subscriptionEventTypes.has(event.type)) {
      const result = await handleSubscriptionEvent(supabase, event)
      return jsonResponse({
        ok: true,
        eventId: event.id,
        type: event.type,
        result,
      })
    }

    // ── Branche 2 : déverrouillage rapport payé (logique historique, intacte)
    if (!paymentEventTypes.has(event.type)) {
      // Type non géré — on log "ignored" mais on a déjà inséré 'ok'. Update.
      await supabase
        .from('stripe_webhook_events')
        .update({ processing_result: 'ignored' })
        .eq('id', event.id)
      return jsonResponse({ ok: true, ignored: true, type: event.type })
    }

    const paymentIntentId = extractPaymentIntentId(event)
    if (!paymentIntentId) {
      await supabase
        .from('stripe_webhook_events')
        .update({
          processing_result: 'ignored',
          error_message: 'no_payment_intent_id',
        })
        .eq('id', event.id)
      return jsonResponse({ ok: true, ignored: true, reason: 'no_payment_intent_id' })
    }

    const result = await unlockReportForPaymentIntent(
      supabase,
      resendApiKey,
      resendFrom,
      paymentIntentId,
      event.type,
    )

    return jsonResponse({
      ok: true,
      eventId: event.id,
      type: event.type,
      paymentIntentId,
      result,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error'
    await supabase
      .from('stripe_webhook_events')
      .update({
        processing_result: 'error',
        error_message: msg.slice(0, 1000),
      })
      .eq('id', event.id)
    // 500 → Stripe rejouera.
    return jsonResponse({ error: 'processing_failed', detail: msg }, 500)
  }
})
