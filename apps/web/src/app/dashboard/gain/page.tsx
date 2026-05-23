import { getCurrentUser } from '@/lib/auth/current-user'
import { DPE_LEGAL_LIMIT, DPE_MISSION_TYPES } from '@/lib/dpe-counter'
import { parisDayBounds, parisMonthBounds } from '@/lib/paris-dates'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { AdemeSection, type AdemeData } from './categories/ademe-section'
import { CabinetSection, type CabinetData } from './categories/cabinet-section'
import { ProductivitySection, type ProductivityData } from './categories/productivity-section'
import { QualitySection, type QualityData } from './categories/quality-section'
import { RevenueSection, type RevenueData } from './categories/revenue-section'
import { FavoritesHeroCard, type FavoriteKpi } from './favorites-hero'
import { HighlightsCard, type Highlight } from './highlights-card'
import { PeriodSelector, type Period } from './period-selector'
import { TrendsLineChart, type TrendsPoint } from './trends-line-chart'

export const metadata: Metadata = { title: 'Performance' }

/**
 * Page /app/gain — Performance personnelle, refonte Apple Santé "Résumé" tab.
 *
 * Hiérarchie :
 *  1. Header sticky : titre + period selector (jour/7j/mois/année)
 *  2. FavoritesHero : 4 KPI hero avec sparklines 30j en background
 *  3. 5 sections catégorielles groupées (Productivité, Revenus, Qualité, Cabinet, ADEME)
 *  4. TrendsLineChart : courbe 12 mois heures + revenus
 *  5. HighlightsCard : 2-3 faits marquants auto-générés (delta > 15%)
 *  6. Footer méthodo
 *
 * Accents catégoriels Apple Santé adaptés DS v5 (cf. category-section.tsx) :
 * vert / bleu / orange / violet / gris — appliqués UNIQUEMENT sur icon
 * background section et border-left 3px subtile sur cards mini.
 *
 * Hypothèses V1 (CLAUDE.md §2) :
 *  - 90 min gagnées par mission terminée (mesure réelle V1.5 via baseline)
 *  - 50 €/h tarif horaire pour valorisation libérée
 *
 * Architecture : server component fetch toutes les data nécessaires en
 * parallèle. Period selector client (?period=…) provoque re-fetch via
 * Next.js searchParams.
 */

const MINUTES_SAVED_PER_MISSION = 90

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

interface MissionWithClient {
  client_id: string | null
  property_id: string | null
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
          eq: (col: string, val: string) => {
            gte: (col: string, val: string) => {
              lt: (col: string, val: string) => Promise<{
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
          eq: (col: string, val: string) => {
            gte: (col: string, val: string) => Promise<{
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

function buildMonthlySparkline(
  missions: MissionRow[],
  daysBack: number,
): number[] {
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

function buildLast12MonthsTrend(
  missions: MissionRow[],
  invoices: InvoiceRow[],
): TrendsPoint[] {
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
  // Cherche le streak en partant d'aujourd'hui
  let streak = 0
  const cursor = new Date()
  for (let i = 0; i < 365; i++) {
    const key = cursor.toISOString().slice(0, 10)
    if (days.has(key)) {
      streak++
    } else if (i > 0) {
      // Si aujourd'hui pas de mission, accepter (en cours) — mais sinon stop
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
// Page principale
// ============================================================

interface GainPageProps {
  searchParams: Promise<{ period?: string }>
}

export default async function GainPage({ searchParams }: GainPageProps) {
  const { period: rawPeriod } = await searchParams
  const period: Period =
    rawPeriod === 'day' || rawPeriod === 'week' || rawPeriod === 'year' || rawPeriod === 'custom'
      ? rawPeriod
      : 'month'

  const { supabase, orgId, profile } = await getCurrentUser()
  const firstName = profile.full_name?.split(' ')[0] ?? 'à vous'

  const current = periodBounds(period)
  const previous = previousPeriodBounds(period)

  // Période 12 mois pour évolution + sparklines (toujours, indépendant de period)
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  twelveMonthsAgo.setDate(1)
  twelveMonthsAgo.setHours(0, 0, 0, 0)

  // Sparklines 30 derniers jours
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

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

  const missionsCurrent = ((missionsCurrentRes.data ?? []) as MissionWithClient[])
  const missionsCurrentRows = ((missionsCurrentRes.data ?? []) as unknown as MissionRow[])
  const missionsPrevious = ((missionsPreviousRes.data ?? []) as MissionRow[])
  const missions12m = ((missions12mRes.data ?? []) as MissionRow[])
  const invoicesCurrent = ((invoicesCurrentRes.data ?? []) as InvoiceRow[])
  const invoicesPrevious = ((invoicesPreviousRes.data ?? []) as InvoiceRow[])
  const invoices12m = ((invoices12mRes.data ?? []) as InvoiceRow[])
  const quotesCurrent = ((quotesCurrentRes.data ?? []) as QuoteRow[])
  const dpe12mCount = ((dpe12mRes.data ?? []) as Array<{ completed_at: string | null }>).length
  const activeClientRows = ((activeClientsRes.data ?? []) as Array<{ client_id: string | null }>)

  // ============================================================
  // KPI HERO favoris
  // ============================================================

  const missionsCurrentCount = missionsCurrentRows.length
  const minutesSavedCurrent = missionsCurrentCount * MINUTES_SAVED_PER_MISSION
  const hoursSavedCurrent = Math.round(minutesSavedCurrent / 60)
  const hoursMinutesCurrent = `${Math.floor(minutesSavedCurrent / 60)}h${String(minutesSavedCurrent % 60).padStart(2, '0')}`

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

  // Sparklines 30j depuis missions 12m
  const sparkMissions = buildMonthlySparkline(missions12m, 30)
  // Pour heures, c'est la même série * 90 mais avec valeurs relatives, sparkline normalisée
  const sparkHours = sparkMissions.map((c) => c * MINUTES_SAVED_PER_MISSION)
  const sparkRevenue = (() => {
    const buckets = new Array(30).fill(0) as number[]
    const now = Date.now()
    for (const inv of invoices12m) {
      if (!inv.issued_at) continue
      if (inv.status === 'draft' || inv.status === 'cancelled') continue
      const t = new Date(inv.issued_at).getTime()
      const daysAgo = Math.floor((now - t) / (24 * 3600 * 1000))
      if (daysAgo >= 0 && daysAgo < 30) {
        buckets[29 - daysAgo] += toNumber(inv.amount_ht)
      }
    }
    return buckets
  })()

  // KPI 4 — note moyenne placeholder (table avis pas en V1)
  // Typage via function pour permettre l'évolution sans dégrader le narrowing TS.
  const avgRating = ((): number | null => null)()

  const heroKpis: [FavoriteKpi, FavoriteKpi, FavoriteKpi, FavoriteKpi] = [
    {
      label: 'Heures gagnées',
      value: hoursSavedCurrent < 100 ? hoursMinutesCurrent : `${hoursSavedCurrent.toLocaleString('fr-FR')}h`,
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
  // Catégories
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
    invoicesCountedCurrent.length > 0
      ? Math.round(caCurrent / invoicesCountedCurrent.length)
      : 0
  const sentQuotes = quotesCurrent.filter((q) =>
    ['sent', 'accepted', 'refused', 'expired'].includes(q.status),
  )
  const acceptedQuotes = quotesCurrent.filter((q) => q.status === 'accepted')
  const conversionRatePct =
    sentQuotes.length > 0
      ? Math.round((acceptedQuotes.length / sentQuotes.length) * 100)
      : null
  const revenueData: RevenueData = {
    caHt: Math.round(caCurrent),
    deltaCaPct: caDeltaPct,
    avgInvoiceEur,
    conversionRatePct,
  }

  // V1.5 placeholders (avis, re-saisie, litiges pas encore trackés)
  const qualityData: QualityData = {
    avgRating: null,
    firstPassRatePct: null,
    litigationCount: 0,
  }

  // Cabinet
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
    activePrescribers: 0, // V1.5 — table prescriber_relationships à connecter
  }

  // ADEME
  const yearStart = new Date(new Date().getFullYear(), 0, 1)
  const dayOfYear = Math.max(
    1,
    Math.floor((Date.now() - yearStart.getTime()) / (1000 * 60 * 60 * 24)),
  )
  const yearlyProjection = Math.round((dpe12mCount / Math.max(dayOfYear, 1)) * 365)
  const ademeData: AdemeData = {
    dpeCount12m: dpe12mCount,
    dpeLimit: DPE_LEGAL_LIMIT,
    yearlyProjection,
    ratioFG: null, // V1.5 — nécessite tracking étiquettes DPE par mission
    avgDistanceKm: null, // V1.5 — nécessite geolocation + planning
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

  // Variables non utilisées (cible TS strict) — pas de noUnusedLocals levé sans erreur
  // missionsCurrent contient client_id/property_id mais nous comptons via missionsCurrentRows
  void missionsCurrent

  const lastUpdate = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header sticky aligné fiche client : paper/95 + backdrop-blur-xl + shadow-glass-sm */}
      <header className="sticky top-0 z-20 -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-b sm:border border-rule/60 bg-paper/95 backdrop-blur-xl px-4 sm:px-7 py-5 shadow-glass-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1 min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
              {firstName === 'à vous' ? 'Performance' : `${firstName} · Performance`}
            </p>
            <h1 className="font-sans text-[28px] font-semibold leading-tight tracking-tight text-ink truncate">
              Résumé,{' '}
              <span className="font-serif italic font-normal text-ink-mute">
                {current.label}.
              </span>
            </h1>
          </div>
          <PeriodSelector current={period} />
        </div>
      </header>

      <div className="space-y-8 pb-12">
        {/* 1. Favoris (4 KPIs hero avec sparklines) */}
        <FavoritesHeroCard periodLabel={current.label} kpis={heroKpis} />

        {/* 2. Productivité */}
        <ProductivitySection data={productivityData} />

        {/* 3. Revenus */}
        <RevenueSection data={revenueData} />

        {/* 4. Qualité */}
        <QualitySection data={qualityData} />

        {/* 5. Cabinet */}
        <CabinetSection data={cabinetData} />

        {/* 6. Conformité ADEME */}
        <AdemeSection data={ademeData} />

        {/* 7. Tendances 12 mois */}
        <TrendsLineChart data={trendsData} />

        {/* 8. Faits marquants */}
        <HighlightsCard highlights={highlights} />

        {/* Footer : timestamp + export */}
        <footer className="flex items-baseline justify-between gap-4 flex-wrap pt-4 border-t border-rule/60">
          <p className="font-mono text-[10px] text-ink-mute tracking-[0.05em]">
            Dernière mise à jour · {lastUpdate}
          </p>
          <a
            href="/dashboard/account"
            className="font-mono text-[11px] text-ink-mute hover:text-ink tracking-[0.05em] transition-colors"
          >
            Exporter mes données →
          </a>
        </footer>

        {/* Méthodo */}
        <p className="font-mono text-[10px] text-ink-mute/80 leading-relaxed">
          Méthodologie · {MINUTES_SAVED_PER_MISSION} min gagnées par mission terminée (référence
          DPE type, CLAUDE.md §2) · valorisation 50 €/h (productivité libérée). Mesure baseline
          réelle prévue V1.5 via tracking comparatif avant/après.
        </p>
      </div>
    </div>
  )
}
