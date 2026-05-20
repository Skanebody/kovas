/**
 * Helpers de formatage partagés par les composants Finance admin.
 */

export function formatEur(amount: number, fractionDigits = 0): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(amount)
}

export function formatPct(pct: number, fractionDigits = 1): string {
  return `${pct.toFixed(fractionDigits)}%`
}

/** 'YYYY-MM' → 'janv. 26' (locale fr) */
export function shortMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  if (!y || !m) return monthKey
  const date = new Date(Number.parseInt(y, 10), Number.parseInt(m, 10) - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }).replace('.', '')
}

/** Couleurs v5 pour chaque plan (overlay sur navy, signature chartreuse en accent). */
export const PLAN_COLORS: Record<string, string> = {
  discovery: '#7FB5C7', // cyan-mid
  standard: '#D4F542', // chartreuse signature
  volume: '#163144', // navy default
  // tiers futurs (founder/cabinet) → fallback couleur stable
  founder: '#D97706', // amber
  cabinet: '#A3C920', // chartreuse-deep
}

export function planColor(planId: string): string {
  return PLAN_COLORS[planId] ?? '#5B7088'
}

export const PLAN_LABELS: Record<string, string> = {
  discovery: 'Découverte',
  standard: 'Standard',
  volume: 'Volume',
  founder: 'Founder',
  cabinet: 'Cabinet',
}

export function planLabel(planId: string): string {
  return PLAN_LABELS[planId] ?? planId
}
