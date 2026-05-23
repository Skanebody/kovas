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
    <div className="mx-auto w-full max-w-[800px] space-y-6 md:space-y-10 animate-fade-in">
      {/* Salutation contextuelle — header sticky aligné fiche client */}
      <header className="sticky top-0 z-20 -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-b sm:border border-rule/60 bg-paper/95 backdrop-blur-xl px-4 sm:px-7 py-5 shadow-glass-sm">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute capitalize">
            {todayLabel}
          </p>
          <h1 className="font-sans text-[28px] font-semibold leading-tight tracking-tight text-ink truncate">
            Bonjour{firstName ? ` ${firstName}` : ''}
            <span className="text-ink-mute">.</span>
          </h1>
          <p className="text-sm text-ink-mute">{visitLabel}</p>
        </div>
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
