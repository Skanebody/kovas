/**
 * Crée un Stripe Payment Link à la volée pour une facture émise, afin
 * que le client puisse régler en 1 clic (CB / Apple Pay / Google Pay).
 *
 * Mode dégradé : si Stripe pas configuré (env), retourne null — l'email
 * de relance affiche alors uniquement les coordonnées IBAN.
 */

import { getStripe, isStripeConfigured } from '@/lib/stripe'

export interface CreatePaymentLinkInput {
  invoiceReference: string
  amountTtcEur: number
  description: string
}

/**
 * Crée un Payment Link Stripe one-shot pour le montant TTC de la facture.
 *
 * Implémentation : crée d'abord un Product + Price ad-hoc (one_time),
 * puis le Payment Link. Stripe n'autorise pas de montant libre sur les
 * Payment Links — il faut passer par un Price.
 */
export async function createInvoicePaymentLink(
  input: CreatePaymentLinkInput,
): Promise<{ url: string | null; id: string | null; error?: string }> {
  if (!isStripeConfigured()) return { url: null, id: null, error: 'stripe_not_configured' }

  try {
    const stripe = getStripe()
    const amountCents = Math.round(input.amountTtcEur * 100)
    if (amountCents <= 0) return { url: null, id: null, error: 'invalid_amount' }

    // 1. Crée Product + Price one-time (Stripe v2024+)
    const price = await stripe.prices.create({
      currency: 'eur',
      unit_amount: amountCents,
      product_data: {
        name: `Facture ${input.invoiceReference} — ${input.description}`.slice(0, 250),
      },
    })

    // 2. Crée Payment Link associé
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        invoice_reference: input.invoiceReference,
      },
      after_completion: {
        type: 'hosted_confirmation',
        hosted_confirmation: {
          custom_message: `Merci ! Votre paiement pour la facture ${input.invoiceReference} a bien été reçu.`,
        },
      },
    })

    return { url: link.url, id: link.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'stripe_error'
    return { url: null, id: null, error: msg.slice(0, 400) }
  }
}
