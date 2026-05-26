import { AppPageHeader } from '@/components/app-page-header'
import { ProfessionStatsWidget } from '@/components/dashboard/widgets/ProfessionStatsWidget'
import { RenewalsWidget } from '@/components/dashboard/widgets/RenewalsWidget'
import { getCurrentUser } from '@/lib/auth/current-user'
import { parisDayBounds } from '@/lib/paris-dates'
import type { Metadata } from 'next'
import { ATraiterSection } from './a-traiter-section'
import { ActionDuJour } from './action-du-jour'
import { AujourdhuiSection } from './aujourdhui-section'
import { CetteSemaineSection } from './cette-semaine-section'

export const metadata: Metadata = { title: 'Tableau de bord' }

export default async function DashboardPage() {
  const { profile, supabase, orgId } = await getCurrentUser()
  const firstName = profile.full_name?.split(' ')[0] ?? ''

  const { startIso, endIso } = parisDayBounds()
  const { count: visitsToday } = await supabase
    .from('dossiers')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)

  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Paris',
  })
  const visitCount = visitsToday ?? 0
  const visitLabel =
    visitCount === 0
      ? 'Aucune mission planifiée'
      : `${visitCount} mission${visitCount > 1 ? 's' : ''} aujourd'hui`

  return (
    <div className="space-y-6 md:space-y-10 animate-fade-in">
      {/* Salutation contextuelle — V5 sobre, AppPageHeader unifié */}
      <AppPageHeader
        eyebrow={todayLabel}
        title={`Bonjour${firstName ? ` ${firstName}` : ''}`}
        description={visitLabel}
      />

      {/* Contenu épuré : action du jour + sections minimes (pattern SIMP-2)
          Cap à 800px pour la lecture confortable, dans le max-w-7xl du layout. */}
      <div className="mx-auto w-full max-w-[800px] space-y-6 md:space-y-10">
        {/* Action unique du jour */}
        <ActionDuJour />

        {/* Liste compacte RDV du jour */}
        <AujourdhuiSection />

        {/* Compteurs à traiter */}
        <ATraiterSection />

        {/* Mini-stats semaine */}
        <CetteSemaineSection />

        {/* Widget renouvellements certifications (A1.3.10) — Lot B82 */}
        <RenewalsWidget />

        {/* Widget stats secteur 7 jours (GC4 diag-facing) — Lot B82 */}
        <ProfessionStatsWidget />
      </div>
    </div>
  )
}
