import { CostsBreakdown } from '@/components/admin/finance/CostsBreakdown'
import { MRRChart } from '@/components/admin/finance/MRRChart'
import { MarginsChart } from '@/components/admin/finance/MarginsChart'
import { PackAdoptionChart } from '@/components/admin/finance/PackAdoptionChart'
import { PricingComparisonTable } from '@/components/admin/finance/PricingComparisonTable'
import { ProjectionsChart } from '@/components/admin/finance/ProjectionsChart'
import { RevenueByPeriod } from '@/components/admin/finance/RevenueByPeriod'
import { RevenueForecastSection } from '@/components/admin/finance/RevenueForecastSection'
import { StripeSyncStatus } from '@/components/admin/finance/StripeSyncStatus'
import { TopClientsTable } from '@/components/admin/finance/TopClientsTable'
import { formatEur, formatPct } from '@/components/admin/finance/finance-format'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import {
  calculateMRR,
  calculateMRRHistory,
  calculateMargins,
  calculateMonthCosts,
  calculateProjections,
  calculateTopClients,
} from '@/lib/admin/finance-calculator'
import {
  getPackAdoption,
  getPricingComparison,
  getRevenueForecast,
  getRevenueRealized,
} from '@/lib/admin/revenue-metrics'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { Coins, Percent, TrendingUp, Wallet } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Finance · Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminFinancePage() {
  const supabase = createAdminClient()
  const now = new Date()

  const [
    mrr,
    history,
    topClients,
    costs,
    margins,
    projections,
    revenueForecast,
    revenueRealized,
    packAdoption,
    pricingComparison,
  ] = await Promise.all([
    calculateMRR(supabase),
    calculateMRRHistory(supabase, 12),
    calculateTopClients(supabase, 10),
    calculateMonthCosts(supabase, now),
    calculateMargins(supabase, 6),
    calculateProjections(supabase, 6),
    getRevenueForecast(supabase, 30),
    getRevenueRealized(supabase, 30),
    getPackAdoption(supabase),
    getPricingComparison(supabase),
  ])

  // CA ce mois = MRR du dernier point d'historique (mois courant).
  const lastHistoryPoint = history[history.length - 1]
  const revenueThisMonth = lastHistoryPoint?.mrr ?? mrr.total

  // Marge brute % du mois courant
  const grossMarginEur = revenueThisMonth - costs.total
  const grossMarginPct = revenueThisMonth > 0 ? (grossMarginEur / revenueThisMonth) * 100 : 0

  const momComparison =
    mrr.growth.mom !== 0
      ? `${mrr.growth.mom > 0 ? '+' : ''}${formatEur(mrr.growth.mom)} (${
          mrr.growth.momPct > 0 ? '+' : ''
        }${formatPct(mrr.growth.momPct, 1)}) vs mois dernier`
      : 'stable vs mois dernier'

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          💰 Finance · vue mensuelle
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Votre finance.
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          MRR, coûts, marges et projections — toutes les données rafraîchies à chaque chargement.
        </p>
      </div>

      {/* Métriques principales */}
      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Métriques finance clés"
      >
        <AdminMetricCard
          eyebrow="MRR actuel"
          value={formatEur(mrr.total)}
          hint="Abonnements actifs (Phase 1)"
          comparison={momComparison}
          icon={TrendingUp}
        />
        <AdminMetricCard
          eyebrow="CA ce mois"
          value={formatEur(revenueThisMonth)}
          hint="Estimation V1 sur subs actives"
          icon={Coins}
        />
        <AdminMetricCard
          eyebrow="Coûts ce mois"
          value={formatEur(costs.total, 0)}
          hint="IA + Stripe + Supabase + Resend"
          icon={Wallet}
        />
        <AdminMetricCard
          eyebrow="Marge brute"
          value={formatPct(grossMarginPct, 0)}
          hint={`Marge nette : ${formatEur(grossMarginEur)}`}
          icon={Percent}
        />
      </section>

      {/* Charts ligne 1 : MRR + Revenue stacked */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-2" aria-label="Évolution revenue">
        <MRRChart history={history} />
        <RevenueByPeriod history={history} />
      </section>

      {/* Charts ligne 2 : Margins + Costs breakdown */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-3" aria-label="Marges et coûts">
        <div className="lg:col-span-2">
          <MarginsChart margins={margins} />
        </div>
        <CostsBreakdown costs={costs} />
      </section>

      {/* Charts ligne 3 : Projections + Stripe sync */}
      <section
        className="grid gap-4 grid-cols-1 lg:grid-cols-3"
        aria-label="Projections et statut sync"
      >
        <div className="lg:col-span-2">
          <ProjectionsChart projections={projections} />
        </div>
        <StripeSyncStatus />
      </section>

      {/* Top clients */}
      <section aria-label="Top clients">
        <TopClientsTable clients={topClients} />
      </section>

      {/* Revenue forecast & réalisé (mission_pricing_snapshots) */}
      <RevenueForecastSection forecast={revenueForecast} realized={revenueRealized} />

      {/* Pack adoption + Pricing comparison anonymisée */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-2" aria-label="Packs et pricing">
        <PackAdoptionChart rows={packAdoption} />
        <PricingComparisonTable comparison={pricingComparison} />
      </section>
    </div>
  )
}
