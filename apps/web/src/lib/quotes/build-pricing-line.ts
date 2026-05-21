/**
 * KOVAS — Helpers de construction de lignes de devis depuis le catalogue
 * tarifaire (`user_pricing_config` + `user_pricing_packs`).
 *
 * Ces helpers sont utilisés par :
 *   - Le wizard `/dashboard/devis/nouveau` (dropdown intelligent)
 *   - L'API de pré-remplissage (auto-quotes converti en quote final)
 *
 * Conventions :
 *   - Prix renvoyés en euros (number, 2 décimales max)
 *   - Pas de TVA appliquée ici — gérée par computeQuoteTotals
 */

import {
  type DiagnosticPricing,
  type DiagnosticModulations,
  type PricingDiagnosticType,
  type PropertyType,
  getModulationForProperty,
} from '@/lib/pricing/pricing-templates'
import {
  QUOTE_DIAGNOSTIC_LABELS,
  type QuoteDiagnosticType,
  type QuoteLineItem,
  round2,
} from './types'

/**
 * Crée une ligne « libre » (catch-all manuel).
 */
export function buildCustomLine(args: {
  designation: string
  quantity: number
  unitPriceHt: number
  tvaRate: number
}): QuoteLineItem {
  return {
    id: `tmp-${Math.random().toString(36).slice(2, 10)}`,
    kind: 'custom',
    designation: args.designation,
    quantity: Math.max(1, args.quantity),
    unitPriceHt: round2(args.unitPriceHt),
    tvaRate: args.tvaRate,
  }
}

/**
 * Crée une ligne « diagnostic à l'unité » depuis le catalogue tarifaire user.
 * Si `pricing` est null ou si le diagnostic n'est pas configuré, on crée une
 * ligne à 0 € que l'utilisateur pourra éditer.
 */
export function buildDiagnosticLine(args: {
  diagnostic: QuoteDiagnosticType
  pricing: DiagnosticPricing | null
  propertyType: PropertyType | null
  surface: number | null
  tvaRate: number
}): QuoteLineItem {
  const label = QUOTE_DIAGNOSTIC_LABELS[args.diagnostic]
  let unitPriceHt = 0
  let suffix = ''

  if (args.pricing) {
    const modulation =
      args.propertyType !== null && args.surface !== null && args.surface > 0
        ? getModulationForProperty(
            args.pricing.modulations as DiagnosticModulations,
            args.propertyType,
            args.surface,
          )
        : 1
    unitPriceHt = round2(args.pricing.basePrice * modulation)
    if (args.surface && args.propertyType) {
      suffix = ` — ${args.propertyType} ${args.surface} m²`
    }
  }

  return {
    id: `tmp-${args.diagnostic}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'diagnostic',
    designation: `${label}${suffix}`,
    quantity: 1,
    unitPriceHt,
    tvaRate: args.tvaRate,
    diagnosticType: args.diagnostic,
  }
}

/**
 * Crée une ligne « pack custom » depuis user_pricing_packs.
 */
export function buildPackLine(args: {
  packId: string
  packName: string
  packDiagnostics: PricingDiagnosticType[]
  packPriceHt: number
  tvaRate: number
}): QuoteLineItem {
  const diagsLabel =
    args.packDiagnostics.length > 0
      ? ` (${args.packDiagnostics.join(' + ')})`
      : ''
  return {
    id: `tmp-pack-${args.packId.slice(0, 6)}-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'pack',
    designation: `${args.packName}${diagsLabel}`,
    quantity: 1,
    unitPriceHt: round2(args.packPriceHt),
    tvaRate: args.tvaRate,
    packId: args.packId,
  }
}

/**
 * Crée une ligne « frais de déplacement ».
 */
export function buildTravelLine(args: {
  amountHt: number
  description: string
  tvaRate: number
}): QuoteLineItem {
  return {
    id: `tmp-travel-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'travel',
    designation: `Frais de déplacement — ${args.description}`,
    quantity: 1,
    unitPriceHt: round2(args.amountHt),
    tvaRate: args.tvaRate,
  }
}

/**
 * Crée une ligne « majoration » (urgence / weekend / soir).
 */
export function buildMajorationLine(args: {
  kind: 'urgency' | 'weekend' | 'evening'
  amountHt: number
  tvaRate: number
}): QuoteLineItem {
  const labels: Record<'urgency' | 'weekend' | 'evening', string> = {
    urgency: 'Majoration urgence (48h)',
    weekend: 'Majoration weekend',
    evening: 'Majoration intervention en soirée',
  }
  return {
    id: `tmp-majo-${args.kind}`,
    kind: 'majoration',
    designation: labels[args.kind],
    quantity: 1,
    unitPriceHt: round2(args.amountHt),
    tvaRate: args.tvaRate,
    majorationKind: args.kind,
  }
}

/**
 * Calcule la distance Haversine en kilomètres entre deux points GPS.
 * Réplique de `haversineMeters` ÷ 1000 — duppé ici pour éviter d'importer
 * le module scheduling depuis quotes (séparation domain).
 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371
  const toRad = (deg: number): number => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}
