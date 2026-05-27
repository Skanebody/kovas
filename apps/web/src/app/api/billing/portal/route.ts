import { getCurrentUser } from '@/lib/auth/current-user'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { NextResponse } from 'next/server'

/**
 * Redirige vers le Stripe Customer Portal (gestion abonnement self-service).
 *
 * Comportement :
 * - Si appel JSON / fetch → renvoie { url } (le client fait `location.href`).
 * - Si appel form natif (`<form method="POST">`) → renvoie un 303 redirect direct
 *   vers le portail Stripe. C'est ce qu'attend le formulaire de la page Mon compte.
 *
 * Détection : on regarde l'header `Accept`. Si `text/html` on redirige, sinon JSON.
 */
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const wantsHtml = request.headers.get('accept')?.includes('text/html') ?? false

  if (!isStripeConfigured()) {
    if (wantsHtml) return NextResponse.redirect(new URL('/app/account?stripe=stub', request.url))
    return NextResponse.json({ error: 'Stripe not configured', stub: true }, { status: 503 })
  }

  const { orgId, supabase } = await getCurrentUser()
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!sub?.stripe_customer_id) {
    if (wantsHtml) return NextResponse.redirect(new URL('/app/account?nocustomer=1', request.url))
    return NextResponse.json({ error: 'no customer' }, { status: 404 })
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const portal = await getStripe().billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/dashboard/account`,
  })

  if (wantsHtml) return NextResponse.redirect(portal.url, { status: 303 })
  return NextResponse.json({ url: portal.url })
}
