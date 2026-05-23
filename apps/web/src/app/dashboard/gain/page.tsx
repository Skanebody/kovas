import { PageTabs } from '@/components/ui/page-tabs'
import { getCurrentUser } from '@/lib/auth/current-user'
import { DPE_LEGAL_LIMIT, DPE_MISSION_TYPES } from '@/lib/dpe-counter'
import { parisDayBounds, parisMonthBounds } from '@/lib/paris-dates'
import { cn } from '@/lib/utils'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Activity, Award, FileText, LayoutGrid, Mail, TrendingUp } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { type AdemeData, AdemeSection } from './categories/ademe-section'
import { type CabinetData, CabinetSection } from './categories/cabinet-section'
import { type ProductivityData, ProductivitySection } from './categories/productivity-section'
import { type QualityData, QualitySection } from './categories/quality-section'
import { type RevenueData, RevenueSection } from './categories/revenue-section'
import { type FavoriteKpi, FavoritesHeroCard } from './favorites-hero'
import { type Highlight, HighlightsCard } from './highlights-card'
import { type Period, PeriodSelector } from './period-selector'
import { TrendsLineChart, type TrendsPoint } from './trends-line-chart'

export const metadata: Metadata = { title: 'Vos gains' }

/**
 * Page /dashboard/gain — Performance personnelle.
 *
 * Refonte 2026-05-23 au pattern fiche client (`/dashboard/clients/[id]`) :
 *  - Header sticky Qonto pattern (paper/95 + backdrop-blur-xl)
 *  - 4 KPI cards résumé en haut (heures gagnées, productivité valorisée,
 *    missions, projection annuelle)
 *  - PageTabs horizontaux : Résumé / Activité / Évolution / Statuts pros /
 *    Rapport mensuel
 *  - Contenu conditionnel selon `?tab=`
 *  - Max-width respect grille (pas full width)
 *
 * Architecture : server component fetch toutes les data nécessaires en
 * parallèle. Period selector client (?period=…) provoque re-fetch via
 * Next.js searchParams.
 *
 * Hypothèses V1 (CLAUDE.md §2) :
 *  - 90 min gagnées par mission terminée (mesure réelle V1.5 via baseline)
 *  - 50 €/h tarif horaire pour valorisation libérée
 */

const MINUTES_SAVED_PER_MISSION = 90
const HOURLY_RATE_EUR = 50

interface MissionRow {
  completed_at: string | null
  type: string
}

interface InvoiceRow {
  amount_ht: number | string | null
  issued_at: string | null
  status: string
}

interface QuoteRow {
  status: string
  sent_at: string | null
  created_at: string
}

// ============================================================
// Typed Supabase helpers — table-by-table accessors
// (évite `any`, cf. pattern today-kpi-grid.tsx)
// ============================================================

function missionsFrom(s: SupabaseClient) {
  return s.from('missions')
}

function invoicesFrom(s: SupabaseClient) {
  return (
    s as unknown as {
      from(t: 'invoices'): {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            gte: (
              col: string,
              val: string,
            ) => {
              lt: (
                col: string,
                val: string,
              ) => Promise<{
                data: InvoiceRow[] | null
                error: { message: string } | null
              }>
            }
          }
        }
      }
    }
  ).from('invoices')
}

function quotesFrom(s: SupabaseClient) {
  return (
    s as unknown as {
      from(t: 'quotes'): {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            gte: (
              col: string,
              val: string,
            ) => Promise<{
              data: QuoteRow[] | null
              error: { message: string } | null
            }>
          }
        }
      }
    }
  ).from('quotes')
}

// ============================================================
// Helpers période → bornes ISO
// ============================================================

function periodBounds(period: Period): { startIso: string; endIso: string; label: string } {
  const now = new Date()
  if (period === 'day') {
    const b = parisDayBounds()
    return { startIso: b.startIso, endIso: b.endIso, label: "aujourd'hui" }
  }
  if (period === 'week') {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 7)
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      label: '7 derniers jours',
    }
  }
  if (period === 'year') {
    const end = new Date()
    const start = new Date(now.getFullYear(), 0, 1)
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      label: 'année en cours',
    }
  }
  // month (default)
  const b = parisMonthBounds()
  return { startIso: b.startIso, endIso: b.nextIso, label: 'ce mois' }
}

function previousPeriodBounds(period: Period): { startIso: string; endIso: string } {
  if (period === 'day') {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const b = parisDayBounds(yesterday)
    return { startIso: b.startIso, endIso: b.endIso }
  }
  if (period === 'week') {
    const end = new Date()
    end.setDate(end.getDate() - 7)
    const start = new Date()
    start.setDate(start.getDate() - 14)
    return { startIso: start.toISOString(), endIso: end.toISOString() }
  }
  if (period === 'year') {
    const y = new Date().getFullYear() - 1
    return {
      startIso: new Date(y, 0, 1).toISOString(),
      endIso: new Date(y + 1, 0, 1).toISOString(),
    }
  }
  // mois précédent
  const now = new Date()
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endPrev = new Date(now.getFullYear(), now.getMonth(), 1)
  return { startIso: startPrev.toISOString(), endIso: endPrev.toISOString() }
}

// ============================================================
// Calculs métriques
// ============================================================

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'string' ? Number.parseFloat(v) : v
  return Number.isFinite(n) ? n : 0
}

function deltaPct(current: number, prev: number): number | null {
  if (prev === 0) return current === 0 ? 0 : null
  return Math.round(((current - prev) / prev) * 100)
}

function buildMonthlySparkline(missions: MissionRow[], daysBack: number): number[] {
  const buckets = new Array(daysBack).fill(0) as number[]
  const now = Date.now()
  for (const m of missions) {
    if (!m.completed_at) continue
    const t = new Date(m.completed_at).getTime()
    const daysAgo = Math.floor((now - t) / (24 * 3600 * 1000))
    if (daysAgo >= 0 && daysAgo < daysBack) {
      buckets[daysBack - 1 - daysAgo] += 1
    }
  }
  return buckets
}

function buildLast12MonthsTrend(missions: MissionRow[], invoices: InvoiceRow[]): TrendsPoint[] {
  const now = new Date()
  const points: TrendsPoint[] = []
  for (let i = 11; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const label = ref.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')

    const monthMissions = missions.filter((m) => {
      if (!m.completed_at) return false
      const t = new Date(m.completed_at)
      return t >= ref && t < next
    })
    const hoursSaved = (monthMissions.length * MINUTES_SAVED_PER_MISSION) / 60

    const monthRevenue = invoices
      .filter((inv) => {
        if (!inv.issued_at) return false
        if (inv.status === 'draft' || inv.status === 'cancelled') return false
        const t = new Date(inv.issued_at)
        return t >= ref && t < next
      })
      .reduce((sum, inv) => sum + toNumber(inv.amount_ht), 0)

    points.push({ label, hoursSaved: Math.round(hoursSaved), revenueEur: Math.round(monthRevenue) })
  }
  return points
}

function computeStreak(missions: MissionRow[]): number {
  if (missions.length === 0) return 0
  const days = new Set<string>()
  for (const m of missions) {
    if (!m.completed_at) continue
    const t = new Date(m.completed_at)
    days.add(t.toISOString().slice(0, 10))
  }
  if (days.size === 0) return 0
  let streak = 0
  const cursor = new Date()
  for (let i = 0; i < 365; i++) {
    const key = cursor.toISOString().slice(0, 10)
    if (days.has(key)) {
      streak++
    } else if (i > 0) {
      break
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function buildHighlights(opts: {
  missionsDelta: number | null
  caDelta: number | null
  dpeApproachingLimit: boolean
  dpeCount12m: number
  productivityHours: number
}): Highlight[] {
  const out: Highlight[] = []

  if (opts.missionsDelta !== null && opts.missionsDelta >= 15) {
    out.push({
      tone: 'positive',
      message: `Vous avez réalisé ${opts.missionsDelta}% de missions de plus ce mois qu'au mois précédent.`,
    })
  } else if (opts.missionsDelta !== null && opts.missionsDelta <= -15) {
    out.push({
      tone: 'neutral',
      message: `L'activité est en retrait de ${Math.abs(opts.missionsDelta)}% par rapport au mois précédent — pensez à relancer les devis en attente.`,
    })
  }

  if (opts.caDelta !== null && opts.caDelta >= 15) {
    out.push({
      tone: 'positive',
      message: `Votre chiffre d'affaires HT progresse de ${opts.caDelta}% comparé au mois précédent.`,
    })
  }

  if (opts.dpeApproachingLimit) {
    out.push({
      tone: 'milestone',
      message: `Vous avez réalisé ${opts.dpeCount12m.toLocaleString('fr-FR')} DPE sur 12 mois glissants — vigilance sur le plafond légal de ${DPE_LEGAL_LIMIT.toLocaleString('fr-FR')}/an.`,
    })
  }

  if (opts.productivityHours >= 20 && out.length < 3) {
    out.push({
      tone: 'milestone',
      message: `${Math.round(opts.productivityHours)} heures économisées ce mois grâce à la saisie vocale et aux exports automatisés.`,
    })
  }

  return out.slice(0, 3)
}

// ============================================================
// Tabs typing
// ============================================================

type TabKey = 'resume' | 'activite' | 'evolution' | 'statuts' | 'rapport'
const VALID_TABS: readonly TabKey[] = ['resume', 'activite', 'evolution', 'statuts', 'rapport']

function isValidTab(value: string | undefined): value is TabKey {
  return typeof value === 'string' && (VALID_TABS as readonly string[]).includes(value)
}

// ============================================================
// Page principale
// ============================================================

interface GainPageProps {
  searchParams: Promise<{ period?: string; tab?: string }>
}

export default async function GainPage({ searchParams }: GainPageProps) {
  const sp = await searchParams
  const rawPeriod = sp.period
  const rawTab = sp.tab
  const period: Period =
    rawPeriod === 'day' || rawPeriod === 'week' || rawPeriod === 'year' || rawPeriod === 'custom'
      ? rawPeriod
      : 'month'
  const activeTab: TabKey = isValidTab(rawTab) ? rawTab : 'resume'

  const { supabase, orgId, profile } = await getCurrentUser()
  const firstName = profile.full_name?.split(' ')[0] ?? null

  const current = periodBounds(period)
  const previous = previousPeriodBounds(period)

  // Période 12 mois pour évolution + sparklines
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  twelveMonthsAgo.setDate(1)
  twelveMonthsAgo.setHours(0, 0, 0, 0)

  // Chargements parallèles
  const [
    missionsCurrentRes,
    missionsPreviousRes,
    missions12mRes,
    invoicesCurrentRes,
    invoicesPreviousRes,
    invoices12mRes,
    quotesCurrentRes,
    dpe12mRes,
    activeClientsRes,
  ] = await Promise.all([
    missionsFrom(supabase)
      .select('completed_at, type, client_id, property_id')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('status', ['done', 'exported'])
      .gte('completed_at', current.startIso)
      .lt('completed_at', current.endIso),
    missionsFrom(supabase)
      .select('completed_at, type')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('status', ['done', 'exported'])
      .gte('completed_at', previous.startIso)
      .lt('completed_at', previous.endIso),
    missionsFrom(supabase)
      .select('completed_at, type')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('status', ['done', 'exported'])
      .gte('completed_at', twelveMonthsAgo.toISOString()),
    invoicesFrom(supabase)
      .select('amount_ht, issued_at, status')
      .eq('organization_id', orgId)
      .gte('issued_at', current.startIso)
      .lt('issued_at', current.endIso),
    invoicesFrom(supabase)
      .select('amount_ht, issued_at, status')
      .eq('organization_id', orgId)
      .gte('issued_at', previous.startIso)
      .lt('issued_at', previous.endIso),
    invoicesFrom(supabase)
      .select('amount_ht, issued_at, status')
      .eq('organization_id', orgId)
      .gte('issued_at', twelveMonthsAgo.toISOString())
      .lt('issued_at', new Date().toISOString()),
    quotesFrom(supabase)
      .select('status, sent_at, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', current.startIso),
    missionsFrom(supabase)
      .select('completed_at')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('status', ['done', 'exported'])
      .in('type', DPE_MISSION_TYPES as unknown as string[])
      .gte('completed_at', twelveMonthsAgo.toISOString()),
    missionsFrom(supabase)
      .select('client_id')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('status', ['done', 'exported'])
      .gte('completed_at', current.startIso)
      .lt('completed_at', current.endIso)
      .not('client_id', 'is', null),
  ])

  const missionsCurrentRows = (missionsCurrentRes.data ?? []) as unknown as MissionRow[]
  const missionsPrevious = (missionsPreviousRes.data ?? []) as MissionRow[]
  const missions12m = (missions12mRes.data ?? []) as MissionRow[]
  const invoicesCurrent = (invoicesCurrentRes.data ?? []) as InvoiceRow[]
  const invoicesPrevious = (invoicesPreviousRes.data ?? []) as InvoiceRow[]
  const invoices12m = (invoices12mRes.data ?? []) as InvoiceRow[]
  const quotesCurrent = (quotesCurrentRes.data ?? []) as QuoteRow[]
  const dpe12mCount = ((dpe12mRes.data ?? []) as Array<{ completed_at: string | null }>).length
  const activeClientRows = (activeClientsRes.data ?? []) as Array<{ client_id: string | null }>

  // ============================================================
  // KPI HERO favoris + 4 KPI tête de page
  // ============================================================

  const missionsCurrentCount = missionsCurrentRows.length
  const minutesSavedCurrent = missionsCurrentCount * MINUTES_SAVED_PER_MISSION
  const hoursSavedCurrent = Math.round(minutesSavedCurrent / 60)
  const hoursMinutesCurrent = `${Math.floor(minutesSavedCurrent / 60)}h${String(
    minutesSavedCurrent % 60,
  ).padStart(2, '0')}`

  const minutesSavedPrevious = missionsPrevious.length * MINUTES_SAVED_PER_MISSION
  const minutesDeltaPct = deltaPct(minutesSavedCurrent, minutesSavedPrevious)

  const caCurrent = invoicesCurrent
    .filter((inv) => inv.status !== 'draft' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + toNumber(inv.amount_ht), 0)
  const caPrevious = invoicesPrevious
    .filter((inv) => inv.status !== 'draft' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + toNumber(inv.amount_ht), 0)
  const caDeltaPct = deltaPct(caCurrent, caPrevious)
  const missionsDeltaPct = deltaPct(missionsCurrentCount, missionsPrevious.length)

  // Productivité valorisée (€/h × heures économisées)
  const productivityValueEur = Math.round((minutesSavedCurrent / 60) * HOURLY_RATE_EUR)

  // Projection annuelle missions
  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const dayOfYear = Math.max(
    1,
    Math.floor((Date.now() - yearStart.getTime()) / (1000 * 60 * 60 * 24)),
  )
  const yearlyProjectionMissions = Math.round((missions12m.length / Math.max(dayOfYear, 1)) * 365)

  // Sparklines 30j
  const sparkMissions = buildMonthlySparkline(missions12m, 30)
  const sparkHours = sparkMissions.map((c) => c * MINUTES_SAVED_PER_MISSION)
  const sparkRevenue = (() => {
    const buckets = new Array(30).fill(0) as number[]
    const t0 = Date.now()
    for (const inv of invoices12m) {
      if (!inv.issued_at) continue
      if (inv.status === 'draft' || inv.status === 'cancelled') continue
      const t = new Date(inv.issued_at).getTime()
      const daysAgo = Math.floor((t0 - t) / (24 * 3600 * 1000))
      if (daysAgo >= 0 && daysAgo < 30) {
        buckets[29 - daysAgo] += toNumber(inv.amount_ht)
      }
    }
    return buckets
  })()

  const avgRating = ((): number | null => null)()

  const heroKpis: [FavoriteKpi, FavoriteKpi, FavoriteKpi, FavoriteKpi] = [
    {
      label: 'Heures gagnées',
      value:
        hoursSavedCurrent < 100
          ? hoursMinutesCurrent
          : `${hoursSavedCurrent.toLocaleString('fr-FR')}h`,
      delta:
        minutesDeltaPct === null
          ? undefined
          : minutesDeltaPct === 0
            ? 'stable'
            : `${minutesDeltaPct > 0 ? '+' : ''}${minutesDeltaPct}%`,
      deltaDirection:
        minutesDeltaPct === null
          ? 'neutral'
          : minutesDeltaPct > 0
            ? 'up'
            : minutesDeltaPct < 0
              ? 'down'
              : 'neutral',
      sparkline: sparkHours,
      sparkColor: '#34C759',
    },
    {
      label: 'Missions terminées',
      value: String(missionsCurrentCount),
      delta:
        missionsDeltaPct === null
          ? undefined
          : missionsDeltaPct === 0
            ? 'stable'
            : `${missionsDeltaPct > 0 ? '+' : ''}${missionsDeltaPct}%`,
      deltaDirection:
        missionsDeltaPct === null
          ? 'neutral'
          : missionsDeltaPct > 0
            ? 'up'
            : missionsDeltaPct < 0
              ? 'down'
              : 'neutral',
      sparkline: sparkMissions,
      sparkColor: '#007AFF',
    },
    {
      label: 'CA HT',
      value: Math.round(caCurrent).toLocaleString('fr-FR'),
      unit: '€',
      delta:
        caDeltaPct === null
          ? undefined
          : caDeltaPct === 0
            ? 'stable'
            : `${caDeltaPct > 0 ? '+' : ''}${caDeltaPct}%`,
      deltaDirection:
        caDeltaPct === null
          ? 'neutral'
          : caDeltaPct > 0
            ? 'up'
            : caDeltaPct < 0
              ? 'down'
              : 'neutral',
      sparkline: sparkRevenue,
      sparkColor: '#A3C920',
    },
    {
      label: 'Note moyenne',
      value: avgRating === null ? '—' : avgRating.toFixed(1),
      unit: avgRating === null ? undefined : '/ 5',
      delta: avgRating === null ? 'V1.5' : undefined,
      deltaDirection: 'neutral',
      sparkColor: '#FF9500',
    },
  ]

  // ============================================================
  // Catégories — Activité tab
  // ============================================================

  const avgMinutesPerMission =
    missions12m.length > 0 ? Math.round(MINUTES_SAVED_PER_MISSION * 0.85) : 0
  const productivityData: ProductivityData = {
    minutesSaved: minutesSavedCurrent,
    deltaMinutesSavedPct: minutesDeltaPct,
    avgMinutesPerMission,
    activeStreakDays: computeStreak(missions12m),
  }

  const invoicesCountedCurrent = invoicesCurrent.filter(
    (inv) => inv.status !== 'draft' && inv.status !== 'cancelled',
  )
  const avgInvoiceEur =
    invoicesCountedCurrent.length > 0 ? Math.round(caCurrent / invoicesCountedCurrent.length) : 0
  const sentQuotes = quotesCurrent.filter((q) =>
    ['sent', 'accepted', 'refused', 'expired'].includes(q.status),
  )
  const acceptedQuotes = quotesCurrent.filter((q) => q.status === 'accepted')
  const conversionRatePct =
    sentQuotes.length > 0 ? Math.round((acceptedQuotes.length / sentQuotes.length) * 100) : null
  const revenueData: RevenueData = {
    caHt: Math.round(caCurrent),
    deltaCaPct: caDeltaPct,
    avgInvoiceEur,
    conversionRatePct,
  }

  const qualityData: QualityData = {
    avgRating: null,
    firstPassRatePct: null,
    litigationCount: 0,
  }

  const typeCounts = new Map<string, number>()
  for (const m of missions12m) {
    if (m.type) typeCounts.set(m.type, (typeCounts.get(m.type) ?? 0) + 1)
  }
  const uniqueClients = new Set<string>()
  for (const r of activeClientRows) {
    if (r.client_id) uniqueClients.add(r.client_id)
  }
  const cabinetData: CabinetData = {
    diagnosticsByType: [...typeCounts.entries()].map(([type, count]) => ({ type, count })),
    activeClients: uniqueClients.size,
    activePrescribers: 0,
  }

  const yearlyProjectionDpe = Math.round((dpe12mCount / Math.max(dayOfYear, 1)) * 365)
  const ademeData: AdemeData = {
    dpeCount12m: dpe12mCount,
    dpeLimit: DPE_LEGAL_LIMIT,
    yearlyProjection: yearlyProjectionDpe,
    ratioFG: null,
    avgDistanceKm: null,
  }

  // ============================================================
  // Trends + highlights
  // ============================================================

  const trendsData = buildLast12MonthsTrend(missions12m, invoices12m)

  const highlights = buildHighlights({
    missionsDelta: missionsDeltaPct,
    caDelta: caDeltaPct,
    dpeApproachingLimit: dpe12mCount >= DPE_LEGAL_LIMIT * 0.8,
    dpeCount12m: dpe12mCount,
    productivityHours: minutesSavedCurrent / 60,
  })

  const lastUpdate = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })

  // 4 KPI tête de page — pattern stats-card client
  const topKpis: KpiTopItem[] = [
    {
      label: 'Heures économisées',
      value: hoursSavedCurrent < 100 ? hoursMinutesCurrent : `${hoursSavedCurrent}h`,
      hint: current.label,
      mono: true,
    },
    {
      label: 'Productivité valorisée',
      value: `${productivityValueEur.toLocaleString('fr-FR')} €`,
      hint: `base ${HOURLY_RATE_EUR} €/h`,
      mono: true,
    },
    {
      label: 'Missions terminées',
      value: String(missionsCurrentCount),
      hint: current.label,
      mono: true,
    },
    {
      label: 'Projection annuelle',
      value: String(yearlyProjectionMissions),
      hint: 'missions / an',
      mono: true,
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ============================================
          Header sticky — Qonto pattern (idem clients/[id])
          ============================================ */}
      <section className="sticky top-0 z-20 -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-b sm:border border-rule/60 bg-paper/95 backdrop-blur-xl px-4 sm:px-7 py-5 shadow-glass-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute">
                {firstName ? `${firstName} · Performance` : 'Performance'}
              </p>
              <h1 className="font-sans text-[28px] font-semibold leading-tight tracking-tight text-ink truncate">
                Vos <span className="font-serif italic font-normal text-ink-mute">gains</span>
                <span className="text-ink-mute">.</span>
              </h1>
              <p className="text-sm text-ink-mute max-w-xl">
                Temps libéré, missions exécutées, projection — méthode KOVAS.
              </p>
            </div>
            <PeriodSelector current={period} />
          </div>
        </div>
      </section>

      {/* ============================================
          4 KPI top — pattern stats-card
          ============================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {topKpis.map((k) => (
          <KpiTopCell key={k.label} item={k} />
        ))}
      </div>

      {/* ============================================
          Tabs navigation
          ============================================ */}
      <PageTabs
        basePath="/dashboard/gain"
        active={activeTab}
        paramName="tab"
        tabs={[
          { key: 'resume', label: 'Résumé', icon: LayoutGrid },
          { key: 'activite', label: 'Activité', icon: Activity },
          { key: 'evolution', label: 'Évolution', icon: TrendingUp },
          { key: 'statuts', label: 'Statuts pros', icon: Award },
          { key: 'rapport', label: 'Rapport mensuel', icon: Mail },
        ]}
      />

      {/* ============================================
          Contenu conditionnel
          ============================================ */}
      <div className="space-y-6">
        {activeTab === 'resume' && (
          <ResumeTab heroKpis={heroKpis} periodLabel={current.label} highlights={highlights} />
        )}
        {activeTab === 'activite' && (
          <ActiviteTab
            productivityData={productivityData}
            revenueData={revenueData}
            qualityData={qualityData}
            cabinetData={cabinetData}
            ademeData={ademeData}
          />
        )}
        {activeTab === 'evolution' && <EvolutionTab data={trendsData} />}
        {activeTab === 'statuts' && <StatutsProsTab />}
        {activeTab === 'rapport' && <RapportMensuelTab highlights={highlights} />}
      </div>

      {/* ============================================
          Footer méthodologie
          ============================================ */}
      <footer className="flex items-baseline justify-between gap-4 flex-wrap pt-4 border-t border-rule/60">
        <p className="font-mono text-[10px] text-ink-mute tracking-[0.05em]">
          Dernière mise à jour · {lastUpdate}
        </p>
        <Link
          href="/dashboard/account"
          className="font-mono text-[11px] text-ink-mute hover:text-ink tracking-[0.05em] transition-colors"
        >
          Exporter mes données →
        </Link>
      </footer>

      <p className="font-mono text-[10px] text-ink-mute/80 leading-relaxed">
        Méthodologie · {MINUTES_SAVED_PER_MISSION} min gagnées par mission terminée (référence DPE
        type, CLAUDE.md §2) · valorisation {HOURLY_RATE_EUR} €/h (productivité libérée). Mesure
        baseline réelle prévue V1.5 via tracking comparatif avant/après.
      </p>
    </div>
  )
}

// ============================================================
// Tab contents
// ============================================================

function ResumeTab({
  heroKpis,
  periodLabel,
  highlights,
}: {
  heroKpis: [FavoriteKpi, FavoriteKpi, FavoriteKpi, FavoriteKpi]
  periodLabel: string
  highlights: Highlight[]
}) {
  return (
    <div className="space-y-6">
      <FavoritesHeroCard periodLabel={periodLabel} kpis={heroKpis} />
      <HighlightsCard highlights={highlights} />
    </div>
  )
}

function ActiviteTab({
  productivityData,
  revenueData,
  qualityData,
  cabinetData,
  ademeData,
}: {
  productivityData: ProductivityData
  revenueData: RevenueData
  qualityData: QualityData
  cabinetData: CabinetData
  ademeData: AdemeData
}) {
  return (
    <div className="space-y-8">
      <ProductivitySection data={productivityData} />
      <RevenueSection data={revenueData} />
      <QualitySection data={qualityData} />
      <CabinetSection data={cabinetData} />
      <AdemeSection data={ademeData} />
    </div>
  )
}

function EvolutionTab({ data }: { data: TrendsPoint[] }) {
  return (
    <div className="space-y-6">
      <TrendsLineChart data={data} />
    </div>
  )
}

function StatutsProsTab() {
  return (
    <div className="rounded-xl border border-rule/60 bg-paper/85 p-6 sm:p-8 shadow-glass-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-full bg-cream-deep flex items-center justify-center shrink-0">
          <Award className="size-5 text-ink-mute" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute mb-1">
            Statuts professionnels · V1.5
          </p>
          <h2 className="font-sans text-[20px] font-semibold text-ink leading-tight">
            7 niveaux de progression
          </h2>
        </div>
      </div>

      <p className="text-sm text-ink-mute leading-relaxed max-w-2xl">
        Le système de statuts professionnels (Pro / Confirmé / Sénior / Premium / Ambassadeur /
        Fidèle / Expert) sera activé dans le sprint V1.5 post-launch, en même temps que le rapport
        mensuel email et l'image LinkedIn personnalisée. Ton sobre, format diplôme professionnel —
        jamais gaming.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          'Utilisateur Pro',
          'Confirmé',
          'Sénior',
          'Premium',
          'Ambassadeur',
          'Fidèle',
          'Expert',
        ].map((label) => (
          <div
            key={label}
            className="rounded-xl border border-rule/60 bg-paper/85 px-4 py-3 shadow-glass-xs"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute mb-1">
              Niveau
            </p>
            <p className="text-sm font-semibold text-ink">{label}</p>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-rule/40">
        <Link
          href="/dashboard/account/progression"
          className="inline-flex items-center gap-2 font-mono text-[11px] text-ink-mute hover:text-ink tracking-[0.05em] transition-colors"
        >
          Voir ma progression actuelle →
        </Link>
      </div>
    </div>
  )
}

function RapportMensuelTab({ highlights }: { highlights: Highlight[] }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-rule/60 bg-paper/85 p-6 sm:p-8 shadow-glass-sm space-y-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-full bg-cream-deep flex items-center justify-center shrink-0">
            <FileText className="size-5 text-ink-mute" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute mb-1">
              Rapport mensuel d'activité
            </p>
            <h2 className="font-sans text-[20px] font-semibold text-ink leading-tight">
              Envoyé chaque 1er du mois · 8h CET
            </h2>
          </div>
        </div>

        <p className="text-sm text-ink-mute leading-relaxed max-w-2xl">
          Format sobre, 1 page maximum, signature humaine Benjamin. Inclut vos chiffres clés du
          mois, les faits marquants détectés automatiquement et une image partageable LinkedIn
          (1080×1080, format business professionnel).
        </p>

        <div className="pt-4 border-t border-rule/40 flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/account#conformite"
            className="inline-flex items-center gap-2 rounded-pill border border-rule/60 bg-paper px-4 py-2 text-sm text-ink hover:bg-cream-deep transition-colors"
          >
            <Mail className="size-4" /> Gérer mes préférences email
          </Link>
        </div>
      </div>

      <HighlightsCard highlights={highlights} />
    </div>
  )
}

// ============================================================
// 4 KPI top — sous-composant (pattern stats-card client)
// ============================================================

interface KpiTopItem {
  label: string
  value: string
  hint?: string
  mono?: boolean
}

function KpiTopCell({ item }: { item: KpiTopItem }) {
  return (
    <div className="rounded-xl border border-rule/60 bg-paper/85 px-4 py-3 shadow-glass-xs">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute mb-1">
        {item.label}
      </div>
      <div
        className={cn(
          'text-base font-semibold text-ink tabular-nums',
          item.mono ? 'font-mono' : 'font-sans',
        )}
      >
        {item.value}
      </div>
      {item.hint ? (
        <div className="font-mono text-[10px] text-ink-mute/80 mt-1 tracking-[0.05em]">
          {item.hint}
        </div>
      ) : null}
    </div>
  )
}
