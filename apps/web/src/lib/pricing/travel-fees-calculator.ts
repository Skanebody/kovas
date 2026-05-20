/**
 * KOVAS — Calcul frais de déplacement (Partition B).
 *
 * Logique :
 *   - distance <= includedRadiusKm   → 0 € (zone incluse)
 *   - distance >  includedRadiusKm   → (distance - includedRadiusKm) × pricePerKmBeyond
 *                                       (capé à capAmount)
 */

import type { TravelFeesConfig } from './pricing-templates'

export interface TravelFeesResult {
  amountHt: number
  /** Description FR pour affichage UI / snapshot. */
  description: string
}

export function calculateTravelFees(
  config: TravelFeesConfig,
  distanceKm: number,
): TravelFeesResult {
  const safeDistance = Math.max(0, distanceKm)

  if (safeDistance <= config.includedRadiusKm) {
    return {
      amountHt: 0,
      description: `0 € (zone incluse ${config.includedRadiusKm} km)`,
    }
  }

  const extraKm = safeDistance - config.includedRadiusKm
  const rawAmount = round2(extraKm * config.pricePerKmBeyond)
  const cappedAmount = Math.min(rawAmount, config.capAmount)

  // Description : on indique le détail + cap si appliqué.
  const formatted = formatEur(cappedAmount)
  if (cappedAmount < rawAmount) {
    return {
      amountHt: cappedAmount,
      description: `${formatted} (plafond ${formatEur(config.capAmount)} atteint — ${safeDistance} km)`,
    }
  }
  return {
    amountHt: cappedAmount,
    description: `${formatted} (${safeDistance} km - ${config.includedRadiusKm} km inclus × ${formatEurPerKm(config.pricePerKmBeyond)})`,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function formatEur(n: number): string {
  // Format européen FR : « 15,00 € » mais ici on garde simple « 15 € »
  return Number.isInteger(n) ? `${n} €` : `${n.toFixed(2).replace('.', ',')} €`
}

function formatEurPerKm(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €/km`
}
