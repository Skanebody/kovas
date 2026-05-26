/**
 * Mock dataset V1 Notifications Center.
 *
 * V1.1 remplacera ce module par une lecture Supabase de la vue
 * `app_notifications` (à créer en migration séparée — hors scope V1).
 */

import type { Notification } from './types'

/** Renvoie un set de notifications mockées calé sur "maintenant". */
export function getMockNotifications(): Notification[] {
  const now = Date.now()
  const minutesAgo = (m: number): string => new Date(now - m * 60_000).toISOString()
  const hoursAgo = (h: number): string => new Date(now - h * 3_600_000).toISOString()
  const daysAgo = (d: number): string => new Date(now - d * 86_400_000).toISOString()

  return [
    {
      id: 'notif-lead-001',
      kind: 'lead_directory',
      title: 'Nouveau lead annuaire — DPE T3 Rouen',
      message: 'Marie L. a consulté votre fiche Boost et demande un devis pour un DPE + ERP.',
      createdAt: minutesAgo(12),
      readAt: null,
      href: '/dashboard/leads',
    },
    {
      id: 'notif-ademe-001',
      kind: 'ademe_alert',
      title: 'Alerte risque ADEME — Dossier DOS-0214',
      message: 'Surface 110 m² + étiquette A : croisement Sirene à vérifier avant envoi.',
      createdAt: hoursAgo(2),
      readAt: null,
      href: '/dashboard/cockpit-ademe',
    },
    {
      id: 'notif-mission-001',
      kind: 'mission_completed',
      title: 'Mission terminée — 14 rue de la Paix, Paris 2',
      message: 'Le DPE est exporté en ZIP Liciel + PDF. Prêt pour envoi client.',
      createdAt: hoursAgo(5),
      readAt: null,
      href: '/dashboard/dossiers',
    },
    {
      id: 'notif-invoice-001',
      kind: 'invoice_overdue',
      title: 'Facture en retard — INV-2026-0182',
      message: 'Échéance dépassée de 6 jours, montant 280,00 €. Relance recommandée.',
      createdAt: daysAgo(1),
      readAt: new Date(now - 90 * 60_000).toISOString(),
      href: '/dashboard/facturation',
    },
    {
      id: 'notif-reg-001',
      kind: 'regulatory_update',
      title: 'Veille — Décret amiante 2026-401 publié',
      message: 'Modification des seuils de retrait pour les bâtiments < 1997.',
      createdAt: daysAgo(3),
      readAt: daysAgo(2),
      href: '/dashboard/veille',
    },
  ]
}
