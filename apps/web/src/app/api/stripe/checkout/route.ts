/**
 * KOVAS — Endpoint Stripe Checkout V3 (Pricing dual track)
 *
 * Crée une session Stripe Checkout pour souscrire à :
 *   - un plan Annuaire (3 tiers payants)                  → ?plan=annuaire_pro
 *   - un plan Logiciel KOVAS 360 (4 tiers payants)        → ?plan=logiciel_active
 *   - un Bundle (5 combos avec économies)                 → ?bundle=bundle_active_pro
 *   - un slot sponsorisé (réservé annuaire_sponsored)     → ?plan=annuaire_sponsored&slot=slot_metropole
 *   - un add-on indépendant (4 modules)                   → ?plan=addon_signatures_eidas
 *
 * Cycle obligatoire : ?cycle=monthly | annual (défaut: monthly).
 *
 * Comportements :
 *   - Utilisateur non authentifié      → redirect 302 vers /signup?return_to=/pricing
 *   - Stripe non configuré             → HTTP 503 { stub: true }
 *   - plan_code / bundle inconnu       → HTTP 400 { error: 'unknown_plan_code' }
 *   - Price ID env var manquant        → HTTP 503 { error: 'stripe_price_not_configured' }
 *
 * Body : aucun (lecture stricte des query params, GET-friendly et POST-friendly).
 *
 * Source de vérité produit : `docs/pricing/v3-dual-track-spec.md`.
 * Source de vérité code     : `apps/web/src/lib/pricing/stripe-products.ts`.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import {
  getStripePriceId,
  type BillingCycle,
  type StripeProductType,
} from '@/lib/pricing/stripe-products'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────
// Helpers de classification des codes V3
// ─────────────────────────────────────────────

function classifyProductCode(code: string): StripeProductType | null {
  if (code.startsWith('annuaire_')) return 'annuaire'
  if (code.startsWith('logiciel_')) return 'logiciel'
  if (code.startsWith('bundle_')) return 'bundle'
  if (code.startsWith('slot_')) return 'sponsored_slot'
  if (code.startsWith('addon_')) return 'addon'
  return null
}

function normalizeCycle(raw: string | null | undefined): BillingCycle {
  return raw === 'annual' ? 'annual' : 'monthly'
}

interface CheckoutQuery {
  plan: string | null
  bundle: string | null
  slot: string | null
  cycle: BillingCycle
}

function readQuery(request: Request): CheckoutQuery {
  const url = new URL(request.url)
  const plan = url.searchParams.get('plan')
  const bundle = url.searchParams.get('bundle')
  const slot = url.searchParams.get('slot')
  const cycle = normalizeCycle(url.searchParams.get('cycle'))
  return { plan, bundle, slot, cycle }
}

// ─────────────────────────────────────────────
// Handlers GET + POST (identiques — lecture via query params)
// ─────────────────────────────────────────────

async function handleCheckout(request: Request): Promise<Response> {
  // 1. Stripe configuré ?
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: 'stripe_not_configured',
        stub: true,
        message: 'Configurez STRIPE_SECRET_KEY + STRIPE_PRICE_* dans .env.local',
      },
      { status: 503 },
    )
  }

  // 2. Lecture des query params
  const { plan, bundle, slot, cycle } = readQuery(request)

  if (!plan && !bundle) {
    return NextResponse.json(
      { error: 'missing_plan_or_bundle', message: 'Paramètre ?plan=<code> ou ?bundle=<code> requis' },
      { status: 400 },
    )
  }

  // 3. Authentification — redirect /signup si invité
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const returnTo = encodeURIComponent('/pricing')
    return NextResponse.redirect(new URL(`/signup?return_to=${returnTo}`, request.url), 302)
  }

  // Charge profil + org
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, default_org_id')
    .eq('id', user.id)
    .single()

  const orgId = profile?.default_org_id ?? null
  if (!orgId) {
    return NextResponse.json(
      { error: 'no_organization', message: 'Utilisateur sans organisation. Complétez l’onboarding.' },
      { status: 409 },
    )
  }

  const userEmail = profile?.email ?? user.email ?? null

  // 4. Construction des line_items
  const stripe = getStripe()
  const lineItems: Array<{ price: string; quantity: number }> = []
  const metadata: Record<string, string> = {
    organization_id: orgId,
    user_id: user.id,
    billing_cycle: cycle,
  }

  // Cas 1 — Bundle (line_item principal = bundle ; slot optionnel possible en sus)
  if (bundle) {
    const bundlePriceId = getStripePriceId('bundle', bundle, cycle)
    if (!bundlePriceId) {
      return NextResponse.json(
        {
          error: 'stripe_price_not_configured',
          message: `Bundle "${bundle}" — Price ID Stripe absent ou code inconnu.`,
          bundle,
          cycle,
        },
        { status: 503 },
      )
    }
    lineItems.push({ price: bundlePriceId, quantity: 1 })
    metadata.bundle_code = bundle
  }

  // Cas 2 — Plan (annuaire, logiciel, addon)
  if (plan) {
    const productType = classifyProductCode(plan)
    if (!productType) {
      return NextResponse.json(
        { error: 'unknown_plan_code', message: `Code "${plan}" non reconnu.`, plan },
        { status: 400 },
      )
    }
    // Plans gratuits — pas de checkout Stripe.
    if (plan === 'annuaire_free' || plan === 'logiciel_free') {
      return NextResponse.json(
        { error: 'free_plan_no_checkout', message: 'Les plans gratuits ne nécessitent pas de checkout Stripe.' },
        { status: 400 },
      )
    }
    const planPriceId = getStripePriceId(productType, plan, cycle)
    if (!planPriceId) {
      return NextResponse.json(
        {
          error: 'stripe_price_not_configured',
          message: `Plan "${plan}" — Price ID Stripe absent ou code inconnu.`,
          plan,
          cycle,
        },
        { status: 503 },
      )
    }
    // Si bundle déjà ajouté en line_item principal, on n'ajoute le plan que s'il diffère.
    // (Cas exotique : bundle + add-on standalone — utile pour ajouter sigs+pennylane à un bundle.)
    if (!bundle) {
      lineItems.push({ price: planPriceId, quantity: 1 })
    }
    metadata.plan_code = plan
    metadata.product_type = productType
  }

  // Cas 3 — Slot sponsorisé (additionnel, exclusif au plan annuaire_sponsored)
  if (slot) {
    if (plan !== 'annuaire_sponsored') {
      return NextResponse.json(
        {
          error: 'slot_requires_sponsored_plan',
          message: 'Les slots sponsorisés sont réservés au plan annuaire_sponsored.',
          plan,
          slot,
        },
        { status: 400 },
      )
    }
    const slotPriceId = getStripePriceId('sponsored_slot', slot, cycle)
    if (!slotPriceId) {
      return NextResponse.json(
        {
          error: 'stripe_price_not_configured',
          message: `Slot "${slot}" — Price ID Stripe absent ou code inconnu.`,
          slot,
          cycle,
        },
        { status: 503 },
      )
    }
    lineItems.push({ price: slotPriceId, quantity: 1 })
    metadata.sponsored_slot_id = slot
  }

  if (lineItems.length === 0) {
    return NextResponse.json(
      { error: 'no_line_items', message: 'Aucun line_item Stripe à facturer.' },
      { status: 400 },
    )
  }

  // 5. Récupère / crée le customer Stripe rattaché à l'organisation
  const existing = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('organization_id', orgId)
    .maybeSingle()

  type ExistingRow = { stripe_customer_id: string | null } | null
  let customerId = (existing.data as ExistingRow)?.stripe_customer_id ?? null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail ?? undefined,
      metadata: { organization_id: orgId, user_id: user.id },
    })
    customerId = customer.id
  }

  // 6. Crée la session Stripe Checkout
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: lineItems,
    mode: 'subscription',
    success_url: `${origin}/dashboard/account/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing`,
    automatic_tax: { enabled: true },
    metadata,
    subscription_data: {
      metadata,
    },
  })

  // GET → 303 redirect direct vers Stripe. POST → JSON { url } (compat back-end / fetch).
  if (request.method === 'GET' && session.url) {
    return NextResponse.redirect(session.url, 303)
  }
  return NextResponse.json({ url: session.url, sessionId: session.id })
}

export async function GET(request: Request): Promise<Response> {
  return handleCheckout(request)
}

export async function POST(request: Request): Promise<Response> {
  return handleCheckout(request)
}
