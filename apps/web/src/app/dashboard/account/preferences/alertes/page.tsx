import { AppPageHeader } from '@/components/app-page-header'
import { Card, CardContent } from '@/components/ui/card'
import { getAlertPreferences } from '@/lib/alerts/user-preferences'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { Metadata } from 'next'
import { PreferencesForm } from './preferences-form'

export const metadata: Metadata = { title: 'Préférences — Alertes' }

export default async function AlertPreferencesPage() {
  const { supabase, orgId } = await getCurrentUser()
  const initial = await getAlertPreferences(supabase, orgId)

  return (
    <div className="max-w-3xl space-y-8">
      <AppPageHeader
        title="Tes"
        accent="alertes"
        description="KOVAS ne dépasse jamais 3 alertes par mission et 1 suggestion proactive par jour. Tu restes maître de ton temps."
      />

      <Card variant="warm" padding="default">
        <CardContent className="pt-0 text-sm text-[#0F1419] leading-relaxed">
          <p className="mb-2 font-medium">La philosophie KOVAS, en clair :</p>
          <ul className="list-disc pl-5 space-y-1 text-[#0F1419]/82">
            <li>Tu as toujours raison — aucune alerte n’est bloquante.</li>
            <li>Les tolérances sont larges. On évite les faux positifs.</li>
            <li>Maximum 3 alertes par mission, jamais plus.</li>
            <li>Maximum 1 suggestion proactive par jour.</li>
            <li>Si tu ignores 5 fois la même alerte, KOVAS la désactive automatiquement.</li>
          </ul>
        </CardContent>
      </Card>

      <PreferencesForm initial={initial} />
    </div>
  )
}
