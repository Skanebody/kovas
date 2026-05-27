import { AnnuaireUpgradeBanner } from '@/components/annuaire-dashboard/AnnuaireUpgradeBanner'
import { AppPageHeader } from '@/components/app-page-header'
import { InsightsIASection } from '@/components/dashboard/dashboard/insights-ia-section'
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

      {/*
        Layout responsive 2026-05-27 (fix Benjamin) :
          - Mobile/tablet (default → md)  : stack vertical 1 colonne, espacement
            généreux. Lecture séquentielle naturelle.
          - lg (≥1024 px)                  : grille 2 colonnes — main 1fr +
            aside 360 px. La colonne main reste la lecture principale ("Action
            du jour" + "Aujourd'hui" + "Insights IA" + bandeau upgrade) tandis
            que la sidebar regroupe les compteurs / stats / renouvellements
            (référence rapide en jetant un œil).
          - xl (≥1280 px)                  : la sidebar passe à 380 px pour
            respirer encore plus sur grand écran.
        Avant : `max-w-[800px] mx-auto` figeait toute la page à 800 px et
        gâchait 600+ px d'espace vide sur grand écran.
      */}
      <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px] lg:gap-10 xl:gap-12 lg:items-start">
        {/* COLONNE PRINCIPALE — lecture séquentielle (CTA → mission jour → IA → upgrade) */}
        <div className="space-y-6 md:space-y-10 min-w-0">
          {/* Action unique du jour */}
          <ActionDuJour />

          {/* Liste compacte RDV du jour */}
          <AujourdhuiSection />

          {/* Section 5 — Insights IA contextuels (2-4 cartes actionnables) */}
          <InsightsIASection />

          {/* Bandeau upgrade contextuel annuaire/logiciel (Lot Annuaire §6) —
              n'affiche rien si user déjà sur Pro/Cabinet/+. Lecture interne
              des souscriptions actives via Supabase. */}
          <AnnuaireUpgradeBanner />
        </div>

        {/* SIDEBAR — référence rapide (compteurs, mini-stats, renouvellements)
            Sticky en lg+ pour rester visible pendant le scroll de la colonne
            principale. Top calibré pour passer sous le header sticky (h-16). */}
        <aside className="space-y-6 md:space-y-8 lg:sticky lg:top-24 min-w-0">
          {/* Compteurs à traiter */}
          <ATraiterSection />

          {/* Mini-stats semaine */}
          <CetteSemaineSection />

          {/* Widget renouvellements certifications (A1.3.10) — Lot B82 */}
          <RenewalsWidget />

          {/* Widget stats secteur 7 jours (GC4 diag-facing) — Lot B82 */}
          <ProfessionStatsWidget />
        </aside>
      </div>
    </div>
  )
}
