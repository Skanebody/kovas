/**
 * KOVAS — Tool executor pour le bot Telegram NLP (itération 13/N partie 2).
 *
 * Mappe chaque tool name → handler qui charge la donnée via les libs admin
 * existantes (finance-calculator, ia-analytics, growth-analytics, alert-engine,
 * etc.) et retourne un objet sérialisable côté Claude.
 *
 * Convention :
 * - Les tools `get_*` exécutent directement (lecture seule).
 * - Le tool `add_admin_note` exécute aussi directement (action non destructive,
 *   logguée via withAuditWrapper).
 * - Les tools `request_*` NE SONT PAS exécutés ici — ils sont interceptés en
 *   amont par nlp-handler qui crée un pending_admin_actions et affiche les
 *   boutons inline de confirmation.
 *
 * Erreur strategy : chaque handler peut throw — le caller capture, log et
 * renvoie un tool_result content { error: '...' } à Claude qui formulera
 * une réponse user-friendly.
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { type MrrSnapshot, calculateMRR, calculateMonthCosts } from '@/lib/admin/finance-calculator'
import { getTopConsumers } from '@/lib/admin/ia-analytics'
import {
  loadMilestonesWithProgress,
  splitMilestonesByAchievement,
} from '@/lib/admin/milestones-calculator'
import type Anthropic from '@anthropic-ai/sdk'
import type { Database, Json } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DESTRUCTIVE_TOOL_NAMES } from './destructive-tools'

type AdminSupabase = SupabaseClient<Database>

// ============================================
// Re-export pour les imports externes
// ============================================
export const DESTRUCTIVE_TOOLS = DESTRUCTIVE_TOOL_NAMES

// ============================================
// Types tool result (sérialisé en JSON pour Claude)
// ============================================

export interface ToolCallResult {
  toolUseId: string
  toolName: string
  result: unknown
  error?: string
}

// ============================================
// Helpers temps Europe/Paris
// ============================================

function startOfDayParisIso(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00'
  const y = Number(get('year'))
  const m = Number(get('month'))
  const d = Number(get('day'))
  const utcMidnight = Date.UTC(y, m - 1, d)
  const tzParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'shortOffset',
  }).formatToParts(new Date(utcMidnight))
  const offsetPart = tzParts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+1'
  const offsetMatch = offsetPart.match(/GMT([+-])(\d+)/)
  const sign = offsetMatch?.[1] === '-' ? -1 : 1
  const hours = offsetMatch ? Number(offsetMatch[2]) : 1
  return new Date(utcMidnight - sign * hours * 3600_000).toISOString()
}

function startOfMonthParisIso(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00'
  const y = Number(get('year'))
  const m = Number(get('month'))
  const utcMidnight = Date.UTC(y, m - 1, 1)
  const tzParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'shortOffset',
  }).formatToParts(new Date(utcMidnight))
  const offsetPart = tzParts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+1'
  const offsetMatch = offsetPart.match(/GMT([+-])(\d+)/)
  const sign = offsetMatch?.[1] === '-' ? -1 : 1
  const hours = offsetMatch ? Number(offsetMatch[2]) : 1
  return new Date(utcMidnight - sign * hours * 3600_000).toISOString()
}

function endOfMonthParisIso(date: Date): string {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  return startOfMonthParisIso(next)
}

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'string' ? Number.parseFloat(v) : v
  return Number.isFinite(n) ? n : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(1, Math.floor(value))
}

// ============================================
// 1. get_daily_stats
// ============================================

interface DailyStatsResult {
  date: string
  signups: number
  missions_created: number
  ia_cost_eur: number
  invoices_paid_eur: number
  invoices_count: number
}

async function handleGetDailyStats(
  input: unknown,
  supabase: AdminSupabase,
): Promise<DailyStatsResult> {
  const dateStr = isRecord(input) ? asString(input.date) : null
  const target = dateStr ? new Date(`${dateStr}T12:00:00Z`) : new Date()
  if (Number.isNaN(target.getTime())) {
    throw new Error(`date invalide : "${dateStr}"`)
  }
  const startIso = startOfDayParisIso(target)
  // Fin de jour = début du jour suivant
  const next = new Date(target)
  next.setUTCDate(next.getUTCDate() + 1)
  const endIso = startOfDayParisIso(next)

  const [signupsRes, missionsRes, aiRes, invoicesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('missions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .is('deleted_at', null),
    supabase
      .from('ai_usage')
      .select('cost_eur')
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('invoices')
      .select('amount_ttc, paid_at')
      .gte('paid_at', startIso)
      .lt('paid_at', endIso),
  ])

  const aiCost = (aiRes.data ?? []).reduce<number>((acc, row) => acc + toNumber(row.cost_eur), 0)
  const invoicesPaid = (invoicesRes.data ?? []).reduce<number>(
    (acc, row) => acc + toNumber(row.amount_ttc),
    0,
  )

  return {
    date: startIso.slice(0, 10),
    signups: signupsRes.count ?? 0,
    missions_created: missionsRes.count ?? 0,
    ia_cost_eur: Math.round(aiCost * 100) / 100,
    invoices_paid_eur: Math.round(invoicesPaid * 100) / 100,
    invoices_count: (invoicesRes.data ?? []).length,
  }
}

// ============================================
// 2. get_monthly_stats
// ============================================

interface MonthlyStatsResult {
  month: string
  mrr_eur: number
  mrr_growth_mom_eur: number
  signups: number
  missions: number
  ia_cost_eur: number
  costs_total_eur: number
  gross_margin_pct: number | null
}

async function handleGetMonthlyStats(
  input: unknown,
  supabase: AdminSupabase,
): Promise<MonthlyStatsResult> {
  const monthStr = isRecord(input) ? asString(input.month) : null
  const target = monthStr ? new Date(`${monthStr}-01T12:00:00Z`) : new Date()
  if (Number.isNaN(target.getTime())) {
    throw new Error(`month invalide : "${monthStr}"`)
  }
  const startIso = startOfMonthParisIso(target)
  const endIso = endOfMonthParisIso(target)

  const [mrrSnap, signupsRes, missionsRes, costs] = await Promise.all([
    calculateMRR(supabase),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('missions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .is('deleted_at', null),
    calculateMonthCosts(supabase, target),
  ])

  const revenue = mrrSnap.total
  const margin = revenue > 0 ? ((revenue - costs.total) / revenue) * 100 : null

  return {
    month: startIso.slice(0, 7),
    mrr_eur: Math.round(mrrSnap.total * 100) / 100,
    mrr_growth_mom_eur: Math.round(mrrSnap.growth.mom * 100) / 100,
    signups: signupsRes.count ?? 0,
    missions: missionsRes.count ?? 0,
    ia_cost_eur: Math.round(costs.ia * 100) / 100,
    costs_total_eur: Math.round(costs.total * 100) / 100,
    gross_margin_pct: margin === null ? null : Math.round(margin * 10) / 10,
  }
}

// ============================================
// 3. search_user
// ============================================

interface UserSearchHit {
  user_id: string
  email: string | null
  full_name: string | null
  created_at: string
  current_plan: string | null
  suspended: boolean
}

interface ProfileRow {
  id: string
  email: string | null
  full_name: string | null
  created_at: string
}

interface MembershipRow {
  user_id: string
  organization_id: string
}

interface SubRow {
  organization_id: string
  tier: string | null
  status: string
}

async function handleSearchUser(
  input: unknown,
  supabase: AdminSupabase,
): Promise<{ query: string; results: UserSearchHit[] }> {
  const query = isRecord(input) ? asString(input.query) : null
  if (!query) {
    throw new Error('query manquant')
  }

  // 1. Si query ressemble à un UUID → recherche directe par id
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  let rows: ProfileRow[] = []

  if (uuidRe.test(query)) {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .eq('id', query)
      .limit(1)
    rows = (data ?? []) as ProfileRow[]
  } else {
    // 2. Sinon, ilike sur email et full_name (OR)
    const safe = query.replace(/[%_]/g, '')
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .or(`email.ilike.%${safe}%,full_name.ilike.%${safe}%`)
      .order('created_at', { ascending: false })
      .limit(10)
    rows = (data ?? []) as ProfileRow[]
  }

  if (rows.length === 0) {
    return { query, results: [] }
  }

  // Jointures plan via memberships → subscriptions + suspension via organizations
  const userIds = rows.map((r) => r.id)
  const { data: memberships } = await supabase
    .from('memberships')
    .select('user_id, organization_id')
    .in('user_id', userIds)
    .eq('status', 'active')
  const memRows = (memberships ?? []) as MembershipRow[]

  const orgIds = Array.from(new Set(memRows.map((m) => m.organization_id)))
  const subsByOrg = new Map<string, SubRow>()
  const suspendedOrgs = new Set<string>()
  if (orgIds.length > 0) {
    const [{ data: subs }, orgsRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('organization_id, tier, status')
        .in('organization_id', orgIds)
        .eq('status', 'active'),
      // organizations.suspended_at absent du Database type (migration 2026-05-21
      // 170000_admin_user_actions) → cast typé localement.
      (
        supabase.from('organizations') as unknown as {
          select: (cols: string) => {
            in: (
              col: string,
              vals: string[],
            ) => {
              not: (
                col: string,
                op: string,
                val: null,
              ) => Promise<{
                data: Array<{ id: string; suspended_at: string | null }> | null
                error: { message: string } | null
              }>
            }
          }
        }
      )
        .select('id, suspended_at')
        .in('id', orgIds)
        .not('suspended_at', 'is', null),
    ])
    for (const s of (subs ?? []) as SubRow[]) {
      subsByOrg.set(s.organization_id, s)
    }
    for (const o of orgsRes.data ?? []) {
      if (o.suspended_at !== null) suspendedOrgs.add(o.id)
    }
  }
  const planByUser = new Map<string, string>()
  const suspendedByUser = new Map<string, boolean>()
  for (const m of memRows) {
    const sub = subsByOrg.get(m.organization_id)
    if (sub?.tier && !planByUser.has(m.user_id)) planByUser.set(m.user_id, sub.tier)
    if (suspendedOrgs.has(m.organization_id)) suspendedByUser.set(m.user_id, true)
  }

  const results: UserSearchHit[] = rows.map((r) => ({
    user_id: r.id,
    email: r.email,
    full_name: r.full_name,
    created_at: r.created_at,
    current_plan: planByUser.get(r.id) ?? null,
    suspended: suspendedByUser.get(r.id) ?? false,
  }))

  return { query, results }
}

// ============================================
// 4. get_user_details
// ============================================

interface UserDetailsResult {
  user_id: string
  email: string | null
  full_name: string | null
  created_at: string
  suspended: boolean
  current_plan: string | null
  organization_id: string | null
  monthly_cap_eur: number | null
  ia_cost_this_month_eur: number
  missions_this_month: number
  recent_dossiers: Array<{ id: string; reference: string; status: string; created_at: string }>
}

interface OrgIdRow {
  user_id: string
  organization_id: string
}

interface SubCapRow {
  tier: string | null
  status: string
  monthly_cap_eur: number | string | null
}

async function handleGetUserDetails(
  input: unknown,
  supabase: AdminSupabase,
): Promise<UserDetailsResult> {
  const userId = isRecord(input) ? asString(input.user_id) : null
  if (!userId) throw new Error('user_id manquant')

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, created_at')
    .eq('id', userId)
    .maybeSingle<ProfileRow>()

  if (profileErr) throw new Error(`get_user_details profile : ${profileErr.message}`)
  if (!profile) throw new Error(`user introuvable : ${userId}`)

  // Org + plan + cap + suspension
  const { data: membership } = await supabase
    .from('memberships')
    .select('user_id, organization_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle<OrgIdRow>()

  let plan: string | null = null
  let monthlyCapEur: number | null = null
  let suspended = false
  const orgId = membership?.organization_id ?? null

  if (orgId) {
    const orgBuilder = supabase.from('organizations') as unknown as {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: { suspended_at: string | null } | null
            error: { message: string } | null
          }>
        }
      }
    }
    const [subRes, orgRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('tier, status, monthly_cap_eur')
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .maybeSingle<SubCapRow>(),
      orgBuilder.select('suspended_at').eq('id', orgId).maybeSingle(),
    ])
    if (subRes.data) {
      plan = subRes.data.tier
      monthlyCapEur =
        subRes.data.monthly_cap_eur === null ? null : toNumber(subRes.data.monthly_cap_eur)
    }
    suspended = orgRes.data?.suspended_at !== null && orgRes.data?.suspended_at !== undefined
  }

  // Conso IA mois
  const startIso = startOfMonthParisIso(new Date())
  let iaCostThisMonth = 0
  if (orgId) {
    const { data: usage } = await supabase
      .from('ai_usage')
      .select('cost_eur')
      .eq('organization_id', orgId)
      .gte('created_at', startIso)
    iaCostThisMonth = (usage ?? []).reduce<number>((a, r) => a + toNumber(r.cost_eur), 0)
  }

  // Missions du mois (par l'utilisateur)
  const { count: missionsCount } = await supabase
    .from('missions')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', userId)
    .gte('created_at', startIso)
    .is('deleted_at', null)

  // 5 derniers dossiers
  const { data: dossiers } = await supabase
    .from('dossiers')
    .select('id, reference, status, created_at')
    .eq('created_by', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  return {
    user_id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    created_at: profile.created_at,
    suspended,
    current_plan: plan,
    organization_id: orgId,
    monthly_cap_eur: monthlyCapEur,
    ia_cost_this_month_eur: Math.round(iaCostThisMonth * 100) / 100,
    missions_this_month: missionsCount ?? 0,
    recent_dossiers: (dossiers ?? []).map((d) => ({
      id: d.id,
      reference: d.reference,
      status: d.status,
      created_at: d.created_at,
    })),
  }
}

// ============================================
// 5. get_top_ia_consumers
// ============================================

async function handleGetTopIaConsumers(
  input: unknown,
  supabase: AdminSupabase,
): Promise<{
  consumers: Array<{
    org_id: string
    org_name: string
    cost_eur: number
    calls: number
    percent_of_total: number
  }>
}> {
  const limit = isRecord(input) ? asInteger(input.limit, 10) : 10
  const consumers = await getTopConsumers(supabase, limit)
  return {
    consumers: consumers.map((c) => ({
      org_id: c.orgId,
      org_name: c.orgName,
      cost_eur: Math.round(c.costEur * 100) / 100,
      calls: c.callsCount,
      percent_of_total: Math.round(c.percentOfTotal * 10) / 10,
    })),
  }
}

// ============================================
// 6. get_active_alerts
// ============================================

interface AlertEventRowMin {
  id: string
  rule_id: string
  target_label: string | null
  actual_value: number | string | null
  threshold_value: number | string | null
  payload: Json
  created_at: string
}

interface AlertRuleRowMin {
  id: string
  name: string
  severity: 'info' | 'warning' | 'critical'
}

interface AlertEventsListBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: boolean,
    ) => {
      order: (
        col: string,
        opts: { ascending: boolean },
      ) => {
        limit: (n: number) => Promise<{
          data: AlertEventRowMin[] | null
          error: { message: string } | null
        }>
      }
    }
  }
}

interface AlertRulesListBuilder {
  select: (cols: string) => {
    in: (
      col: string,
      vals: string[],
    ) => Promise<{
      data: AlertRuleRowMin[] | null
      error: { message: string } | null
    }>
  }
}

async function handleGetActiveAlerts(
  input: unknown,
  supabase: AdminSupabase,
): Promise<{
  alerts: Array<{
    id: string
    rule_name: string
    severity: 'info' | 'warning' | 'critical'
    target_label: string | null
    actual_value: number | null
    threshold_value: number | null
    created_at: string
  }>
}> {
  const limit = isRecord(input) ? asInteger(input.limit, 20) : 20

  const eventsBuilder = supabase.from('alert_events') as unknown as AlertEventsListBuilder
  const { data: events } = await eventsBuilder
    .select('id, rule_id, target_label, actual_value, threshold_value, payload, created_at')
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(limit)

  const eventRows = events ?? []
  if (eventRows.length === 0) return { alerts: [] }

  const ruleIds = Array.from(new Set(eventRows.map((e) => e.rule_id)))
  const rulesBuilder = supabase.from('alert_rules') as unknown as AlertRulesListBuilder
  const { data: rules } = await rulesBuilder.select('id, name, severity').in('id', ruleIds)

  const ruleMap = new Map<string, AlertRuleRowMin>()
  for (const r of rules ?? []) ruleMap.set(r.id, r)

  return {
    alerts: eventRows.map((e) => {
      const rule = ruleMap.get(e.rule_id)
      return {
        id: e.id,
        rule_name: rule?.name ?? '(règle inconnue)',
        severity: rule?.severity ?? 'warning',
        target_label: e.target_label,
        actual_value: e.actual_value === null ? null : toNumber(e.actual_value),
        threshold_value: e.threshold_value === null ? null : toNumber(e.threshold_value),
        created_at: e.created_at,
      }
    }),
  }
}

// ============================================
// 7. get_revenue_breakdown
// ============================================

async function handleGetRevenueBreakdown(
  _input: unknown,
  supabase: AdminSupabase,
): Promise<{
  mrr_eur: number
  growth_mom_eur: number
  growth_mom_pct: number
  by_plan: Record<string, number>
}> {
  const snap: MrrSnapshot = await calculateMRR(supabase)
  return {
    mrr_eur: Math.round(snap.total * 100) / 100,
    growth_mom_eur: Math.round(snap.growth.mom * 100) / 100,
    growth_mom_pct: Math.round(snap.growth.momPct * 10) / 10,
    by_plan: Object.fromEntries(
      Object.entries(snap.byPlan).map(([k, v]) => [k, Math.round(v * 100) / 100]),
    ),
  }
}

// ============================================
// 8. get_recent_signups
// ============================================

async function handleGetRecentSignups(
  input: unknown,
  supabase: AdminSupabase,
): Promise<{
  signups: Array<{
    user_id: string
    email: string | null
    full_name: string | null
    created_at: string
    current_plan: string | null
  }>
}> {
  const limit = isRecord(input) ? asInteger(input.limit, 10) : 10

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  const rows = (profiles ?? []) as Array<{
    id: string
    email: string | null
    full_name: string | null
    created_at: string
  }>
  if (rows.length === 0) return { signups: [] }

  const ids = rows.map((r) => r.id)
  const { data: memberships } = await supabase
    .from('memberships')
    .select('user_id, organization_id')
    .in('user_id', ids)
    .eq('status', 'active')
  const memRows = (memberships ?? []) as MembershipRow[]
  const orgIds = Array.from(new Set(memRows.map((m) => m.organization_id)))
  const subsByOrg = new Map<string, string | null>()
  if (orgIds.length > 0) {
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('organization_id, tier, status')
      .in('organization_id', orgIds)
      .eq('status', 'active')
    for (const s of (subs ?? []) as SubRow[]) subsByOrg.set(s.organization_id, s.tier)
  }
  const planByUser = new Map<string, string | null>()
  for (const m of memRows) {
    const tier = subsByOrg.get(m.organization_id) ?? null
    if (tier && !planByUser.has(m.user_id)) planByUser.set(m.user_id, tier)
  }

  return {
    signups: rows.map((r) => ({
      user_id: r.id,
      email: r.email,
      full_name: r.full_name,
      created_at: r.created_at,
      current_plan: planByUser.get(r.id) ?? null,
    })),
  }
}

// ============================================
// 9. get_milestones_progress
// ============================================

async function handleGetMilestonesProgress(
  input: unknown,
  supabase: AdminSupabase,
): Promise<{
  in_progress: Array<{
    name: string
    category: string
    current_value: number
    target_value: number
    progress_pct: number
    unit: string | null
  }>
  achieved_count: number
}> {
  const category = isRecord(input) ? asString(input.category) : null
  const all = await loadMilestonesWithProgress(supabase)
  const { achieved, inProgress } = splitMilestonesByAchievement(all)

  let filtered = inProgress
  if (category) {
    filtered = filtered.filter((m) => m.category === category)
  }

  return {
    in_progress: filtered.slice(0, 10).map((m) => ({
      name: m.name,
      category: m.category,
      current_value: m.current_value ?? 0,
      target_value: m.target_value,
      progress_pct: Math.round(m.progress * 1000) / 10,
      unit: m.unit,
    })),
    achieved_count: achieved.length,
  }
}

// ============================================
// 10. get_health_status
// ============================================

interface AnthropicHealthRow {
  created_at: string
}
interface SubHealthRow {
  updated_at: string
}

async function handleGetHealthStatus(
  _input: unknown,
  supabase: AdminSupabase,
): Promise<{
  supabase_status: 'green' | 'orange' | 'red'
  anthropic_last_call_minutes_ago: number | null
  stripe_last_sub_update_hours_ago: number | null
  queued_jobs: number
}> {
  // Supabase : on mesure latence d'un count head
  const t0 = Date.now()
  const { error: supaErr } = await supabase
    .from('admin_users')
    .select('user_id', { count: 'exact', head: true })
  const supaLatency = Date.now() - t0
  const supaStatus: 'green' | 'orange' | 'red' = supaErr
    ? 'red'
    : supaLatency < 200
      ? 'green'
      : supaLatency < 1000
        ? 'orange'
        : 'red'

  // Anthropic : dernier appel
  const { data: lastAi } = await supabase
    .from('ai_usage')
    .select('created_at')
    .eq('provider', 'anthropic')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<AnthropicHealthRow>()

  const anthropicAgeMin = lastAi
    ? Math.floor((Date.now() - new Date(lastAi.created_at).getTime()) / 60_000)
    : null

  // Stripe : dernière subscription updated_at
  const { data: lastSub } = await supabase
    .from('subscriptions')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubHealthRow>()

  const stripeAgeHours = lastSub
    ? Math.floor((Date.now() - new Date(lastSub.updated_at).getTime()) / 3_600_000)
    : null

  const { count: jobsCount } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'queued')

  return {
    supabase_status: supaStatus,
    anthropic_last_call_minutes_ago: anthropicAgeMin,
    stripe_last_sub_update_hours_ago: stripeAgeHours,
    queued_jobs: jobsCount ?? 0,
  }
}

// ============================================
// 11. add_admin_note (exécution directe + audit)
// ============================================

interface AdminNoteInsertRow {
  user_id: string
  note: string
  created_by: string
}

interface AdminNotesInserter {
  insert: (row: AdminNoteInsertRow) => Promise<{ error: { message: string } | null }>
}

async function handleAddAdminNote(
  input: unknown,
  supabase: AdminSupabase,
  adminUserId: string,
): Promise<{ ok: true; user_id: string }> {
  const userId = isRecord(input) ? asString(input.user_id) : null
  const note = isRecord(input) ? asString(input.note) : null
  if (!userId) throw new Error('user_id manquant')
  if (!note) throw new Error('note manquante')
  if (note.length > 1000) throw new Error('note trop longue (>1000 caractères)')

  await withAuditWrapper(
    {
      adminUserId,
      actionType: 'admin_note_added',
      targetType: 'user',
      targetId: userId,
      payload: { note, source: 'telegram_bot_nlp' },
    },
    async () => {
      const inserter = supabase.from('admin_notes') as unknown as AdminNotesInserter
      const { error } = await inserter.insert({
        user_id: userId,
        note,
        created_by: adminUserId,
      })
      if (error) throw new Error(`admin_notes insert : ${error.message}`)
    },
  )

  return { ok: true, user_id: userId }
}

// ============================================
// Dispatcher
// ============================================

export async function executeToolCalls(
  toolUses: Anthropic.ToolUseBlock[],
  supabase: AdminSupabase,
  adminUserId: string,
): Promise<ToolCallResult[]> {
  const results: ToolCallResult[] = []
  for (const tu of toolUses) {
    // Les tools destructifs ne doivent JAMAIS arriver ici (interceptés par nlp-handler).
    if (DESTRUCTIVE_TOOL_NAMES.has(tu.name)) {
      results.push({
        toolUseId: tu.id,
        toolName: tu.name,
        result: null,
        error: `${tu.name} est destructif — confirmation requise via boutons`,
      })
      continue
    }

    try {
      let result: unknown
      switch (tu.name) {
        case 'get_daily_stats':
          result = await handleGetDailyStats(tu.input, supabase)
          break
        case 'get_monthly_stats':
          result = await handleGetMonthlyStats(tu.input, supabase)
          break
        case 'search_user':
          result = await handleSearchUser(tu.input, supabase)
          break
        case 'get_user_details':
          result = await handleGetUserDetails(tu.input, supabase)
          break
        case 'get_top_ia_consumers':
          result = await handleGetTopIaConsumers(tu.input, supabase)
          break
        case 'get_active_alerts':
          result = await handleGetActiveAlerts(tu.input, supabase)
          break
        case 'get_revenue_breakdown':
          result = await handleGetRevenueBreakdown(tu.input, supabase)
          break
        case 'get_recent_signups':
          result = await handleGetRecentSignups(tu.input, supabase)
          break
        case 'get_milestones_progress':
          result = await handleGetMilestonesProgress(tu.input, supabase)
          break
        case 'get_health_status':
          result = await handleGetHealthStatus(tu.input, supabase)
          break
        case 'add_admin_note':
          result = await handleAddAdminNote(tu.input, supabase, adminUserId)
          break
        default:
          throw new Error(`tool inconnu : ${tu.name}`)
      }
      results.push({ toolUseId: tu.id, toolName: tu.name, result })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error'
      results.push({ toolUseId: tu.id, toolName: tu.name, result: null, error: msg })
    }
  }
  return results
}
