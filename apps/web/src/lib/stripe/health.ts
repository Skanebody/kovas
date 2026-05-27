/**
 * Helpers Stripe pour la section /admin/stripe-health (read-only).
 *
 * Toutes les fonctions sont **cachées 60s en mémoire** pour éviter de marteler
 * l'API Stripe (rate limit 100 req/s en live, plus strict en test).
 *
 * Le cache est process-local — OK pour Vercel single-instance. Si on passe à
 * un déploiement multi-instance, migrer vers Redis (idem invoices.ts).
 *
 * Côté admin, aucune mutation n'est exposée : on évite ainsi toute manipulation
 * dangereuse depuis l'UI (refund, dispute response, cancel sub). Les actions
 * concrètes se font via le Dashboard Stripe (liens "Voir dans Stripe").
 */

import { getStripe, isStripeConfigured } from '@/lib/stripe'
import type Stripe from 'stripe'

// ============================================
// Types normalisés admin (pas d'objet Stripe brut côté UI)
// ============================================

export interface StripeFailedInvoice {
  id: string
  number: string | null
  customer_id: string | null
  customer_email: string | null
  amount_due: number
  currency: string
  status: Stripe.Invoice.Status | null
  created: number
  due_date: number | null
  days_overdue: number | null
  hosted_invoice_url: string | null
}

export interface StripeDispute {
  id: string
  charge_id: string | null
  amount: number
  currency: string
  reason: string
  status: string
  created: number
  evidence_deadline: number | null
  dashboard_url: string
}

export interface StripePastDueSub {
  id: string
  customer_id: string | null
  customer_email: string | null
  status: string
  current_period_end: number
  amount_monthly: number
  currency: string
  dashboard_url: string
}

export interface StripeExpiringCard {
  payment_method_id: string
  customer_id: string | null
  customer_email: string | null
  brand: string
  last4: string
  exp_month: number
  exp_year: number
  days_until_expiry: number
  dashboard_url: string
}

export interface StripeHealthSnapshot {
  configured: boolean
  fetchedAt: number
  failedInvoices: StripeFailedInvoice[]
  disputes: StripeDispute[]
  pastDueSubs: StripePastDueSub[]
  expiringCards: StripeExpiringCard[]
}

// ============================================
// Cache mémoire 60s
// ============================================

const TTL_MS = 60 * 1000

interface CacheEntry {
  expiresAt: number
  data: StripeHealthSnapshot
}

let cache: CacheEntry | null = null

export function invalidateHealthCache(): void {
  cache = null
}

// ============================================
// Helpers conversion
// ============================================

function customerEmail(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null
  if (typeof customer === 'string') return null
  if ('deleted' in customer && customer.deleted) return null
  return (customer as Stripe.Customer).email ?? null
}

function customerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null
  if (typeof customer === 'string') return customer
  return customer.id ?? null
}

function dashboardSubUrl(subId: string): string {
  return `https://dashboard.stripe.com/subscriptions/${subId}`
}
function dashboardDisputeUrl(disputeId: string): string {
  return `https://dashboard.stripe.com/disputes/${disputeId}`
}
function dashboardCustomerUrl(customerId: string): string {
  return `https://dashboard.stripe.com/customers/${customerId}`
}

// ============================================
// Fetchers Stripe (paginés simples avec limit raisonnable)
// ============================================

async function fetchFailedInvoices(stripe: Stripe): Promise<StripeFailedInvoice[]> {
  const now = Math.floor(Date.now() / 1000)
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60
  const sevenDaysAgo = now - 7 * 24 * 60 * 60

  // status='uncollectible' (factures abandonnées) + status='open' > 7j (paiement bloqué)
  const [uncollectible, open] = await Promise.all([
    stripe.invoices.list({
      status: 'uncollectible',
      created: { gte: thirtyDaysAgo },
      limit: 50,
      expand: ['data.customer'],
    }),
    stripe.invoices.list({
      status: 'open',
      created: { lte: sevenDaysAgo, gte: thirtyDaysAgo },
      limit: 50,
      expand: ['data.customer'],
    }),
  ])

  const all: Stripe.Invoice[] = [...uncollectible.data, ...open.data]

  return all.map((inv) => {
    const daysOverdue = inv.due_date ? Math.floor((now - inv.due_date) / (24 * 60 * 60)) : null
    return {
      id: inv.id ?? '',
      number: inv.number ?? null,
      customer_id: customerId(inv.customer),
      customer_email: customerEmail(inv.customer) ?? inv.customer_email ?? null,
      amount_due: inv.amount_due ?? 0,
      currency: inv.currency ?? 'eur',
      status: inv.status ?? null,
      created: inv.created ?? 0,
      due_date: inv.due_date,
      days_overdue: daysOverdue,
      hosted_invoice_url: inv.hosted_invoice_url ?? null,
    }
  })
}

async function fetchDisputes(stripe: Stripe): Promise<StripeDispute[]> {
  // Liste les disputes nécessitant action.
  const response = await stripe.disputes.list({ limit: 50 })
  return response.data
    .filter((d) => d.status === 'warning_needs_response' || d.status === 'needs_response')
    .map((d) => ({
      id: d.id,
      charge_id: typeof d.charge === 'string' ? d.charge : (d.charge?.id ?? null),
      amount: d.amount,
      currency: d.currency,
      reason: d.reason,
      status: d.status,
      created: d.created,
      evidence_deadline: d.evidence_details?.due_by ?? null,
      dashboard_url: dashboardDisputeUrl(d.id),
    }))
}

async function fetchPastDueSubs(stripe: Stripe): Promise<StripePastDueSub[]> {
  const response = await stripe.subscriptions.list({
    status: 'past_due',
    limit: 50,
    expand: ['data.customer'],
  })
  return response.data.map((s) => {
    const firstItem = s.items?.data?.[0]
    const price = firstItem?.price
    const amount = (price?.unit_amount ?? 0) * (firstItem?.quantity ?? 1)
    const periodEnd =
      ((s as unknown as Record<string, unknown>).current_period_end as number | undefined) ?? 0
    return {
      id: s.id,
      customer_id: customerId(s.customer),
      customer_email: customerEmail(s.customer),
      status: s.status,
      current_period_end: periodEnd,
      amount_monthly: amount,
      currency: price?.currency ?? 'eur',
      dashboard_url: dashboardSubUrl(s.id),
    }
  })
}

async function fetchExpiringCards(stripe: Stripe): Promise<StripeExpiringCard[]> {
  // Stripe ne propose pas un endpoint "expirent bientôt" — on doit lister les
  // payment methods type=card et filtrer JS. On limite à 100 customers pour
  // éviter l'explosion temps de réponse en attendant une indexation côté DB.
  //
  // Stratégie : lister les subscriptions actives, prendre leur default_payment_method,
  // puis filtrer celles qui expirent < 30j.

  const subsRes = await stripe.subscriptions.list({
    status: 'active',
    limit: 100,
    expand: ['data.customer', 'data.default_payment_method'],
  })

  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const results: StripeExpiringCard[] = []
  for (const sub of subsRes.data) {
    const pm = sub.default_payment_method
    if (!pm || typeof pm === 'string') continue
    if (pm.type !== 'card' || !pm.card) continue

    const expMonth = pm.card.exp_month
    const expYear = pm.card.exp_year
    // Date d'expiration = fin du mois exp_month/exp_year
    const expDate = new Date(expYear, expMonth, 0, 23, 59, 59)
    if (expDate > thirtyDaysFromNow) continue
    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
      // déjà expirée — on inclut quand même (paiement échouera dans peu de temps)
    }

    const daysUntilExpiry = Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const cid = customerId(sub.customer)

    results.push({
      payment_method_id: pm.id,
      customer_id: cid,
      customer_email: customerEmail(sub.customer),
      brand: pm.card.brand,
      last4: pm.card.last4,
      exp_month: expMonth,
      exp_year: expYear,
      days_until_expiry: daysUntilExpiry,
      dashboard_url: cid ? dashboardCustomerUrl(cid) : 'https://dashboard.stripe.com',
    })
  }
  return results.sort((a, b) => a.days_until_expiry - b.days_until_expiry)
}

// ============================================
// Snapshot agrégé (cached 60s)
// ============================================

export async function getStripeHealthSnapshot(): Promise<StripeHealthSnapshot> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) {
    return cache.data
  }

  if (!isStripeConfigured()) {
    const empty: StripeHealthSnapshot = {
      configured: false,
      fetchedAt: now,
      failedInvoices: [],
      disputes: [],
      pastDueSubs: [],
      expiringCards: [],
    }
    cache = { data: empty, expiresAt: now + TTL_MS }
    return empty
  }

  const stripe = getStripe()

  // En parallèle pour minimiser la latence.
  const [failedInvoices, disputes, pastDueSubs, expiringCards] = await Promise.all([
    fetchFailedInvoices(stripe).catch(() => [] as StripeFailedInvoice[]),
    fetchDisputes(stripe).catch(() => [] as StripeDispute[]),
    fetchPastDueSubs(stripe).catch(() => [] as StripePastDueSub[]),
    fetchExpiringCards(stripe).catch(() => [] as StripeExpiringCard[]),
  ])

  const snapshot: StripeHealthSnapshot = {
    configured: true,
    fetchedAt: now,
    failedInvoices,
    disputes,
    pastDueSubs,
    expiringCards,
  }
  cache = { data: snapshot, expiresAt: now + TTL_MS }
  return snapshot
}
