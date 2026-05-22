import type Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '@kovas/database/types'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { getTier } from '@/lib/stripe-config'
import {
  sendTrialEndingReminder,
  sendTrialConvertedReceipt,
  sendPaymentFailedNotice,
  sendSubscriptionCanceledNotice,
} from '@/lib/email/billing'

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

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

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
            : session.subscription?.id ?? null

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

        await admin.from('subscriptions').upsert(
          {
            organization_id: orgId,
            stripe_customer_id:
              typeof session.customer === 'string'
                ? session.customer
                : session.customer?.id ?? null,
            stripe_subscription_id: stripeSubId,
            status,
            tier: tier.id,
            missions_included: tier.missionsIncluded,
            overage_price_cents: tier.overagePriceCents,
            trial_started_at: trialStart,
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
            trial_started_at: sub.trial_start
              ? new Date(sub.trial_start * 1000).toISOString()
              : null,
            trial_ends_at: sub.trial_end
              ? new Date(sub.trial_end * 1000).toISOString()
              : null,
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
