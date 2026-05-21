import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { isStripeConfigured } from '@/lib/stripe'
import { getInvoicesForOrganization } from '@/lib/stripe/invoices'

/**
 * GET /api/billing/invoices
 *
 * Retourne la liste des factures Stripe de l'organisation courante.
 * Sécurité : `getCurrentUser()` vérifie session + org membership via la
 * default_org_id du profil (et RLS Supabase sur subscriptions verrouille
 * l'accès au stripe_customer_id de toute façon).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Stripe not configured', stub: true, invoices: [] },
      { status: 503 },
    )
  }

  const { orgId, supabase } = await getCurrentUser()

  try {
    const invoices = await getInvoicesForOrganization(orgId, supabase)
    if (invoices === null) {
      // Pas de customer Stripe associé à l'org — réponse vide (pas une erreur).
      return NextResponse.json({ invoices: [], hasCustomer: false })
    }
    return NextResponse.json({ invoices, hasCustomer: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch invoices from Stripe', detail: message },
      { status: 502 },
    )
  }
}
