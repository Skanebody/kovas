/**
 * Service calculator finance admin.
 *
 * Toutes les fonctions prennent le client Supabase service-role (créé par
 * createAdminClient() après gate verifyAdminAccess()).
 *
 * Source de vérité MRR : table `subscriptions` (status='active') + prix par tier
 * via KOVAS_TIERS. Stripe events bruts non stockés en BDD V1 → estimations.
 */

import { KOVAS_TIERS, type KovasTier } from '@/lib/stripe-config'
import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type AdminSupabase = SupabaseClient<Database>

// ============================================
// Types publics
// ============================================

export interface MrrSnapshot {
  total: number
  byPlan: Record<string, number>
  growth: { mom: number; momPct: number }
}

export interface MrrHistoryPoint {
  month: string // 'YYYY-MM'
  mrr: number
  byPlan: Record<string, number>
}

export interface TopClient {
  orgId: string
  name: string
  lifetimeRevenue: number
  currentPlan: string
  signedUpAt: string
}

export interface MonthCosts {
  ia: number
  stripe: number
  supabase: number
  resend: number
  total: number
}

export interface MarginPoint {
  month: string
  revenue: number
  costs: number
  marginEur: number
  marginPct: number
}

export interface ProjectionPoint {
  month: string
  mrr: number
}

export interface Projections {
  pessimist: ProjectionPoint[]
  median: ProjectionPoint[]
  optimist: ProjectionPoint[]
}

// ============================================
// Plan IDs connus (KOVAS_TIERS = 3 tiers Phase 1)
// ============================================

const PLAN_IDS = KOVAS_TIERS.map((t) => t.id) as ReadonlyArray<KovasTier['id']>

function emptyByPlan(): Record<string, number> {
  return PLAN_IDS.reduce<Record<string, number>>((acc, id) => {
    acc[id] = 0
    return acc
  }, {})
}

function priceMonthlyEurForTier(tierId: string | null | undefined): number {
  if (!tierId) return 0
  const tier = KOVAS_TIERS.find((t) => t.id === tierId)
  if (!tier) return 0
  return tier.priceMonthlyCents / 100
}

// ============================================
// Helpers date (Europe/Paris)
// ============================================

function monthKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1)
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

// ============================================
// Types des rows utilisés
// ============================================

interface SubscriptionRow {
  tier: string | null
  status: string
  organization_id: string
  created_at: string
}

interface AiUsageRow {
  cost_eur: number | string
  created_at: string
}

interface OrgRow {
  id: string
  name: string
  created_at: string
  plan: string | null
}

interface InvoiceRow {
  amount_ttc: number | string
  paid_at: string | null
}

// ============================================
// 1. MRR snapshot (instantané + delta mois précédent)
// ============================================

export async function calculateMRR(supabase: AdminSupabase): Promise<MrrSnapshot> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('tier, status, organization_id, created_at')
    .eq('status', 'active')

  if (error) {
    throw new Error(`calculateMRR: ${error.message}`)
  }

  const rows = (data ?? []) as SubscriptionRow[]
  const byPlan = emptyByPlan()
  let total = 0
  for (const sub of rows) {
    const price = priceMonthlyEurForTier(sub.tier)
    total += price
    if (sub.tier && byPlan[sub.tier] !== undefined) {
      byPlan[sub.tier] += price
    }
  }

  // Pour delta mois-sur-mois : on prend l'historique (2 derniers points)
  const history = await calculateMRRHistory(supabase, 2)
  const last = history[history.length - 1]?.mrr ?? total
  const prev = history[history.length - 2]?.mrr ?? 0
  const mom = last - prev
  const momPct = prev > 0 ? (mom / prev) * 100 : 0

  return { total, byPlan, growth: { mom, momPct } }
}

// ============================================
// 2. MRR history 12 mois (rétroactif via subscriptions.created_at)
// ============================================

export async function calculateMRRHistory(
  supabase: AdminSupabase,
  months: number,
): Promise<MrrHistoryPoint[]> {
  // V1 : on approxime — pour chaque mois passé, on prend les subs créées avant
  // la fin de ce mois (≈ MRR potentiel à cette date, sans tenir compte des
  // churns intermédiaires, dont on n'a pas l'historique en BDD).
  // TODO V2: real time-series via stripe_events webhook history.
  const { data, error } = await supabase
    .from('subscriptions')
    .select('tier, status, organization_id, created_at')

  if (error) {
    throw new Error(`calculateMRRHistory: ${error.message}`)
  }

  const rows = (data ?? []) as SubscriptionRow[]
  const now = new Date()
  const points: MrrHistoryPoint[] = []

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = addMonths(startOfMonth(now), -i)
    const monthEnd = endOfMonth(monthStart)
    const byPlan = emptyByPlan()
    let mrr = 0

    for (const sub of rows) {
      const createdAt = new Date(sub.created_at)
      // Inclus dans MRR si créé avant la fin du mois ET (status = active OU créé pendant)
      if (createdAt < monthEnd && sub.status === 'active') {
        const price = priceMonthlyEurForTier(sub.tier)
        mrr += price
        if (sub.tier && byPlan[sub.tier] !== undefined) {
          byPlan[sub.tier] += price
        }
      }
    }

    points.push({ month: monthKey(monthStart), mrr, byPlan })
  }

  return points
}

// ============================================
// 3. Top clients lifetime revenue
// ============================================

export async function calculateTopClients(
  supabase: AdminSupabase,
  limit = 10,
): Promise<TopClient[]> {
  // V1 estimation : invoices payées (amount_ttc, paid_at != null) groupées par org.
  // Si une org n'a pas encore d'invoice (early bird), fallback = MRR mensuel × mois depuis création.
  // TODO V2: real Stripe data via webhook history → table stripe_events.

  const [orgsRes, invoicesRes, subsRes] = await Promise.all([
    supabase.from('organizations').select('id, name, created_at, plan').is('deleted_at', null),
    supabase
      .from('invoices')
      .select('organization_id, amount_ttc, paid_at')
      .not('paid_at', 'is', null),
    supabase.from('subscriptions').select('organization_id, tier, status, created_at'),
  ])

  if (orgsRes.error) throw new Error(`calculateTopClients orgs: ${orgsRes.error.message}`)
  if (invoicesRes.error)
    throw new Error(`calculateTopClients invoices: ${invoicesRes.error.message}`)
  if (subsRes.error) throw new Error(`calculateTopClients subs: ${subsRes.error.message}`)

  const orgs = (orgsRes.data ?? []) as OrgRow[]
  const invoices = (invoicesRes.data ?? []) as Array<InvoiceRow & { organization_id: string }>
  const subs = (subsRes.data ?? []) as SubscriptionRow[]

  // Map invoice revenue par org
  const invoicedByOrg = new Map<string, number>()
  for (const inv of invoices) {
    const amt = Number.parseFloat(String(inv.amount_ttc ?? '0'))
    invoicedByOrg.set(inv.organization_id, (invoicedByOrg.get(inv.organization_id) ?? 0) + amt)
  }

  // Map sub (tier courant) par org
  const subByOrg = new Map<string, SubscriptionRow>()
  for (const sub of subs) {
    if (sub.status === 'active') subByOrg.set(sub.organization_id, sub)
  }

  const now = Date.now()
  const rows: TopClient[] = orgs.map((org) => {
    const invoiced = invoicedByOrg.get(org.id) ?? 0
    const sub = subByOrg.get(org.id)
    // Estimation fallback si pas d'invoice : MRR × mois actifs.
    let estimated = invoiced
    if (invoiced === 0 && sub) {
      const monthsActive = Math.max(
        1,
        Math.round((now - new Date(sub.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)),
      )
      estimated = priceMonthlyEurForTier(sub.tier) * monthsActive
    }
    return {
      orgId: org.id,
      name: org.name,
      lifetimeRevenue: estimated,
      currentPlan: sub?.tier ?? org.plan ?? '—',
      signedUpAt: org.created_at,
    }
  })

  rows.sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue)
  return rows.slice(0, limit)
}

// ============================================
// 4. Coûts du mois (IA + Stripe + Supabase + Resend)
// ============================================

const STRIPE_FEE_PCT = 0.015 // 1.5% pour SEPA/CB EU
const STRIPE_FEE_FIXED_EUR = 0.25
const SUPABASE_MONTHLY_FIXED_EUR = 25 // Plan Pro estimé V1
const RESEND_MONTHLY_FIXED_EUR = 20 // ~10-50k emails/mo Pro

export async function calculateMonthCosts(
  supabase: AdminSupabase,
  month: Date,
): Promise<MonthCosts> {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)

  const [aiRes, invoicesRes] = await Promise.all([
    supabase
      .from('ai_usage')
      .select('cost_eur, created_at')
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString()),
    // Stripe fees estimés sur les invoices payées pendant le mois
    // TODO V2: real Stripe data via webhook history (vrais frais payment_intent).
    supabase
      .from('invoices')
      .select('amount_ttc, paid_at')
      .gte('paid_at', monthStart.toISOString())
      .lt('paid_at', monthEnd.toISOString()),
  ])

  if (aiRes.error) throw new Error(`calculateMonthCosts ai: ${aiRes.error.message}`)
  if (invoicesRes.error) {
    throw new Error(`calculateMonthCosts invoices: ${invoicesRes.error.message}`)
  }

  const aiRows = (aiRes.data ?? []) as AiUsageRow[]
  const ia = aiRows.reduce((acc, row) => acc + Number.parseFloat(String(row.cost_eur ?? '0')), 0)

  const invoices = (invoicesRes.data ?? []) as InvoiceRow[]
  const stripe = invoices.reduce((acc, inv) => {
    const amt = Number.parseFloat(String(inv.amount_ttc ?? '0'))
    return acc + amt * STRIPE_FEE_PCT + STRIPE_FEE_FIXED_EUR
  }, 0)

  const supabaseCost = SUPABASE_MONTHLY_FIXED_EUR
  const resend = RESEND_MONTHLY_FIXED_EUR
  const total = ia + stripe + supabaseCost + resend

  return { ia, stripe, supabase: supabaseCost, resend, total }
}

// ============================================
// 5. Marges (CA - coûts) sur N mois
// ============================================

export async function calculateMargins(
  supabase: AdminSupabase,
  months: number,
): Promise<MarginPoint[]> {
  const history = await calculateMRRHistory(supabase, months)
  const now = new Date()

  const points: MarginPoint[] = []
  for (let i = 0; i < history.length; i++) {
    const point = history[i]
    if (!point) continue
    const monthDate = addMonths(startOfMonth(now), -(history.length - 1 - i))
    // CA = MRR du mois + estimation overage (V1 : MRR ≈ revenue ; surplus négligé)
    const revenue = point.mrr
    const costs = await calculateMonthCosts(supabase, monthDate)
    const marginEur = revenue - costs.total
    const marginPct = revenue > 0 ? (marginEur / revenue) * 100 : 0
    points.push({
      month: point.month,
      revenue,
      costs: costs.total,
      marginEur,
      marginPct,
    })
  }

  return points
}

// ============================================
// 6. Projections 3 scénarios (linéaire V1)
// ============================================

export async function calculateProjections(
  supabase: AdminSupabase,
  monthsForward: number,
): Promise<Projections> {
  // Base : 6 derniers mois → croissance moyenne mensuelle absolue (€).
  const history = await calculateMRRHistory(supabase, 6)
  const last = history[history.length - 1]?.mrr ?? 0

  // Croissance moyenne mensuelle (delta absolu €)
  let totalDelta = 0
  let deltaCount = 0
  for (let i = 1; i < history.length; i++) {
    const cur = history[i]
    const prev = history[i - 1]
    if (!cur || !prev) continue
    totalDelta += cur.mrr - prev.mrr
    deltaCount += 1
  }
  const avgDelta = deltaCount > 0 ? totalDelta / deltaCount : 0

  const now = new Date()
  const pessimist: ProjectionPoint[] = []
  const median: ProjectionPoint[] = []
  const optimist: ProjectionPoint[] = []

  let pessVal = last
  let medVal = last
  let optVal = last
  for (let i = 1; i <= monthsForward; i++) {
    const monthStart = addMonths(startOfMonth(now), i)
    const key = monthKey(monthStart)
    pessVal = Math.max(0, pessVal + avgDelta * 0.8)
    medVal = Math.max(0, medVal + avgDelta)
    optVal = Math.max(0, optVal + avgDelta * 1.2)
    pessimist.push({ month: key, mrr: pessVal })
    median.push({ month: key, mrr: medVal })
    optimist.push({ month: key, mrr: optVal })
  }

  return { pessimist, median, optimist }
}
