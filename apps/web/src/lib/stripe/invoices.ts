import { getStripe } from '@/lib/stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

/**
 * Représentation normalisée d'une facture Stripe destinée au front KOVAS.
 * On n'expose que les champs nécessaires à l'UI facturation (cf. spec V1) —
 * pas d'objet Stripe.Invoice brut côté client pour rester découplé.
 */
export interface InvoiceSummary {
  id: string
  number: string | null
  status: Stripe.Invoice.Status | null
  amount_paid: number
  amount_due: number
  currency: string
  /** Timestamp Unix (secondes) — date d'émission de la facture. */
  created: number
  /** Timestamp Unix — début de la période facturée. */
  period_start: number
  /** Timestamp Unix — fin de la période facturée. */
  period_end: number
  /** URL du PDF téléchargeable (signé Stripe). */
  invoice_pdf: string | null
  /** URL de la page Stripe hosted (consultation + paiement éventuel). */
  hosted_invoice_url: string | null
}

interface CacheEntry {
  expiresAt: number
  data: InvoiceSummary[]
}

const TTL_MS = 60 * 1000
const cache = new Map<string, CacheEntry>()

function toSummary(invoice: Stripe.Invoice): InvoiceSummary {
  // Les périodes les plus parlantes pour un abonnement Stripe se trouvent
  // dans la première ligne (subscription line item). Fallback sur la facture.
  const firstLine = invoice.lines?.data?.[0]
  const linePeriod = firstLine?.period
  return {
    id: invoice.id ?? '',
    number: invoice.number ?? null,
    status: invoice.status ?? null,
    amount_paid: invoice.amount_paid ?? 0,
    amount_due: invoice.amount_due ?? 0,
    currency: invoice.currency ?? 'eur',
    created: invoice.created ?? 0,
    period_start: linePeriod?.start ?? invoice.created ?? 0,
    period_end: linePeriod?.end ?? invoice.created ?? 0,
    invoice_pdf: invoice.invoice_pdf ?? null,
    hosted_invoice_url: invoice.hosted_invoice_url ?? null,
  }
}

/**
 * Récupère les factures Stripe pour un customer donné, normalisées et triées
 * par date d'émission décroissante. Cache mémoire 60s par customer pour
 * éviter de marteler l'API Stripe (rate limit 100 req/s en mode live).
 *
 * Cache en mémoire process — OK pour instance unique Vercel/Node. À remplacer
 * par Redis si on passe à un déploiement multi-instance.
 */
export async function getInvoicesForCustomer(stripeCustomerId: string): Promise<InvoiceSummary[]> {
  const now = Date.now()
  const cached = cache.get(stripeCustomerId)
  if (cached && cached.expiresAt > now) {
    return cached.data
  }

  const stripe = getStripe()
  const response = await stripe.invoices.list({
    customer: stripeCustomerId,
    limit: 100,
    expand: ['data.lines'],
  })

  const summaries = response.data.map(toSummary).sort((a, b) => b.created - a.created)

  cache.set(stripeCustomerId, { data: summaries, expiresAt: now + TTL_MS })
  return summaries
}

/**
 * Helper haut niveau orienté KOVAS : lit le stripe_customer_id depuis
 * Supabase pour une organisation puis délègue à `getInvoicesForCustomer`.
 * Retourne `null` si l'org n'a pas (encore) de customer Stripe associé.
 */
export async function getInvoicesForOrganization(
  orgId: string,
  supabase: SupabaseClient,
): Promise<InvoiceSummary[] | null> {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('organization_id', orgId)
    .maybeSingle()

  const customerId = (sub as { stripe_customer_id: string | null } | null)?.stripe_customer_id
  if (!customerId) {
    return null
  }
  return getInvoicesForCustomer(customerId)
}

/** Invalide manuellement le cache pour un customer (ex. après webhook Stripe). */
export function invalidateInvoicesCache(stripeCustomerId: string): void {
  cache.delete(stripeCustomerId)
}
