/**
 * Statistiques A/B testing — approximations pragmatiques V1.5.
 *
 * Zones grises explicitement assumées :
 *  - p-value : chi-square 2×2 sans correction de Yates,
 *    approximation Wilson–Hilferty pour la CDF χ²(1).
 *  - Pas de correction multi-tests (Bonferroni), pas de séquentialité.
 *  - Pour décisions critiques : valider via Fisher exact ou un outil dédié.
 */

export interface VariantStat {
  variant: string
  exposures: number
  conversions: number
  conversionRatePct: number | null
}

/** Lift relatif en % entre control et variant (positif = variant gagnant). */
export function computeLiftPct(control: VariantStat, variant: VariantStat): number | null {
  if (!control.exposures || !variant.exposures) return null
  const ctrlRate = control.conversions / control.exposures
  const varRate = variant.conversions / variant.exposures
  if (ctrlRate === 0) return varRate === 0 ? 0 : 100
  return ((varRate - ctrlRate) / ctrlRate) * 100
}

/**
 * Chi-square 2×2 sans correction de Yates.
 *   contingency :  [ [a, b],   ← control:    conv, non_conv
 *                    [c, d] ]  ← variant:    conv, non_conv
 *
 * Retourne la p-value approximée via la transformation de Wilson–Hilferty
 * pour la CDF χ²(1) (erreur < 1% sur la plage pertinente).
 */
export function approxPValueChiSquare(control: VariantStat, variant: VariantStat): number | null {
  const a = control.conversions
  const b = control.exposures - control.conversions
  const c = variant.conversions
  const d = variant.exposures - variant.conversions
  const n = a + b + c + d
  if (n === 0) return null
  if (a + c === 0 || b + d === 0 || a + b === 0 || c + d === 0) return null

  const numerator = (a * d - b * c) ** 2 * n
  const denominator = (a + b) * (c + d) * (a + c) * (b + d)
  if (denominator === 0) return null
  const chi2 = numerator / denominator

  // Approx p-value de χ²(1) via Wilson–Hilferty :
  //   z ≈ ( (chi2/1)^(1/3) - (1 - 2/(9*1)) ) / sqrt(2/(9*1))
  const z = (Math.cbrt(chi2) - (1 - 2 / 9)) / Math.sqrt(2 / 9)
  // p = 1 - Φ(z), one-sided ⇒ chi-square 1 dof est two-sided ⇒ multiplier par 2 conv
  const oneMinusPhi = 0.5 * erfc(z / Math.SQRT2)
  return Math.max(0, Math.min(1, oneMinusPhi))
}

/** erfc(x) via approximation Abramowitz & Stegun 7.1.26 (précision ~1.5e-7). */
function erfc(x: number): number {
  const sign = x >= 0 ? 1 : -1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax)
  return 1 - sign * y
}

/** Petit helper d'affichage : "0.034 (significatif)" ou "0.18 (non significatif)". */
export function formatPValue(p: number | null): string {
  if (p === null) return '—'
  if (p < 0.001) return '< 0.001 (très significatif)'
  if (p < 0.05) return `${p.toFixed(3)} (significatif)`
  return `${p.toFixed(3)} (non significatif)`
}
