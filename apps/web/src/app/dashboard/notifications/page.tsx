/**
 * KOVAS — Page Notifications Center.
 *
 * Liste complète des notifications (au-delà des 10 affichées dans le
 * popover de la cloche header). Pattern Linear : header sobre + liste
 * unifiée, pas de regroupement par date en V1.
 *
 * Data source V1 : mock statique (cf. `lib/notifications/mock.ts`).
 * V1.1 : lecture Supabase vue `app_notifications` (migration séparée).
 */

import { AppPageHeader } from '@/components/app-page-header'
import { Card } from '@/components/ui/card'
import { getMockNotifications } from '@/lib/notifications/mock'
import { buildNoindexMetadata } from '@/lib/seo/metadata'
import type { Metadata } from 'next'
import { NotificationsPageClient } from './NotificationsPageClient'

export const metadata: Metadata = buildNoindexMetadata({
  title: 'Notifications — KOVAS',
  description:
    'Centre de notifications : leads annuaire, missions terminées, alertes ADEME, factures en retard, veille réglementaire.',
  path: '/dashboard/notifications',
})

export default function NotificationsPage() {
  const notifications = getMockNotifications()

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Vos"
        accent="notifications"
        description="Centralisation des leads, missions, alertes et événements de votre activité."
        eyebrow="Centre de notifications"
      />

      <Card variant="flat" padding="none" className="overflow-hidden">
        <NotificationsPageClient initialNotifications={notifications} />
      </Card>
    </div>
  )
}
