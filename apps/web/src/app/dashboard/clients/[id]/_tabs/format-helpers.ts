/**
 * Helpers de formatage spécifiques fiche client.
 * Centralisés pour cohérence (monnaie € HT, dates fr-FR, etc.).
 */

/** Format monétaire € (numéric Supabase → string FR). */
export function formatEur(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  const n = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

/** Format date courte fr-FR (ex: "12 mai 2026"). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Heure HH:mm Europe/Paris si scheduled_at posé avec une heure ≠ 00:00.
 * Retourne null sinon (date-only ou ISO invalide).
 */
export function formatTimeHHmm(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const hhmm = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
  return hhmm === '00:00' ? null : hhmm
}
