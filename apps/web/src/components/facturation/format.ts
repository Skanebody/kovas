/**
 * Helpers de formatage facturation — FR / EUR, format régionaux stricts.
 * Cf. CLAUDE.md §10 « Conventions formats régionaux ».
 */

export function formatEur(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

/**
 * Jours restants avant échéance (>0 = futur, <0 = en retard).
 * Renvoie null si pas de date.
 */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const target = new Date(iso).getTime()
  const now = Date.now()
  return Math.round((target - now) / 86_400_000)
}

/**
 * Variante visuelle pour pastille délai paiement facture.
 * - green : > 15 jours restants
 * - amber : 0-15 jours
 * - red   : en retard (négatif)
 */
export function paymentDelayVariant(daysLeft: number | null): 'green' | 'amber' | 'red' | 'muted' {
  if (daysLeft === null) return 'muted'
  if (daysLeft < 0) return 'red'
  if (daysLeft <= 15) return 'amber'
  return 'green'
}

export function paymentDelayLabel(daysLeft: number | null): string {
  if (daysLeft === null) return '—'
  if (daysLeft < 0) return `${Math.abs(daysLeft)} j de retard`
  if (daysLeft === 0) return 'Échéance auj.'
  if (daysLeft === 1) return 'Échéance demain'
  return `Dans ${daysLeft} j`
}
