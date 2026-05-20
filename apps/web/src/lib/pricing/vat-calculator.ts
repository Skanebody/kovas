/**
 * KOVAS — Calcul TVA (Partition B).
 *
 * Deux statuts :
 *   - with_vat        → TVA appliquée (taux normal 20% par défaut)
 *   - franchise_vat   → art. 293 B du CGI, TVA NON applicable
 *
 * Le taux est paramétré côté `user_pricing_config.vat_rate`. Par défaut 0.200.
 */

export type VatStatus = 'with_vat' | 'franchise_vat'

export interface VatCalculation {
  vatApplicable: boolean
  vatRate: number
  vatAmount: number
  totalTtc: number
  /** Note FR à afficher si franchise. */
  vatNote?: string
}

export function calculateVat(totalHt: number, vatStatus: VatStatus, vatRate = 0.2): VatCalculation {
  if (vatStatus === 'franchise_vat') {
    return {
      vatApplicable: false,
      vatRate: 0,
      vatAmount: 0,
      totalTtc: round2(totalHt),
      vatNote: 'TVA non applicable, art. 293 B du CGI',
    }
  }
  const vatAmount = round2(totalHt * vatRate)
  return {
    vatApplicable: true,
    vatRate,
    vatAmount,
    totalTtc: round2(totalHt + vatAmount),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
