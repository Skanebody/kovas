/**
 * Helpers de formatage notifications Center V1.
 */

import type { NotificationKind } from './types'

/**
 * Format relatif court FR : "À l'instant", "Il y a 3 min", "Il y a 2h",
 * "Hier", "Il y a 5j", "12 mai". Timezone Europe/Paris pour fallback.
 */
export function formatRelative(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMs / 3_600_000)
  const diffD = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `Il y a ${diffMin} min`
  if (diffH < 24) return `Il y a ${diffH}h`
  if (diffD === 1) return 'Hier'
  if (diffD < 7) return `Il y a ${diffD}j`

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Europe/Paris',
  })
}

/** Libellé court FR par catégorie (eyebrow mono uppercase). */
export const KIND_LABEL: Record<NotificationKind, string> = {
  lead_directory: 'Lead annuaire',
  mission_completed: 'Mission',
  ademe_alert: 'Alerte ADEME',
  invoice_overdue: 'Facturation',
  regulatory_update: 'Veille',
  system: 'Système',
}
