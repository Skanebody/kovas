/**
 * /app/analytics — Refonte 2026-05-20 (P5b) style Apple Santé "Parcourir".
 *
 * Module Cabinet Analytics PRO+ tier — vision long terme 3-12 mois.
 *
 * Structure :
 *   1. Gating PRO+ via planAtLeast(planCode, 'pro') → sinon UpsellCard sobre
 *   2. Search bar sticky (filtre client-side toutes métriques par nom)
 *   3. Hero "Santé du cabinet" (Health Score 0-100 + diagnostics auto)
 *   4. Tendances longue durée (chart SVG custom 6m/1y/3y multi-series)
 *   5. Catégories cabinet (6 sections dépliables : Activité, Finances, Satisfaction,
 *      Conversion, Risque ADEME, Croissance)
 *   6. Benchmarks régionaux/FR (tableau sobre vs marché)
 *   7. Footer méthodo
 *
 * DS v5 strict : sage/dark/chartreuse, Urbanist + Instrument Serif italic + JetBrains
 * Mono, radius 24 sur cards racine, aucun gradient flashy.
 */

import { SectionHeader } from '@/app/dashboard/dashboard/section-header'
import { UpsellEmptyState } from '@/components/upsell/UpsellEmptyState'
import { trackBehaviorEvent } from '@/lib/upsell/track-event'
import { AppPageHeader } from '@/components/app-page-header'
import { Card } from '@/components/ui/card'
import {
  type AnonymousBenchmarkRow,
  BENCHMARK_MIN_SAMPLE_SIZE,
  type BusinessAnalyticsSnapshotRow,
  computeHealthScore,
  diversityFromShares,
} from '@/lib/analytics/types'
import { getCurrentUser } from '@/lib/auth/current-user'
import { planAtLeast } from '@/lib/billing/feature-gates'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { AnalyticsBrowser } from './analytics-browser'
import { BenchmarkComparison, type BenchmarkRow } from './benchmark-comparison'
import { HealthScoreHero, type HealthScoreDiagnostic } from './health-score-hero'
import type { MetricRow } from './metric-category-section'
import { TrendsChart, type TrendsSeries } from './trends-chart'

export const metadata: Metadata = { title: 'Performance cabinet' }

/* ---------- Typed Supabase shims (legacy from previous page kept untouched) ---------- */

interface SnapshotsTable {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      eq: (
        col: string,
        val: string,
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          limit: (n: number) => Promise<{
            data: BusinessAnalyticsSnapshotRow[] | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
}

interface BenchmarksTable {
  select: (cols: string) => {
    eq: (col: string, val: string) => BenchmarksQueryChain
  }
}
type BenchmarksQueryChain = {
  eq: (col: string, val: string) => BenchmarksQueryChain
  gte: (col: string, val: number) => BenchmarksQueryChain
  order: (col: string, opts: { ascending: boolean }) => BenchmarksQueryChain
  limit: (n: number) => Promise<{
    data: AnonymousBenchmarkRow[] | null
    error: { message: string } | null
  }>
}

interface PrescribersTable {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => Promise<{
      data: Array<{ id: string; revenue_12m_eur: number; tier: string }> | null
      error: { message: string } | null
    }>
  }
}

interface QuotesTable {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      gte: (
        col: string,
        val: string,
      ) => Promise<{
        data: Array<{ status: string; sent_at: string | null }> | null
        error: { message: string } | null
      }>
    }
  }
}

function snapshotsTable(s: SupabaseClient): SnapshotsTable {
  return (s as unknown as { from(t: 'business_analytics_snapshots'): SnapshotsTable }).from(
    'business_analytics_snapshots',
  )
}
function benchmarksTable(s: SupabaseClient): BenchmarksTable {
  return (s as unknown as { from(t: 'anonymous_benchmarks'): BenchmarksTable }).from(
    'anonymous_benchmarks',
  )
}
function prescribersTable(s: SupabaseClient): PrescribersTable {
  return (s as unknown as { from(t: 'prescriber_relationships'): PrescribersTable }).from(
    'prescriber_relationships',
  )
}
function quotesTable(s: SupabaseClient): QuotesTable {
  return (s as unknown as { from(t: 'quotes'): QuotesTable }).from('quotes')
}

/* ---------- Helpers ---------- */

function formatEur(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString('fr-FR')} €`
}

function pctDelta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? 'stable' : 'nouveau'
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return 'stable'
  return `${pct > 0 ? '+' : ''}${pct}%`
}

function pctDeltaDirection(current: number, previous: number): 'up' | 'down' | 'flat' {
  if (current === previous) return 'flat'
  return current > previous ? 'up' : 'down'
}

export default async function AnalyticsPage() {
  const { user, supabase, orgId } = await getCurrentUser()

  /* ---------- Gating PRO+ ---------- */
  const { data: subRaw } = await supabase
    .from('subscriptions')
    .select('plan_code')
    .eq('organization_id', orgId)
    .maybeSingle()

  const planCode = (subRaw as { plan_code?: string } | null)?.plan_code
  const hasAccess = planAtLeast(planCode, 'pro')

  if (!hasAccess) {
    // L1 — Track attempt pour le moteur de triggers comportementaux.
    await trackBehaviorEvent(supabase, user.id, 'analytics_attempted', {
      organizationId: orgId,
    })
    return (
      <div className="space-y-6 animate-fade-in">
        <AppPageHeader
          title="Performance"
          accent="cabinet"
          eyebrow="Analytics avancées"
          description="Vision long terme du cabinet — health score, tendances 3 ans, benchmarks FR."
        />
        <UpsellEmptyState
          target="pro"
          trigger="analytics_attempted"
          title="Analytics avancées · forfait Pro"
          description="Health score composite, tendances longue durée 3 ans, benchmarks anonymisés (k-anonymity ≥ 5 cabinets), positionnement vs médiane FR. Disponible sur Pro, All Inclusive et Cabinet."
        />
      </div>
    )
  }

  /* ---------- Data fetching ---------- */
  // Snapshots month (24 derniers pour pouvoir afficher 1 an + 1 an avant)
  const { data: snapshots } = await snapshotsTable(supabase)
    .select(
      'id, organization_id, snapshot_period, period_type, missions_total, missions_completed, missions_exported, missions_cancelled, diagnostic_mix, revenue_ht_cents, revenue_ttc_cents, avg_mission_value_cents, ai_cost_cents, variable_cost_cents, gross_margin_cents, gross_margin_ratio, avg_time_to_export_seconds, avg_voice_seconds_per_mission, avg_photos_per_mission, by_day_of_week, by_hour_of_day, unique_clients, recurring_clients, top_client_share_pct, top_departments, estimated_time_saved_seconds, created_at, updated_at',
    )
    .eq('organization_id', orgId)
    .eq('period_type', 'month')
    .order('snapshot_period', { ascending: false })
    .limit(36)

  const list = snapshots ?? []
  const current = list[0] ?? null
  const previous = list[1] ?? null

  // Benchmarks national
  const { data: benchmarks } = await benchmarksTable(supabase)
    .select(
      'id, snapshot_period, period_type, scope, scope_code, cabinet_segment, diagnostic_kind, cabinets_count, missions_count, k_anonymity_threshold, median_missions_per_cabinet, p25_missions_per_cabinet, p75_missions_per_cabinet, median_time_to_export_seconds, p25_time_to_export_seconds, p75_time_to_export_seconds, diagnostic_mix_pct, median_mission_value_cents, p25_mission_value_cents, p75_mission_value_cents, median_gross_margin_ratio, median_time_saved_seconds_per_mission, created_at, updated_at',
    )
    .eq('period_type', 'month')
    .eq('scope', 'national')
    .eq('cabinet_segment', 'all')
    .gte('cabinets_count', BENCHMARK_MIN_SAMPLE_SIZE)
    .order('snapshot_period', { ascending: false })
    .limit(1)

  const benchmark = benchmarks?.[0] ?? null

  // Prescripteurs
  const { data: prescribers } = await prescribersTable(supabase)
    .select('id, revenue_12m_eur, tier')
    .eq('organization_id', orgId)
  const prescribersList = prescribers ?? []
  const diversityScore =
    prescribersList.length > 0
      ? diversityFromShares(prescribersList.map((p) => Number(p.revenue_12m_eur) || 0))
      : null

  // Quotes conversion (3 mois)
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const { data: quotes } = await quotesTable(supabase)
    .select('status, sent_at')
    .eq('organization_id', orgId)
    .gte('created_at', threeMonthsAgo.toISOString())
  const quoteRows = quotes ?? []
  const sentCount = quoteRows.filter((q) => q.sent_at != null).length
  const signedCount = quoteRows.filter((q) => ['signed', 'paid'].includes(q.status)).length
  const conversionRatio = sentCount > 0 ? signedCount / sentCount : null

  /* ---------- Health score ---------- */
  const growthRatio =
    previous && previous.revenue_ht_cents > 0
      ? (Number(current?.revenue_ht_cents ?? 0) - Number(previous.revenue_ht_cents)) /
        Number(previous.revenue_ht_cents)
      : null

  const healthBreakdown = current
    ? computeHealthScore({
        revenueCents: current.revenue_ht_cents,
        conversionRatio,
        diversityScore,
        growthRatio,
      })
    : null

  // Score précédent (mois-1) si on a m-1 + m-2
  const monthMinus2 = list[2] ?? null
  const previousGrowthRatio =
    monthMinus2 && monthMinus2.revenue_ht_cents > 0
      ? (Number(previous?.revenue_ht_cents ?? 0) - Number(monthMinus2.revenue_ht_cents)) /
        Number(monthMinus2.revenue_ht_cents)
      : null
  const previousHealth =
    previous
      ? computeHealthScore({
          revenueCents: previous.revenue_ht_cents,
          conversionRatio,
          diversityScore,
          growthRatio: previousGrowthRatio,
        })
      : null

  /* ---------- Diagnostics auto ---------- */
  const diagnostics: HealthScoreDiagnostic[] = []
  const dpeMix = current?.diagnostic_mix ?? {}
  const dpeCount = Number(dpeMix['DPE'] ?? dpeMix['dpe'] ?? 0)
  // Estimation seuil ADEME : on cumule sur 12 mois pour le seuil 1000
  const dpeLast12m = list
    .slice(0, 12)
    .reduce((sum, s) => sum + Number(s.diagnostic_mix?.['DPE'] ?? s.diagnostic_mix?.['dpe'] ?? 0), 0)
  if (dpeLast12m > 800) {
    diagnostics.push({
      level: 'warning',
      message: `Vous approchez du seuil ADEME 1000 DPE/an (${dpeLast12m} cumulés sur 12 mois). Surveillez votre cadence.`,
    })
  }
  // Conversion devis basse
  if (conversionRatio != null && conversionRatio < 0.3 && sentCount >= 5) {
    diagnostics.push({
      level: 'warning',
      message: `Taux de conversion devis bas (${Math.round(conversionRatio * 100)}%). Relances ou tarification à revoir ?`,
    })
  }
  // Dépendance prescripteur
  if (current?.top_client_share_pct != null && Number(current.top_client_share_pct) > 40) {
    diagnostics.push({
      level: 'danger',
      message: `Un client représente plus de ${Math.round(Number(current.top_client_share_pct))}% de votre CA. Diversifiez vos prescripteurs.`,
    })
  }
  // Croissance négative 2 mois consécutifs
  if (growthRatio != null && growthRatio < -0.1 && previousGrowthRatio != null && previousGrowthRatio < 0) {
    diagnostics.push({
      level: 'warning',
      message: `CA en baisse 2 mois consécutifs. Vérifiez votre pipeline commercial.`,
    })
  }

  /* ---------- Catégories métriques ---------- */
  // Préparer maps YYYY-MM pour sparklines (30j ≈ dernier mois, mais ici sparkline = 12 mois pour visualisation)
  // Pour simplifier on prend les 12 derniers points snapshots month.
  const last12 = [...list].slice(0, 12).reverse()
  const sparkRevenue = last12.map((s) => Number(s.revenue_ht_cents) / 100)
  const sparkMissions = last12.map((s) => Number(s.missions_total))
  const sparkMargin = last12.map((s) =>
    s.gross_margin_ratio != null ? Math.round(Number(s.gross_margin_ratio) * 100) : 0,
  )
  const sparkAvgValue = last12.map((s) => Number(s.avg_mission_value_cents) / 100)
  const sparkUniqueClients = last12.map((s) => Number(s.unique_clients))
  const sparkRecurring = last12.map((s) => Number(s.recurring_clients))

  const currentRevenue = Number(current?.revenue_ht_cents ?? 0)
  const previousRevenue = Number(previous?.revenue_ht_cents ?? 0)

  /* === Catégorie 1 — Activité === */
  const activiteMetrics: MetricRow[] = [
    {
      id: 'missions-month',
      icon: 'file-text',
      name: 'Missions ce mois',
      value: String(current?.missions_total ?? 0),
      delta: previous ? pctDelta(Number(current?.missions_total ?? 0), Number(previous.missions_total)) : undefined,
      deltaDirection: previous
        ? pctDeltaDirection(Number(current?.missions_total ?? 0), Number(previous.missions_total))
        : undefined,
      sparkline: sparkMissions,
      hint: 'Total missions ouvertes ou terminées',
    },
    {
      id: 'missions-completed',
      icon: 'file-check',
      name: 'Missions terminées',
      value: String(current?.missions_completed ?? 0),
      delta: previous
        ? pctDelta(Number(current?.missions_completed ?? 0), Number(previous.missions_completed))
        : undefined,
      deltaDirection: previous
        ? pctDeltaDirection(Number(current?.missions_completed ?? 0), Number(previous.missions_completed))
        : undefined,
      sparkline: last12.map((s) => Number(s.missions_completed)),
      hint: 'Statut "done" ou "exported"',
    },
    {
      id: 'missions-exported',
      icon: 'download',
      name: 'Missions exportées',
      value: String(current?.missions_exported ?? 0),
      delta: previous
        ? pctDelta(Number(current?.missions_exported ?? 0), Number(previous.missions_exported))
        : undefined,
      deltaDirection: previous
        ? pctDeltaDirection(Number(current?.missions_exported ?? 0), Number(previous.missions_exported))
        : undefined,
      sparkline: last12.map((s) => Number(s.missions_exported)),
      hint: 'Livrées au client (PDF/ZIP)',
    },
    {
      id: 'avg-time-export',
      icon: 'clock',
      name: 'Temps moyen jusqu\'à export',
      value:
        current?.avg_time_to_export_seconds != null
          ? `${Math.round(Number(current.avg_time_to_export_seconds) / 3600)}h`
          : '—',
      hint: 'De la création à l\'export',
      sparkline: last12.map((s) =>
        s.avg_time_to_export_seconds != null ? Math.round(Number(s.avg_time_to_export_seconds) / 3600) : 0,
      ),
    },
  ]

  /* === Catégorie 2 — Santé financière === */
  const finishersMetrics: MetricRow[] = [
    {
      id: 'revenue-ht',
      icon: 'coins',
      name: 'CA HT ce mois',
      value: formatEur(currentRevenue),
      delta: previous ? pctDelta(currentRevenue, previousRevenue) : undefined,
      deltaDirection: previous ? pctDeltaDirection(currentRevenue, previousRevenue) : undefined,
      sparkline: sparkRevenue,
      hint: 'Revenu hors taxes mensuel',
    },
    {
      id: 'avg-mission-value',
      icon: 'star',
      name: 'Panier moyen mission',
      value: current?.avg_mission_value_cents
        ? formatEur(Number(current.avg_mission_value_cents))
        : '—',
      delta: previous
        ? pctDelta(
            Number(current?.avg_mission_value_cents ?? 0),
            Number(previous.avg_mission_value_cents),
          )
        : undefined,
      deltaDirection: previous
        ? pctDeltaDirection(
            Number(current?.avg_mission_value_cents ?? 0),
            Number(previous.avg_mission_value_cents),
          )
        : undefined,
      sparkline: sparkAvgValue,
      hint: 'CA / nombre missions',
    },
    {
      id: 'gross-margin',
      icon: 'piggy-bank',
      name: 'Marge brute',
      value:
        current?.gross_margin_ratio != null
          ? `${Math.round(Number(current.gross_margin_ratio) * 100)}%`
          : '—',
      hint: 'CA HT − coûts variables (IA, hosting)',
      sparkline: sparkMargin,
    },
    {
      id: 'ai-cost',
      icon: 'activity',
      name: 'Coût IA ce mois',
      value: current?.ai_cost_cents ? formatEur(Number(current.ai_cost_cents)) : '—',
      hint: 'Claude + Whisper cumulés',
      sparkline: last12.map((s) => Number(s.ai_cost_cents) / 100),
    },
  ]

  /* === Catégorie 3 — Satisfaction client === */
  const recurringRatio =
    current?.unique_clients && current.unique_clients > 0
      ? Math.round((Number(current.recurring_clients) / Number(current.unique_clients)) * 100)
      : null
  const satisfactionMetrics: MetricRow[] = [
    {
      id: 'unique-clients',
      icon: 'users',
      name: 'Clients uniques',
      value: String(current?.unique_clients ?? 0),
      delta: previous
        ? pctDelta(Number(current?.unique_clients ?? 0), Number(previous.unique_clients))
        : undefined,
      deltaDirection: previous
        ? pctDeltaDirection(Number(current?.unique_clients ?? 0), Number(previous.unique_clients))
        : undefined,
      sparkline: sparkUniqueClients,
      hint: 'Distincts ce mois',
    },
    {
      id: 'recurring-clients',
      icon: 'repeat',
      name: 'Clients récurrents',
      value: String(current?.recurring_clients ?? 0),
      delta: previous
        ? pctDelta(Number(current?.recurring_clients ?? 0), Number(previous.recurring_clients))
        : undefined,
      deltaDirection: previous
        ? pctDeltaDirection(Number(current?.recurring_clients ?? 0), Number(previous.recurring_clients))
        : undefined,
      sparkline: sparkRecurring,
      hint: '≥ 2 missions sur 12 mois',
    },
    {
      id: 'recurring-ratio',
      icon: 'smile',
      name: 'Taux de récurrence',
      value: recurringRatio != null ? `${recurringRatio}%` : '—',
      hint: 'Récurrents / uniques',
    },
    {
      id: 'top-client-share',
      icon: 'heart-handshake',
      name: 'Part du 1er client',
      value:
        current?.top_client_share_pct != null
          ? `${Math.round(Number(current.top_client_share_pct))}%`
          : '—',
      hint: 'Indicateur de dépendance',
    },
  ]

  /* === Catégorie 4 — Conversion === */
  const acceptedCount = quoteRows.filter((q) =>
    ['accepted', 'signed', 'paid'].includes(q.status),
  ).length
  const conversionMetrics: MetricRow[] = [
    {
      id: 'quotes-sent',
      icon: 'file-text',
      name: 'Devis envoyés (3 mois)',
      value: String(sentCount),
      hint: 'Devis ayant un sent_at',
    },
    {
      id: 'quotes-accepted',
      icon: 'file-check',
      name: 'Devis acceptés',
      value: String(acceptedCount),
      hint: 'Accepted / signed / paid',
    },
    {
      id: 'conversion-rate',
      icon: 'percent',
      name: 'Taux de conversion',
      value: conversionRatio != null ? `${Math.round(conversionRatio * 100)}%` : '—',
      hint: 'Signés / envoyés',
      deltaDirection:
        conversionRatio != null && conversionRatio >= 0.4
          ? 'up'
          : conversionRatio != null && conversionRatio < 0.3
            ? 'down'
            : 'flat',
    },
    {
      id: 'prescribers-active',
      icon: 'users',
      name: 'Prescripteurs actifs',
      value: String(prescribersList.length),
      hint: 'Apporteurs identifiés 12 mois',
    },
  ]

  /* === Catégorie 5 — Risque ADEME === */
  const ademeRiskScore = Math.min(100, Math.round((dpeLast12m / 1000) * 100))
  const ademeMetrics: MetricRow[] = [
    {
      id: 'dpe-last-12m',
      icon: 'alert-octagon',
      name: 'DPE cumulés 12 mois',
      value: dpeLast12m.toLocaleString('fr-FR'),
      hint: 'Seuil ADEME : 1000 DPE/an',
      deltaDirection: dpeLast12m > 800 ? 'down' : 'flat',
      sparkline: last12.map(
        (s) => Number(s.diagnostic_mix?.['DPE'] ?? s.diagnostic_mix?.['dpe'] ?? 0),
      ),
    },
    {
      id: 'dpe-month',
      icon: 'file-text',
      name: 'DPE ce mois',
      value: String(dpeCount),
      hint: 'Diagnostics DPE saisis',
    },
    {
      id: 'ademe-distance',
      icon: 'shield-alert',
      name: 'Marge avant seuil',
      value: `${Math.max(0, 1000 - dpeLast12m).toLocaleString('fr-FR')} DPE`,
      hint: '1000 − cumulés 12 mois',
      deltaDirection: dpeLast12m > 800 ? 'down' : 'up',
    },
    {
      id: 'ademe-risk-score',
      icon: 'target',
      name: 'Niveau d\'exposition',
      value: `${ademeRiskScore}%`,
      hint: 'Cumul / seuil 1000',
    },
  ]

  /* === Catégorie 6 — Croissance === */
  const growthMetrics: MetricRow[] = [
    {
      id: 'mom-missions',
      icon: 'trending-up',
      name: 'Croissance missions M-1',
      value: previous ? pctDelta(Number(current?.missions_total ?? 0), Number(previous.missions_total)) : '—',
      deltaDirection: previous
        ? pctDeltaDirection(Number(current?.missions_total ?? 0), Number(previous.missions_total))
        : undefined,
      hint: 'Vs mois précédent',
      sparkline: sparkMissions,
    },
    {
      id: 'mom-revenue',
      icon: 'arrow-up-right',
      name: 'Croissance CA M-1',
      value: previous ? pctDelta(currentRevenue, previousRevenue) : '—',
      deltaDirection: previous ? pctDeltaDirection(currentRevenue, previousRevenue) : undefined,
      hint: 'Vs mois précédent',
      sparkline: sparkRevenue,
    },
    {
      id: 'growth-12m',
      icon: 'line-chart',
      name: 'Évolution sur 12 mois',
      value:
        last12.length >= 2 && Number(last12[0]?.missions_total ?? 0) > 0
          ? pctDelta(
              Number(last12[last12.length - 1]?.missions_total ?? 0),
              Number(last12[0]?.missions_total ?? 0),
            )
          : '—',
      hint: 'Premier vs dernier mois',
      deltaDirection:
        last12.length >= 2
          ? pctDeltaDirection(
              Number(last12[last12.length - 1]?.missions_total ?? 0),
              Number(last12[0]?.missions_total ?? 0),
            )
          : 'flat',
      sparkline: sparkMissions,
    },
    {
      id: 'health-trend',
      icon: 'trending-down',
      name: 'Health score',
      value: healthBreakdown ? `${healthBreakdown.total}/100` : '—',
      delta:
        healthBreakdown && previousHealth
          ? `${healthBreakdown.total - previousHealth.total > 0 ? '+' : ''}${healthBreakdown.total - previousHealth.total}`
          : undefined,
      deltaDirection:
        healthBreakdown && previousHealth
          ? healthBreakdown.total > previousHealth.total
            ? 'up'
            : healthBreakdown.total < previousHealth.total
              ? 'down'
              : 'flat'
          : 'flat',
      hint: 'Score composite global',
    },
  ]

  /* ---------- Tendances chart (12 mois indexés YYYY-MM) ---------- */
  const buildSeriesValues = (
    reader: (s: BusinessAnalyticsSnapshotRow) => number,
  ): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const s of list) {
      const key = s.snapshot_period.slice(0, 7)
      out[key] = reader(s)
    }
    return out
  }
  const trendsSeries: TrendsSeries[] = [
    {
      id: 'revenue',
      label: 'CA HT',
      color: '#163144',
      unitSuffix: ' €',
      values: buildSeriesValues((s) => Math.round(Number(s.revenue_ht_cents) / 100)),
    },
    {
      id: 'missions',
      label: 'Missions',
      color: '#A3C920',
      values: buildSeriesValues((s) => Number(s.missions_total)),
    },
  ]

  /* ---------- Benchmarks rows ---------- */
  const benchmarkRows: BenchmarkRow[] = benchmark
    ? [
        {
          id: 'avg-mission-value',
          label: 'Panier moyen mission',
          unitSuffix: ' €',
          yourValue: current?.avg_mission_value_cents
            ? Math.round(Number(current.avg_mission_value_cents) / 100)
            : null,
          national: benchmark.median_mission_value_cents
            ? Math.round(Number(benchmark.median_mission_value_cents) / 100)
            : null,
          top10pct: benchmark.p75_mission_value_cents
            ? Math.round(Number(benchmark.p75_mission_value_cents) / 100)
            : null,
        },
        {
          id: 'monthly-volume',
          label: 'Volume mensuel missions',
          yourValue: current?.missions_total ?? null,
          national: benchmark.median_missions_per_cabinet
            ? Number(benchmark.median_missions_per_cabinet)
            : null,
          top10pct: benchmark.p75_missions_per_cabinet
            ? Number(benchmark.p75_missions_per_cabinet)
            : null,
        },
        {
          id: 'time-to-export',
          label: 'Temps moyen export (h)',
          yourValue: current?.avg_time_to_export_seconds
            ? Math.round(Number(current.avg_time_to_export_seconds) / 3600)
            : null,
          national: benchmark.median_time_to_export_seconds
            ? Math.round(Number(benchmark.median_time_to_export_seconds) / 3600)
            : null,
          top10pct: benchmark.p25_time_to_export_seconds
            ? Math.round(Number(benchmark.p25_time_to_export_seconds) / 3600)
            : null,
        },
        {
          id: 'gross-margin',
          label: 'Marge brute',
          unitSuffix: ' %',
          yourValue:
            current?.gross_margin_ratio != null
              ? Math.round(Number(current.gross_margin_ratio) * 100)
              : null,
          national:
            benchmark.median_gross_margin_ratio != null
              ? Math.round(Number(benchmark.median_gross_margin_ratio) * 100)
              : null,
          top10pct: null,
        },
      ]
    : []

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl">
      <AppPageHeader
        title="Performance"
        accent="cabinet"
        eyebrow={`${list.length} mois d'historique`}
        description="Vision long terme — santé du cabinet, tendances, benchmarks anonymisés FR."
      />

      {/* Search bar sticky + parcours catégoriel */}
      <section>
        <AnalyticsBrowser
          categories={[
            {
              id: 'activite',
              icon: 'activity',
              name: 'Activité',
              accentClass: 'chartreuse',
              metrics: activiteMetrics,
            },
            {
              id: 'finances',
              icon: 'coins',
              name: 'Santé financière',
              accentClass: 'success',
              metrics: finishersMetrics,
            },
            {
              id: 'satisfaction',
              icon: 'smile',
              name: 'Satisfaction client',
              accentClass: 'info',
              metrics: satisfactionMetrics,
            },
            {
              id: 'conversion',
              icon: 'target',
              name: 'Conversion',
              accentClass: 'warning',
              metrics: conversionMetrics,
            },
            {
              id: 'ademe',
              icon: 'shield-alert',
              name: 'Risque ADEME',
              accentClass: 'danger',
              metrics: ademeMetrics,
            },
            {
              id: 'croissance',
              icon: 'trending-up',
              name: 'Croissance',
              accentClass: 'chartreuse',
              metrics: growthMetrics,
            },
          ]}
        />
      </section>

      {/* Hero Health Score */}
      <section>
        <SectionHeader number="01" title="Santé du cabinet" />
        {healthBreakdown ? (
          <HealthScoreHero
            score={healthBreakdown.total}
            previousScore={previousHealth?.total ?? null}
            diagnostics={diagnostics}
            methodologyHint={`Composite 30% CA · 20% conversion · 20% diversité prescripteurs · 30% croissance — recalculé chaque fin de mois.`}
          />
        ) : (
          <Card variant="opaque" padding="default" className="rounded-[24px]">
            <p className="text-sm text-ink-mute italic">
              Health score indisponible — pas encore de snapshot mensuel généré.
            </p>
          </Card>
        )}
      </section>

      {/* Tendances longue durée */}
      <section>
        <SectionHeader number="02" title="Tendances longue durée" />
        <TrendsChart
          title="CA et volume missions"
          series={trendsSeries}
          defaultPeriod="1y"
          hint="Toggle 6 mois / 1 an / 3 ans · données issues des snapshots mensuels worker."
        />
      </section>

      {/* Benchmarks FR */}
      <section>
        <SectionHeader number="03" title="Vous vs marché FR" />
        {benchmark && benchmarkRows.length > 0 ? (
          <BenchmarkComparison
            title="Positionnement vs médiane nationale"
            rows={benchmarkRows}
            sampleSize={benchmark.cabinets_count}
          />
        ) : (
          <Card variant="opaque" padding="default" className="rounded-[24px]">
            <p className="text-sm text-ink-mute italic">
              Benchmarks indisponibles — moins de {BENCHMARK_MIN_SAMPLE_SIZE} cabinets dans
              l&apos;échantillon de référence ce mois.
            </p>
          </Card>
        )}
      </section>

      {/* Footer méthodo */}
      <section>
        <p className="font-mono text-[11px] text-ink-mute leading-relaxed border-t border-rule/60 pt-4">
          Snapshots calculés par worker mensuel · benchmarks k-anonymity ≥ {BENCHMARK_MIN_SAMPLE_SIZE}{' '}
          cabinets · aucune donnée nominative partagée · Health Score composite recalculé chaque mois.
        </p>
      </section>
    </div>
  )
}
