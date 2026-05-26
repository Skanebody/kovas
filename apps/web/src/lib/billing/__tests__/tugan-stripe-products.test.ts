/**
 * Tests unitaires — config Stripe Tugan v3.0 (21 produits).
 *
 * Garantit les invariants critiques avant provisioning Stripe :
 *   - Cardinalité exacte : 21 produits, dont 8 plans, 7 add-ons, 4 bundles, 2 one-shots.
 *   - Codes uniques (pas de doublon dans le catalogue).
 *   - Lookup keys uniques (`kovas_<code>`) prêts pour `prices.list`.
 *   - Prix annuels = round(monthly × 12 × 0,85) — engagement -15%.
 *   - Prix en centimes integer (pas de float résiduel).
 *   - Add-on Cockpit Cabinet + Bundle Cabinet Premium = requiredTierAtLeast === 'cabinet_plus'.
 *   - Helpers `getStripeProduct`, `getStripeProductsByCategory`, `formatPriceEur` corrects.
 */

import { describe, expect, it } from 'vitest'
import {
  type StripeProductCode,
  TUGAN_STRIPE_PRODUCTS,
  formatPriceEur,
  getStripeProduct,
  getStripeProductsByCategory,
} from '../tugan-stripe-products'

describe('TUGAN_STRIPE_PRODUCTS — cardinalité', () => {
  it('contient exactement 21 produits', () => {
    expect(TUGAN_STRIPE_PRODUCTS).toHaveLength(21)
  })

  it('comporte 8 plans (4 tiers × 2 cycles)', () => {
    expect(getStripeProductsByCategory('plan')).toHaveLength(8)
  })

  it('comporte 7 add-ons mensuels', () => {
    expect(getStripeProductsByCategory('addon')).toHaveLength(7)
  })

  it('comporte 4 bundles mensuels', () => {
    expect(getStripeProductsByCategory('bundle')).toHaveLength(4)
  })

  it('comporte 2 produits one-shot (audit retro + lifetime deal)', () => {
    expect(getStripeProductsByCategory('oneshot')).toHaveLength(2)
  })
})

describe('TUGAN_STRIPE_PRODUCTS — invariants structurels', () => {
  it('tous les codes produits sont uniques', () => {
    const codes = TUGAN_STRIPE_PRODUCTS.map((p) => p.code)
    const unique = new Set(codes)
    expect(unique.size).toBe(codes.length)
  })

  it('tous les lookup keys Stripe sont uniques et préfixés "kovas_"', () => {
    const lookupKeys = TUGAN_STRIPE_PRODUCTS.map((p) => p.stripePriceLookupKey)
    const unique = new Set(lookupKeys)
    expect(unique.size).toBe(lookupKeys.length)
    for (const key of lookupKeys) {
      expect(key.startsWith('kovas_')).toBe(true)
    }
  })

  it('tous les priceCents sont des integers positifs en EUR', () => {
    for (const product of TUGAN_STRIPE_PRODUCTS) {
      expect(Number.isInteger(product.priceCents)).toBe(true)
      expect(product.priceCents).toBeGreaterThan(0)
      expect(product.currency).toBe('eur')
    }
  })

  it('description toujours renseignée (non vide)', () => {
    for (const product of TUGAN_STRIPE_PRODUCTS) {
      expect(product.description.length).toBeGreaterThan(10)
    }
  })
})

describe('TUGAN_STRIPE_PRODUCTS — calcul annuel -15%', () => {
  it('plan_solo_annual = round(2900 × 12 × 0.85) = 29 580 cts (295,80 €)', () => {
    const annual = getStripeProduct('plan_solo_annual')
    expect(annual?.priceCents).toBe(29_580)
  })

  it('plan_pro_annual = round(7900 × 12 × 0.85) = 80 580 cts (805,80 €)', () => {
    const annual = getStripeProduct('plan_pro_annual')
    expect(annual?.priceCents).toBe(80_580)
  })

  it('plan_cabinet_annual = round(19 900 × 12 × 0.85) = 202 980 cts (2 029,80 €)', () => {
    const annual = getStripeProduct('plan_cabinet_annual')
    expect(annual?.priceCents).toBe(202_980)
  })

  it('plan_cabinet_plus_annual = round(49 900 × 12 × 0.85) = 508 980 cts (5 089,80 €)', () => {
    const annual = getStripeProduct('plan_cabinet_plus_annual')
    expect(annual?.priceCents).toBe(508_980)
  })
})

describe('TUGAN_STRIPE_PRODUCTS — produits spécifiques', () => {
  it('audit_retroactif_oneshot = 99 € (9900 cts), billingMode one_time', () => {
    const audit = getStripeProduct('audit_retroactif_oneshot')
    expect(audit?.priceCents).toBe(9900)
    expect(audit?.billingMode).toBe('one_time')
    expect(audit?.trialDays).toBe(0)
  })

  it('lifetime_deal_founder = 2 000 € (200 000 cts), billingMode one_time', () => {
    const lifetime = getStripeProduct('lifetime_deal_founder')
    expect(lifetime?.priceCents).toBe(200_000)
    expect(lifetime?.billingMode).toBe('one_time')
    expect(lifetime?.trialDays).toBe(0)
  })

  it('addon_cockpit_cabinet réservé Cabinet+ (requiredTierAtLeast = cabinet_plus)', () => {
    const cockpit = getStripeProduct('addon_cockpit_cabinet')
    expect(cockpit?.requiredTierAtLeast).toBe('cabinet_plus')
    expect(cockpit?.priceCents).toBe(7900)
  })

  it('bundle_cabinet_premium réservé Cabinet+ (requiredTierAtLeast = cabinet_plus)', () => {
    const bundle = getStripeProduct('bundle_cabinet_premium')
    expect(bundle?.requiredTierAtLeast).toBe('cabinet_plus')
    expect(bundle?.priceCents).toBe(14_900)
  })

  it('tous les plans ont un trial de 30 jours', () => {
    const plans = getStripeProductsByCategory('plan')
    for (const plan of plans) {
      expect(plan.trialDays).toBe(30)
    }
  })

  it('tous les add-ons ont un trial de 7 jours', () => {
    const addons = getStripeProductsByCategory('addon')
    for (const addon of addons) {
      expect(addon.trialDays).toBe(7)
    }
  })
})

describe('getStripeProduct', () => {
  it('retourne le produit pour un code valide', () => {
    const product = getStripeProduct('plan_pro_monthly')
    expect(product).toBeDefined()
    expect(product?.priceCents).toBe(7900)
  })

  it('retourne undefined pour un code inexistant', () => {
    // Cast volontaire pour tester le runtime safety
    const product = getStripeProduct('plan_inexistant' as StripeProductCode)
    expect(product).toBeUndefined()
  })
})

describe('formatPriceEur', () => {
  it('formate 7900 cts → "79,00 €"', () => {
    //   = espace insécable utilisé par Intl.NumberFormat fr-FR
    expect(formatPriceEur(7900)).toBe('79,00 €')
  })

  it('formate 200000 cts → "2 000,00 €"', () => {
    // Intl.NumberFormat fr-FR utilise espace insécable étroit (U+202F) entre milliers
    // depuis Node 18+, on accepte les deux variantes pour robustesse.
    const out = formatPriceEur(200_000)
    // On normalise tous les espaces unicode (NBSP, narrow NBSP) en espace standard
    // pour comparaison stable cross-versions Node.
    const normalized = out.replace(/[  \s]+/g, ' ')
    expect(normalized).toBe('2 000,00 €')
  })

  it('formate 99 cts → "0,99 €"', () => {
    const out = formatPriceEur(99)
    expect(out.replace(/[  ]/g, ' ')).toBe('0,99 €')
  })

  it('formate 0 cts → "0,00 €"', () => {
    const out = formatPriceEur(0)
    expect(out.replace(/[  ]/g, ' ')).toBe('0,00 €')
  })
})
