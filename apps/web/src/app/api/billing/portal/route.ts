import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getStripe, isStripeConfigured } from '@/lib/stripe'

/**
 * Redirige vers le Stripe Customer Portal (gestion abonnement self-service).
 */
export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe not configured', stub: true }, { status: 503 })
  }

  const { orgId, supabase } = await getCurrentUser()
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'no customer' }, { status: 404 })
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const portal = await getStripe().billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/dashboard/account`,
  })

  return NextResponse.json({ url: portal.url })
}
