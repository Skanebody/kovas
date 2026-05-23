import {
  sendPaymentFailedNotice,
  sendSubscriptionCanceledNotice,
  sendTrialConvertedReceipt,
  sendTrialEndingReminder,
} from '@/lib/email/billing'
import { onFirstInvoicePaid } from '@/lib/referral/referral-engine'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { getTier } from '@/lib/stripe-config'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

/**
 * Webhook Stripe : sync les états subscription/customer dans `subscriptions`.
 * Cf. https://stripe.com/docs/webhooks/signatures
 */
export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const sig = request.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'no signature' }, { status: 400 })

  const body = await request.text()
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'invalid signature' },
      { status: 400 },
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ ok: false, error: 'supabase_admin_not_configured' }, { status: 503 })
  }
  const admin = createAdminClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const orgId = session.metadata?.organization_id
        const tierId = session.metadata?.tier
        if (!orgId || !tierId) break
        const tier = getTier(tierId)
        if (!tier) break

        // À la complétion du Checkout, la subscription Stripe est en `trialing` pendant 30j.
        // Le statut DB suit Stripe — pas `active` immédiat.
        const stripeSubId =
          typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription?.id ?? null)

        let trialStart: string | null = null
        let trialEnd: string | null = null
        let status = 'trialing'
        if (stripeSubId) {
          const fullSub = await stripe.subscriptions.retrieve(stripeSubId)
          status = fullSub.status
          if (fullSub.trial_start) {
            trialStart = new Date(fullSub.trial_start * 1000).toISOString()
          }
          if (fullSub.trial_end) {
            trialEnd = new Date(fullSub.trial_end * 1000).toISOString()
          }
        }

        // Note: `subscriptions.trial_started_at` existe en DB mais n'est pas encore
        // exposé dans les types régénérés. On stocke uniquement `trial_ends_at`
        // (suffisant car `is_in_trial` est une colonne générée basée dessus).
        // Le webhook `customer.subscription.created` ré-écrira ces champs si besoin.
        await admin.from('subscriptions').upsert(
          {
            organization_id: orgId,
            stripe_customer_id:
              typeof session.customer === 'string'
                ? session.customer
                : (session.customer?.id ?? null),
            stripe_subscription_id: stripeSubId,
            status,
            tier: tier.id,
            missions_included: tier.missionsIncluded,
            overage_price_cents: tier.overagePriceCents,
            trial_ends_at: trialEnd,
          },
          { onConflict: 'organization_id' },
        )

        // Mark cabinet_trials as registered (converted_to_paid sera coché au 1er débit).
        await admin
          .from('cabinet_trials')
          .update({ trial_started_at: trialStart ?? new Date().toISOString() })
          .eq('organization_id', orgId)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object
        const orgId = sub.metadata?.organization_id
        if (!orgId) break
        const wasTrialing = await admin
          .from('subscriptions')
          .select('status')
          .eq('organization_id', orgId)
          .maybeSingle()
        const prevStatus = wasTrialing.data?.status

        // Cf. note sur trial_started_at dans `checkout.session.completed` ci-dessus.
        await admin
          .from('subscriptions')
          .update({
            status: sub.status,
            cancel_at_period_end: sub.cancel_at_period_end ?? false,
            current_period_start: sub.items?.data[0]?.current_period_start
              ? new Date(sub.items.data[0].current_period_start * 1000).toISOString()
              : null,
            current_period_end: sub.items?.data[0]?.current_period_end
              ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
              : null,
            trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          })
          .eq('organization_id', orgId)

        // Transition trialing → active = 1er débit réussi.
        // Envoi facture + marque cabinet_trials.converted_to_paid = true.
        if (
          event.type === 'customer.subscription.updated' &&
          prevStatus === 'trialing' &&
          sub.status === 'active'
        ) {
          await admin
            .from('cabinet_trials')
            .update({
              converted_to_paid: true,
              trial_ended_at: new Date().toISOString(),
            })
            .eq('organization_id', orgId)

          await sendTrialConvertedReceipt({ admin, orgId, subscription: sub })
        }
        break
      }

      case 'customer.subscription.trial_will_end': {
        // Stripe émet cet event ~3 jours avant la fin du trial.
        const sub = event.data.object
        const orgId = sub.metadata?.organization_id
        if (!orgId) break
        await sendTrialEndingReminder({ admin, orgId, subscription: sub })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const orgId = sub.metadata?.organization_id
        if (!orgId) break
        await admin
          .from('subscriptions')
          .update({
            status: sub.status,
            cancel_at_period_end: sub.cancel_at_period_end ?? false,
          })
          .eq('organization_id', orgId)
        // Soft-archive : la suppression effective est gérée par un cron 3 mois plus tard.
        await sendSubscriptionCanceledNotice({ admin, orgId })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const customer =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (!customer) break
        const { data: sub } = await admin
          .from('subscriptions')
          .select('organization_id')
          .eq('stripe_customer_id', customer)
          .maybeSingle()
        if (!sub?.organization_id) break
        await sendPaymentFailedNotice({ admin, orgId: sub.organization_id, invoice })
        break
      }

      case 'invoice.payment_succeeded': {
        // Programme parrainage : récompenser le parrain à la 1re facture payée
        // (post trial). Idempotent via `onFirstInvoicePaid`.
        const invoice = event.data.object
        let orgId = invoice.metadata?.organization_id ?? null

        // Fallback : retrouver l'orgId via la subscription liée à la facture.
        // Le SDK Stripe v22+ référence la subscription via plusieurs chemins
        // selon le contexte de l'invoice — on tente prudemment.
        const subRef =
          (invoice as unknown as { subscription?: string | { id: string } | null }).subscription ??
          null
        if (!orgId && subRef) {
          const subId = typeof subRef === 'string' ? subRef : subRef.id
          try {
            const sub = await stripe.subscriptions.retrieve(subId)
            orgId = sub.metadata?.organization_id ?? null
          } catch {
            // Sub introuvable — on ignore
          }
        }

        if (!orgId) break

        // Récupère un user de l'organisation (owner) pour matcher la referral.referred_id
        const { data: membership } = await admin
          .from('memberships')
          .select('user_id')
          .eq('organization_id', orgId)
          .eq('role', 'owner')
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()

        const ownerUserId = membership?.user_id
        if (!ownerUserId) break

        try {
          await onFirstInvoicePaid({ supabase: admin, paidUserId: ownerUserId })
        } catch (refErr) {
          console.warn('referral reward failed:', refErr)
        }
        break
      }

      default:
        // ignored events
        break
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'webhook handler failed' },
      { status: 500 },
    )
  }

  return NextResponse.json({ received: true })
}
