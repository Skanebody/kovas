import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { getStripePriceId, getTier } from '@/lib/stripe-config'

/**
 * Crée une session Stripe Checkout pour s'abonner à un tier KOVAS.
 * Body: { tier: 'discovery' | 'standard' | 'volume', cycle: 'monthly' | 'annual' }
 *
 * Si STRIPE_SECRET_KEY absent : retourne { stub: true } pour indiquer dev mode.
 */
export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: 'Stripe not configured',
        stub: true,
        message: 'Configurez STRIPE_SECRET_KEY + STRIPE_PRICE_* dans .env.local',
      },
      { status: 503 },
    )
  }

  const { user, orgId, supabase } = await getCurrentUser()
  const body = await request.json().catch(() => null)
  const tierId = body?.tier as string | undefined
  const cycle = (body?.cycle as 'monthly' | 'annual' | undefined) ?? 'monthly'

  const tier = tierId ? getTier(tierId) : null
  if (!tier) {
    return NextResponse.json({ error: 'tier invalid' }, { status: 400 })
  }
  const priceId = getStripePriceId(tier.id, cycle)
  if (!priceId) {
    return NextResponse.json(
      { error: `STRIPE_PRICE_${tier.id.toUpperCase()}_${cycle.toUpperCase()} not configured` },
      { status: 503 },
    )
  }

  const stripe = getStripe()

  // Récupère ou crée le customer Stripe pour cette org
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('organization_id', orgId)
    .maybeSingle()

  let customerId = existing?.stripe_customer_id ?? null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { organization_id: orgId, user_id: user.id },
    })
    customerId = customer.id
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${origin}/app/billing?success=1`,
    cancel_url: `${origin}/app/billing?canceled=1`,
    automatic_tax: { enabled: true },
    metadata: { organization_id: orgId, tier: tier.id, cycle },
    subscription_data: {
      metadata: { organization_id: orgId, tier: tier.id },
    },
  })

  return NextResponse.json({ url: session.url })
}
