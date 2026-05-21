import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth/current-user'
import { parisDayBounds } from '@/lib/paris-dates'
import { ActionDuJour } from './action-du-jour'
import { AujourdhuiSection } from './aujourdhui-section'
import { ATraiterSection } from './a-traiter-section'
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
    <div className="mx-auto w-full max-w-[800px] space-y-10 animate-fade-in">
      {/* Salutation contextuelle */}
      <header>
        <h1 className="font-sans font-medium text-[32px] leading-tight tracking-tight text-ink">
          Bonjour{firstName ? ` ${firstName}` : ''}
        </h1>
        <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.15em] text-ink-mute capitalize">
          {todayLabel} <span className="normal-case tracking-normal">·</span>{' '}
          <span className="normal-case tracking-normal">{visitLabel}</span>
        </p>
      </header>

      {/* Action unique du jour */}
      <ActionDuJour />

      {/* Liste compacte RDV du jour */}
      <AujourdhuiSection />

      {/* Compteurs à traiter */}
      <ATraiterSection />

      {/* Mini-stats semaine */}
      <CetteSemaineSection />
    </div>
  )
}
