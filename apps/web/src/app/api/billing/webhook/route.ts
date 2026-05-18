import type Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '@kovas/database/types'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { getTier } from '@/lib/stripe-config'

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

        await admin
          .from('subscriptions')
          .upsert(
            {
              organization_id: orgId,
              stripe_customer_id:
                typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
              stripe_subscription_id:
                typeof session.subscription === 'string'
                  ? session.subscription
                  : session.subscription?.id ?? null,
              status: 'active',
              tier: tier.id,
              missions_included: tier.missionsIncluded,
              overage_price_cents: tier.overagePriceCents,
            },
            { onConflict: 'organization_id' },
          )

        // Mark trial as converted
        await admin
          .from('cabinet_trials')
          .update({ converted_to_paid: true, trial_ended_at: new Date().toISOString() })
          .eq('organization_id', orgId)
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created':
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const orgId = sub.metadata?.organization_id
        if (!orgId) break
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
          })
          .eq('organization_id', orgId)
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
