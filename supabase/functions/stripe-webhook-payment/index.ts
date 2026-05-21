/**
 * KOVAS — Edge Function : Webhook Stripe pour déverrouillage des rapports payés.
 *
 * Endpoint POST /functions/v1/stripe-webhook-payment
 *
 * Événements consommés :
 *   - payment_intent.succeeded       (paiement direct via Stripe Elements / Payment Link)
 *   - invoice.payment_succeeded      (Stripe Billing — abonnements + factures one-off)
 *   - checkout.session.completed     (sessions Checkout — relais éventuel)
 *
 * Workflow par event :
 *   1. Vérifie la signature Stripe (constructEventAsync — runtime Deno).
 *   2. INSERT stripe_webhook_events ON CONFLICT DO NOTHING (idempotence par event.id).
 *      Si conflict → on retourne 200 immédiatement (déjà traité).
 *   3. Selon le type d'event, retrouve la `payment_intent_id` et déverrouille
 *      `report_payment_locks` (locked=false, payment_received_at=now()).
 *   4. Trigger emails : confirmation client + notification diagnostiqueur (Resend).
 *
 * Idempotence : PRIMARY KEY de stripe_webhook_events = event.id Stripe. Une seconde
 * réception du même event est silencieusement ignorée. Pas de double-déverrouillage.
 *
 * Erreurs : on retourne 500 → Stripe rejoue jusqu'à 3 jours (back-off exponentiel).
 *
 * Authority : CLAUDE.md §8 stack Stripe + migration 20260525140000_report_payment_locks.
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
    clientFirstName =
      (clientRow as { first_name?: string | null } | null)?.first_name ?? null
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
      return typeof pi === 'string' ? pi : pi?.id ?? null
    }
    case 'checkout.session.completed': {
      const sess = event.data.object as Stripe.Checkout.Session
      const pi = sess.payment_intent
      return typeof pi === 'string' ? pi : pi?.id ?? null
    }
    default:
      return null
  }
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
  const resendFrom = Deno.env.get('RESEND_FROM') ?? 'KOVAS <noreply@kovas.fr>'

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
    if (
      event.type !== 'payment_intent.succeeded' &&
      event.type !== 'invoice.payment_succeeded' &&
      event.type !== 'checkout.session.completed'
    ) {
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
