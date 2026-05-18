import { z } from 'zod'

/**
 * Convention D310 (DISCOVERY.md) — Stockage monétaire :
 * - Storage : centimes integer (ex: 5900 = 59,00 €)
 * - Display : Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
 * - Parsing : "59,00 €" → 5900
 */

export const PriceCents = z.number().int().nonnegative()
export type PriceCentsType = z.infer<typeof PriceCents>

/**
 * Format un montant en centimes vers string EUR FR.
 * @example formatPriceEUR(5900) → "59,00 €"
 */
export function formatPriceEUR(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/**
 * Parse une string EUR vers centimes integer.
 * @example parseEUR("59,00 €") → 5900
 * @example parseEUR("1 234,56€") → 123456
 */
export function parseEUR(input: string): number {
  const cleaned = input
    .replace(/[€\s ]/g, '') // non-breaking spaces aussi
    .replace(',', '.')
  const parsed = Number.parseFloat(cleaned)
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid EUR format: ${input}`)
  }
  return Math.round(parsed * 100)
}

/**
 * Format un pourcentage (0-1 float) vers string FR.
 * Convention D310 — Pourcentages stockés 0-1 float.
 * @example formatPercent(0.2) → "20 %"
 */
export function formatPercent(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}
