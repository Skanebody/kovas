/**
 * KOVAS — Page Cockpit ADEME.
 *
 * Server component : charge en parallèle dernier snapshot KPI + 12 mois
 * d'historique + alertes actives + sample du cache DPE pour la carte.
 *
 * Composé via `<AdemeCockpitDashboard>` qui répartit dans les sous-blocs
 * (KPIs hero, carte France, alertes, evolution chart, comparaison).
 */

import type { Metadata } from 'next'

import { AppPageHeader } from '@/components/app-page-header'
import { AdemeCockpitDashboard } from '@/components/ademe/AdemeCockpitDashboard'
import { UpsellEmptyState } from '@/components/upsell/UpsellEmptyState'
import type { AdemeAlertRow } from '@/app/api/ademe/alerts/route'
import type { AdemeDpeCacheRow } from '@/app/api/ademe/dpe/historique/route'
import type { AdemeKpiSnapshotRow } from '@/app/api/ademe/kpi/current/route'
import { getCurrentUser } from '@/lib/auth/current-user'
import { planAtLeast } from '@/lib/billing/feature-gates'
import { trackBehaviorEvent } from '@/lib/upsell/track-event'

export const metadata: Metadata = { title: 'Cockpit ADEME' }
export const dynamic = 'force-dynamic'

export default async function CockpitAdemePage() {
  const { user, orgId, supabase } = await getCurrentUser()

  /* ---------- Gating Pro+ ---------- */
  const { data: subRaw } = await supabase
    .from('subscriptions')
    .select('plan_code')
    .eq('organization_id', orgId)
    .maybeSingle()
  const planCode = (subRaw as { plan_code?: string } | null)?.plan_code
  if (!planAtLeast(planCode, 'pro')) {
    await trackBehaviorEvent(supabase, user.id, 'cockpit_m2_attempted', {
      organizationId: orgId,
    })
    return (
      <div className="space-y-6 animate-fade-in">
        <AppPageHeader
          title="Cockpit"
          accent="ADEME"
          description="Monitoring de vos DPE publiés sur l'API ADEME, alertes anomalies et carte France."
        />
        <UpsellEmptyState
          target="pro"
          trigger="cockpit_m2_attempted"
          title="Cockpit ADEME · forfait Pro"
        />
      </div>
    )
  }

  const since12m = new Date()
  since12m.setUTCDate(since12m.getUTCDate() - 365)
  const since12mStr = since12m.toISOString().slice(0, 10)

  const [snapshotRes, historyRes, alertsRes, dpeCacheRes, dpeCountRes] = await Promise.all([
    supabase
      // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore régénérés
      .from('ademe_kpi_snapshots' as any)
      .select('*')
      .eq('organization_id', orgId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore régénérés
      .from('ademe_kpi_snapshots' as any)
      .select('*')
      .eq('organization_id', orgId)
      .gte('snapshot_date', since12mStr)
      .order('snapshot_date', { ascending: true }),
    supabase
      // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore régénérés
      .from('ademe_alerts' as any)
      .select('*')
      .eq('organization_id', orgId)
      .is('resolved_at', null)
      .order('triggered_at', { ascending: false }),
    supabase
      // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore régénérés
      .from('ademe_dpe_cache' as any)
      .select('*')
      .eq('organization_id', orgId)
      .not('latitude', 'is', null)
      .order('date_etablissement_dpe', { ascending: false })
      .limit(500),
    supabase
      // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore régénérés
      .from('ademe_dpe_cache' as any)
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId),
  ])

  const snapshot = (snapshotRes.data ?? null) as unknown as AdemeKpiSnapshotRow | null
  const history = (historyRes.data ?? []) as unknown as AdemeKpiSnapshotRow[]
  const alerts = (alertsRes.data ?? []) as unknown as AdemeAlertRow[]
  const dpeCache = (dpeCacheRes.data ?? []) as unknown as AdemeDpeCacheRow[]
  const dpeCount = dpeCountRes.count ?? 0

  return (
    <div className="space-y-8 animate-fade-in">
      <AppPageHeader
        eyebrow="Conformité ADEME"
        title="Cockpit"
        accent="ADEME"
        description="Surveillez votre exposition aux contrôles ADEME — volume, distribution, géographie, anomalies."
      />

      <AdemeCockpitDashboard
        snapshot={snapshot}
        history={history}
        alerts={alerts}
        dpeCache={dpeCache}
        dpeCount={dpeCount}
      />
    </div>
  )
}
