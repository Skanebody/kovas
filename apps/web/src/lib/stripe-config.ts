/**
 * Configuration des 3 tiers Phase 1 KOVAS.
 * Cf. CLAUDE.md §4
 *
 * Les Stripe Price IDs doivent être créés manuellement dans le dashboard Stripe.
 * Set them via env vars STRIPE_PRICE_<TIER>.
 */

export interface KovasTier {
  id: 'discovery' | 'standard' | 'volume'
  label: string
  description: string
  priceMonthlyCents: number
  priceAnnualCents: number // 10 mois sur 12 (2 mois offerts)
  missionsIncluded: number
  overagePriceCents: number
  storageGb: number
  recommended?: boolean
}

export const KOVAS_TIERS: KovasTier[] = [
  {
    id: 'discovery',
    label: 'Découverte',
    description: 'Pour démarrer ou les petits volumes',
    priceMonthlyCents: 2900,
    priceAnnualCents: 29000, // 10 × 29
    missionsIncluded: 20,
    overagePriceCents: 200,
    storageGb: 20,
  },
  {
    id: 'standard',
    label: 'Standard',
    description: 'Le tier le plus choisi par les solopreneurs',
    priceMonthlyCents: 5900,
    priceAnnualCents: 59000,
    missionsIncluded: 60,
    overagePriceCents: 150,
    storageGb: 50,
    recommended: true,
  },
  {
    id: 'volume',
    label: 'Volume',
    description: 'Pour les power users en cabinet solo',
    priceMonthlyCents: 9900,
    priceAnnualCents: 99000,
    missionsIncluded: 150,
    overagePriceCents: 100,
    storageGb: 100,
  },
]

export function getTier(id: string): KovasTier | undefined {
  return KOVAS_TIERS.find((t) => t.id === id)
}

/** Map env Stripe Price IDs par tier × cycle */
export function getStripePriceId(tier: KovasTier['id'], cycle: 'monthly' | 'annual'): string | null {
  const key = `STRIPE_PRICE_${tier.toUpperCase()}_${cycle.toUpperCase()}`
  return process.env[key] ?? null
}
