import { DocumentScanButton } from '@/components/documents'
import { getCurrentUser } from '@/lib/auth/current-user'
import { planAtLeast } from '@/lib/billing/feature-gates'
import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { AdemeCockpitMini } from './ademe-cockpit-mini'
import { DashboardGreeting } from './dashboard-greeting'
import { DashboardPipeline } from './dashboard-pipeline'
import { PrioritiesAlerts } from './priorities-alerts'
import { QuickActions } from './quick-actions'
import { RecentActivityBlock } from './recent-activity-block'
import { RegulatoryNotificationsMini } from './regulatory-notifications-mini'
import { SectionHeader } from './section-header'
import { TodayBlock } from './today-block'
import { TodayKpiGrid } from './today-kpi-grid'
import { TrialAlerts } from './trial-alerts'
import { UrgentBanner } from './urgent-banner'
import { UsageQuotasWidget } from './usage-quotas-widget'

export const metadata: Metadata = { title: 'Tableau de bord' }

/**
 * Dashboard refonte 2026-05-26 — structure data-dense terminal sobre 01-07.
 *
 * Pivot stylistique : on adopte la STRUCTURE du mockup KOVAS Bloomberg-like
 * (sections numérotées 01-07, KPI grid serré avec bordures internes, panel
 * data-dense au lieu de glass cards rounded) tout en gardant l'IDENTITÉ
 * visuelle du DS v5 (Urbanist + Instrument Serif italic + JetBrains Mono,
 * palette sage/dark/chartreuse, radius 24px sur Card principales).
 *
 * Ordre de priorité décroissante :
 *   - UrgentBanner : urgences vitales (paiement, cancellation, litige, DSAR)
 *   - Greeting : "Bonjour [prénom], votre journée commence." + date
 *   - 01 · Performance du jour (KPI grid 4 cols : missions / devis / CA / risque ADEME)
 *   - 02 + 03 · Split : Missions du jour | Cockpit ADEME (panel navy ou upsell)
 *   - 04 + 05 · Split : Pipeline commercial (stages) | Veille IA ou Activité récente
 *   - TrialAlerts + UsageQuotasWidget (conditional, juste avant Priorités)
 *   - 06 · Priorités (P1/P2/P3 multi-sources)
 *   - 07 · Actions rapides (4 boutons grid)
 *
 * Gating intelligent : modules non inclus dans le plan affichent un UpsellCard
 * sobre (pas de pub agressive) plutôt que de masquer complètement.
 */
export default async function DashboardPage() {
  const { supabase, orgId, profile } = await getCurrentUser()
  const firstName = profile.full_name?.split(' ')[0] ?? 'à vous'

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan_code')
    .eq('organization_id', orgId)
    .maybeSingle()

  const planCode = (sub as { plan_code?: string } | null)?.plan_code
  const showPipeline = planAtLeast(planCode, 'pro')

  return (
    <div className="space-y-6">
      {/* URGENCE TOP — render null si rien d'urgent */}
      <UrgentBanner />

      {/* GREETING + date */}
      <DashboardGreeting firstName={firstName} />

      {/* Toolbar : scan document toujours accessible */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <DocumentScanButton placement="dashboard" variant="primary" />
      </div>

      <div className="space-y-10 animate-fade-in">
        {/* 01 · Performance du jour */}
        <section>
          <SectionHeader number="01" title="Performance du jour" />
          <TodayKpiGrid />
        </section>

        {/* 02 + 03 · Missions du jour | Cockpit ADEME */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
            <div>
              <SectionHeader
                number="02"
                title="Missions du jour"
                action={
                  <Link
                    href="/app/dossiers"
                    className="font-mono text-[11px] text-ink-mute border-b border-rule pb-0.5 hover:text-ink hover:border-ink inline-flex items-center gap-1 transition-colors"
                  >
                    Tous les dossiers <ArrowRight className="size-3" />
                  </Link>
                }
              />
              <TodayBlock />
            </div>
            <div>
              <div className="lg:invisible lg:h-0 lg:overflow-hidden">
                <SectionHeader number="03" title="Cockpit ADEME" />
              </div>
              <AdemeCockpitMini />
            </div>
          </div>
        </section>

        {/* 04 + 05 · Pipeline commercial (Pro+) | Veille réglementaire (All Inclusive+) */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
            <div>
              {showPipeline ? (
                <>
                  <div className="lg:invisible lg:h-0 lg:overflow-hidden">
                    <SectionHeader number="04" title="Pipeline commercial" />
                  </div>
                  <DashboardPipeline />
                </>
              ) : (
                <>
                  <SectionHeader number="04" title="Pipeline commercial" />
                  <div className="border border-rule/60 px-5 py-8 text-center">
                    <p className="text-sm text-ink mb-1">Pipeline commercial Kanban</p>
                    <p className="text-xs text-ink-mute mb-4">
                      Devis envoyés · consultés · signés · RDV planifiés
                    </p>
                    <Link
                      href="/pricing"
                      className="font-mono text-[11px] text-ink border-b border-ink pb-0.5 hover:opacity-70 inline-flex items-center gap-1"
                    >
                      Pack Pro ou + · à partir de 35 € HT/mois <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </>
              )}
            </div>
            <div>
              <RegulatoryNotificationsMini />
            </div>
          </div>
        </section>

        {/* Conditional : alertes essais + quotas (avant Priorités) */}
        <TrialAlerts />
        <UsageQuotasWidget />

        {/* 06 · Priorités multi-sources */}
        <section>
          <SectionHeader
            number="06"
            title="Priorités"
            action={
              <Link
                href="/app/dossiers"
                className="font-mono text-[11px] text-ink-mute border-b border-rule pb-0.5 hover:text-ink hover:border-ink inline-flex items-center gap-1 transition-colors"
              >
                Voir tout <ArrowRight className="size-3" />
              </Link>
            }
          />
          <PrioritiesAlerts />
        </section>

        {/* 07 · Actions rapides */}
        <section>
          <SectionHeader number="07" title="Actions rapides" />
          <QuickActions />
        </section>

        {/* Activité récente — gardé en bas comme contexte secondaire */}
        <section>
          <SectionHeader
            number="08"
            title="Activité récente"
            action={
              <Link
                href="/app/dossiers"
                className="font-mono text-[11px] text-ink-mute border-b border-rule pb-0.5 hover:text-ink hover:border-ink inline-flex items-center gap-1 transition-colors"
              >
                Tout voir <ArrowRight className="size-3" />
              </Link>
            }
          />
          <RecentActivityBlock />
        </section>
      </div>
    </div>
  )
}
