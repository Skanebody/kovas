/**
 * Moteur d'évaluation des alertes admin (itération 8/N).
 *
 * Lit `alert_rules` (active = true), évalue chaque règle, applique le cooldown,
 * insère un row dans `alert_events` si triggered, puis (placeholder V1) appelle
 * un sender de notification stubbé (juste console.log + flag notified_*).
 *
 * Appelé par :
 *   - /api/cron/check-alerts (Vercel Cron, toutes les 5 minutes)
 *   - Manuellement depuis l'admin (bouton "Forcer un check") — V1.5
 *
 * Toutes les requêtes passent par service_role (bypass RLS). Le caller doit
 * avoir authentifié l'origine (cron secret ou gate admin).
 */

import type { Database, Json } from '@kovas/database/types'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// Types publics
// ============================================

export type AlertSeverity = 'info' | 'warning' | 'critical'

export type AlertFormulaType =
  | 'daily_ia_cost'
  | 'user_daily_ia_cap'
  | 'api_error_rate'
  | 'stripe_webhook_age'
  | 'mrr_milestone'
  | 'signups_anomaly'

export interface AlertFormula {
  type: AlertFormulaType
  /** Fenêtre de calcul en minutes (api_error_rate, stripe_webhook_age). */
  window_minutes?: number
  /** Liste des paliers MRR à observer (mrr_milestone). */
  levels?: number[]
}

export interface AlertRule {
  id: string
  name: string
  description: string | null
  detection_formula: AlertFormula
  threshold_value: number | null
  severity: AlertSeverity
  active: boolean
  cooldown_minutes: number
  notify_email: boolean
  notify_telegram: boolean
  notify_telegram_channel: string | null
  notify_message_template: string | null
  notify_buttons: Json | null
  auto_action: Json | null
  created_at: string
  updated_at: string
}

export interface AlertEvent {
  id: string
  rule_id: string
  target_type: string | null
  target_id: string | null
  target_label: string | null
  actual_value: number | null
  threshold_value: number | null
  payload: Record<string, unknown>
  notified_email: boolean
  notified_telegram: boolean
  resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  resolution_note: string | null
  created_at: string
}

export interface EvaluationResult {
  triggered: boolean
  actual_value?: number
  target_type?: string
  target_id?: string
  target_label?: string
  payload?: Record<string, unknown>
}

export interface RunChecksResult {
  evaluated: number
  triggered: number
  notified: number
  errors: number
}

type AdminSupabase = SupabaseClient<Database>

// ============================================
// Helpers temps
// ============================================

function startOfTodayParisIso(): string {
  const now = new Date()
  const parisStr = now.toLocaleString('en-US', { timeZone: 'Europe/Paris' })
  const paris = new Date(parisStr)
  paris.setHours(0, 0, 0, 0)
  return paris.toISOString()
}

function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'string' ? Number.parseFloat(v) : v
  return Number.isFinite(n) ? n : 0
}

// ============================================
// Casts typés — tables non encore dans Database type généré
// ============================================

interface AlertRuleRow {
  id: string
  name: string
  description: string | null
  detection_formula: Json
  threshold_value: number | string | null
  severity: AlertSeverity
  active: boolean
  cooldown_minutes: number
  notify_email: boolean
  notify_telegram: boolean
  notify_telegram_channel: string | null
  notify_message_template: string | null
  notify_buttons: Json | null
  auto_action: Json | null
  created_at: string
  updated_at: string
}

interface AlertEventRow {
  id: string
  rule_id: string
  target_type: string | null
  target_id: string | null
  target_label: string | null
  actual_value: number | string | null
  threshold_value: number | string | null
  payload: Json
  notified_email: boolean | null
  notified_telegram: boolean | null
  resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  resolution_note: string | null
  created_at: string
}

interface AlertEventInsertRow {
  rule_id: string
  target_type: string | null
  target_id: string | null
  target_label: string | null
  actual_value: number | null
  threshold_value: number | null
  payload: Json
  notified_email: boolean
  notified_telegram: boolean
}

interface AlertRulesQueryBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: boolean,
    ) => Promise<{ data: AlertRuleRow[] | null; error: { message: string } | null }>
  }
}

interface AlertEventsCooldownBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      order: (
        col: string,
        opts: { ascending: boolean },
      ) => {
        limit: (n: number) => {
          maybeSingle: () => Promise<{
            data: { created_at: string } | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
}

interface AlertEventsMilestoneBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      order: (
        col: string,
        opts: { ascending: boolean },
      ) => Promise<{
        data: AlertEventRow[] | null
        error: { message: string } | null
      }>
    }
  }
}

interface AlertEventsInsertBuilder {
  insert: (row: AlertEventInsertRow) => {
    select: (cols: string) => {
      maybeSingle: () => Promise<{
        data: AlertEventRow | null
        error: { message: string } | null
      }>
    }
  }
}

function rowToRule(row: AlertRuleRow): AlertRule {
  const formula = (row.detection_formula ?? { type: 'daily_ia_cost' }) as unknown as AlertFormula
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    detection_formula: formula,
    threshold_value: row.threshold_value === null ? null : toNumber(row.threshold_value),
    severity: row.severity,
    active: row.active,
    cooldown_minutes: row.cooldown_minutes,
    notify_email: row.notify_email,
    notify_telegram: row.notify_telegram,
    notify_telegram_channel: row.notify_telegram_channel,
    notify_message_template: row.notify_message_template,
    notify_buttons: row.notify_buttons,
    auto_action: row.auto_action,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// ============================================
// Loaders
// ============================================

export async function listActiveRules(supabase: AdminSupabase): Promise<AlertRule[]> {
  const builder = supabase.from('alert_rules') as unknown as AlertRulesQueryBuilder
  const { data, error } = await builder.select('*').eq('active', true)
  if (error) {
    console.error('[alert-engine] listActiveRules failed', error)
    return []
  }
  return (data ?? []).map(rowToRule)
}

async function getLastEventForRule(
  supabase: AdminSupabase,
  ruleId: string,
): Promise<{ created_at: string } | null> {
  const builder = supabase.from('alert_events') as unknown as AlertEventsCooldownBuilder
  const { data } = await builder
    .select('created_at')
    .eq('rule_id', ruleId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

async function listMilestoneHistory(
  supabase: AdminSupabase,
  ruleId: string,
): Promise<AlertEventRow[]> {
  const builder = supabase.from('alert_events') as unknown as AlertEventsMilestoneBuilder
  const { data } = await builder
    .select('*')
    .eq('rule_id', ruleId)
    .order('created_at', { ascending: false })
  return data ?? []
}

// ============================================
// Évaluateurs par type de formule
// ============================================

async function evalDailyIaCost(
  supabase: AdminSupabase,
  rule: AlertRule,
): Promise<EvaluationResult> {
  const sinceIso = startOfTodayParisIso()
  const { data, error } = await supabase
    .from('ai_usage')
    .select('cost_eur')
    .gte('created_at', sinceIso)
  if (error || !data) return { triggered: false }

  const total = data.reduce((acc, r) => acc + toNumber(r.cost_eur), 0)
  const threshold = rule.threshold_value ?? 50
  if (total < threshold) return { triggered: false }
  return {
    triggered: true,
    actual_value: total,
    target_type: 'global',
    target_label: "Coût IA aujourd'hui",
    payload: { since: sinceIso, total_eur: total, threshold_eur: threshold },
  }
}

interface SubscriptionCapRow {
  organization_id: string
  monthly_cap_eur: number | string | null
}

interface AiUsageOrgCostRow {
  organization_id: string | null
  cost_eur: number | string | null
}

async function evalUserDailyIaCap(
  supabase: AdminSupabase,
  _rule: AlertRule,
): Promise<EvaluationResult> {
  // V1 : on retourne le premier org en dépassement (1 alerte par run).
  // V2 : émettre 1 alert_event par org dépassant (multi-target).
  const { data: subs, error: subsErr } = await supabase
    .from('subscriptions')
    .select('organization_id, monthly_cap_eur')
    .not('monthly_cap_eur', 'is', null)
  if (subsErr || !subs || subs.length === 0) return { triggered: false }

  const sinceIso = startOfTodayParisIso()
  const orgIds = (subs as SubscriptionCapRow[])
    .map((s) => s.organization_id)
    .filter((id): id is string => Boolean(id))
  const { data: usage, error: usageErr } = await supabase
    .from('ai_usage')
    .select('organization_id, cost_eur')
    .gte('created_at', sinceIso)
    .in('organization_id', orgIds)
  if (usageErr || !usage) return { triggered: false }

  const costByOrg = new Map<string, number>()
  for (const row of usage as AiUsageOrgCostRow[]) {
    if (!row.organization_id) continue
    costByOrg.set(
      row.organization_id,
      (costByOrg.get(row.organization_id) ?? 0) + toNumber(row.cost_eur),
    )
  }

  for (const sub of subs as SubscriptionCapRow[]) {
    const cap = toNumber(sub.monthly_cap_eur)
    if (cap <= 0) continue
    const dailyCap = cap / 30
    const todayCost = costByOrg.get(sub.organization_id) ?? 0
    if (todayCost > dailyCap) {
      return {
        triggered: true,
        actual_value: todayCost,
        target_type: 'organization',
        target_id: sub.organization_id,
        target_label: sub.organization_id,
        payload: {
          monthly_cap_eur: cap,
          daily_cap_eur: dailyCap,
          today_cost_eur: todayCost,
        },
      }
    }
  }
  return { triggered: false }
}

interface ApiErrorEventRow {
  event_type: string
  payload: Json
}

async function evalApiErrorRate(
  supabase: AdminSupabase,
  rule: AlertRule,
): Promise<EvaluationResult> {
  const windowMin = rule.detection_formula.window_minutes ?? 60
  const sinceIso = minutesAgoIso(windowMin)
  // V1 : on lit events.event_type (api.error / api.success) si présents.
  // Si la table n'instrumente pas encore l'erreur, on renvoie triggered=false.
  const { data, error } = await supabase
    .from('events')
    .select('event_type, payload')
    .gte('created_at', sinceIso)
    .like('event_type', 'api.%')
  if (error || !data) return { triggered: false }

  const rows = data as ApiErrorEventRow[]
  if (rows.length === 0) return { triggered: false }
  const errors = rows.filter((r) => r.event_type === 'api.error').length
  const total = rows.length
  const rate = total > 0 ? errors / total : 0
  const threshold = rule.threshold_value ?? 0.05
  if (rate < threshold) return { triggered: false }

  return {
    triggered: true,
    actual_value: rate,
    target_type: 'global',
    target_label: `API ${windowMin}min`,
    payload: { errors, total, rate, threshold, window_minutes: windowMin },
  }
}

interface StripeEventRow {
  created_at: string
}

async function evalStripeWebhookAge(
  supabase: AdminSupabase,
  rule: AlertRule,
): Promise<EvaluationResult> {
  const windowMin = rule.detection_formula.window_minutes ?? 60
  const { data, error } = await supabase
    .from('events')
    .select('created_at')
    .like('event_type', 'stripe.%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<StripeEventRow>()
  if (error) return { triggered: false }

  if (!data) {
    // Aucun webhook Stripe ever — au tout début du projet c'est OK, on ne déclenche pas.
    return { triggered: false }
  }
  const ageMin = (Date.now() - new Date(data.created_at).getTime()) / 60_000
  if (ageMin < windowMin) return { triggered: false }
  return {
    triggered: true,
    actual_value: ageMin,
    target_type: 'global',
    target_label: 'Stripe webhooks',
    payload: { age_minutes: ageMin, threshold_minutes: windowMin },
  }
}

interface SubscriptionMrrRow {
  status: string
  tier: string | null
}

const TIER_PRICE_EUR: Record<string, number> = {
  discovery: 29,
  decouverte: 29,
  standard: 59,
  volume: 99,
  founder: 49,
  cabinet: 199,
}

async function computeMrrApproxEur(supabase: AdminSupabase): Promise<number> {
  // Approximation MRR V1 alignée avec finance-calculator.ts :
  // SUM(prix_tier) sur subscriptions.status = 'active'.
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, tier')
    .eq('status', 'active')
  if (error || !data) return 0
  let total = 0
  for (const row of data as SubscriptionMrrRow[]) {
    const price = row.tier ? (TIER_PRICE_EUR[row.tier] ?? 0) : 0
    total += price
  }
  return total
}

async function evalMrrMilestone(
  supabase: AdminSupabase,
  rule: AlertRule,
): Promise<EvaluationResult> {
  const levels = rule.detection_formula.levels ?? [1000, 5000, 10000, 25000]
  const mrr = await computeMrrApproxEur(supabase)
  if (mrr <= 0) return { triggered: false }

  // Trouve le palier le plus élevé atteint mais non encore notifié.
  const reached = levels.filter((l) => mrr >= l).sort((a, b) => b - a)
  if (reached.length === 0) return { triggered: false }

  const history = await listMilestoneHistory(supabase, rule.id)
  const notified = new Set<number>()
  for (const ev of history) {
    const payload = (ev.payload ?? {}) as Record<string, unknown>
    const lvl = typeof payload.level === 'number' ? payload.level : null
    if (lvl !== null) notified.add(lvl)
  }
  const next = reached.find((l) => !notified.has(l))
  if (next === undefined) return { triggered: false }

  return {
    triggered: true,
    actual_value: mrr,
    target_type: 'global',
    target_label: `MRR ≥ ${next}€`,
    payload: { level: next, mrr_eur: mrr, levels },
  }
}

interface SignupRow {
  created_at: string
}

async function evalSignupsAnomaly(
  supabase: AdminSupabase,
  _rule: AlertRule,
): Promise<EvaluationResult> {
  const since30dIso = daysAgoIso(30)
  const { data, error } = await supabase
    .from('profiles')
    .select('created_at')
    .gte('created_at', since30dIso)
  if (error || !data) return { triggered: false }

  const buckets = new Map<string, number>()
  for (const row of data as SignupRow[]) {
    const day = row.created_at.slice(0, 10)
    buckets.set(day, (buckets.get(day) ?? 0) + 1)
  }
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = buckets.get(today) ?? 0

  const prior: number[] = []
  for (const [day, count] of buckets) {
    if (day !== today) prior.push(count)
  }
  if (prior.length < 7) return { triggered: false } // pas assez d'historique

  const avg = prior.reduce((a, b) => a + b, 0) / prior.length
  const variance = prior.reduce((acc, n) => acc + (n - avg) ** 2, 0) / prior.length
  const stddev = Math.sqrt(variance)
  const threshold = avg + 2 * stddev
  if (todayCount <= threshold || todayCount < 3) return { triggered: false }

  return {
    triggered: true,
    actual_value: todayCount,
    target_type: 'global',
    target_label: 'Signups today',
    payload: {
      today_count: todayCount,
      avg_30d: avg,
      stddev_30d: stddev,
      threshold,
    },
  }
}

async function evaluateRule(supabase: AdminSupabase, rule: AlertRule): Promise<EvaluationResult> {
  switch (rule.detection_formula.type) {
    case 'daily_ia_cost':
      return evalDailyIaCost(supabase, rule)
    case 'user_daily_ia_cap':
      return evalUserDailyIaCap(supabase, rule)
    case 'api_error_rate':
      return evalApiErrorRate(supabase, rule)
    case 'stripe_webhook_age':
      return evalStripeWebhookAge(supabase, rule)
    case 'mrr_milestone':
      return evalMrrMilestone(supabase, rule)
    case 'signups_anomaly':
      return evalSignupsAnomaly(supabase, rule)
    default:
      return { triggered: false }
  }
}

// ============================================
// Cooldown
// ============================================

async function isInCooldown(supabase: AdminSupabase, rule: AlertRule): Promise<boolean> {
  if (rule.cooldown_minutes <= 0) return false
  const last = await getLastEventForRule(supabase, rule.id)
  if (!last) return false
  const ageMin = (Date.now() - new Date(last.created_at).getTime()) / 60_000
  return ageMin < rule.cooldown_minutes
}

// ============================================
// Notification — dispatch vers Telegram bot (itération 13/N partie 2)
// ============================================

function rowToAlertEvent(row: AlertEventRow): AlertEvent {
  return {
    id: row.id,
    rule_id: row.rule_id,
    target_type: row.target_type,
    target_id: row.target_id,
    target_label: row.target_label,
    actual_value: row.actual_value === null ? null : toNumber(row.actual_value),
    threshold_value: row.threshold_value === null ? null : toNumber(row.threshold_value),
    payload: (row.payload ?? {}) as Record<string, unknown>,
    notified_email: row.notified_email ?? false,
    notified_telegram: row.notified_telegram ?? false,
    resolved: row.resolved,
    resolved_at: row.resolved_at,
    resolved_by: row.resolved_by,
    resolution_note: row.resolution_note,
    created_at: row.created_at,
  }
}

async function dispatchNotification(
  supabase: AdminSupabase,
  rule: AlertRule,
  event: AlertEventRow,
): Promise<{ notified_email: boolean; notified_telegram: boolean }> {
  // V1.5 : Telegram opérationnel via notification-sender. Email reste stub
  // (Resend templating à venir — pas de blocker).
  let notifiedEmail = false
  let notifiedTelegram = false

  if (rule.notify_email) {
    // TODO V1.5 : Resend templating spécifique alerts.
    console.warn(`[alert-engine] (email stub) for rule ${rule.name} — event ${event.id}`)
    notifiedEmail = true
  }
  if (rule.notify_telegram) {
    try {
      // Lazy import pour éviter de pull les deps Telegram dans tous les bundles
      // (alert-engine est aussi importé par les routes admin).
      const { sendAlertEventNotification } = await import('@/lib/telegram/notification-sender')
      const ok = await sendAlertEventNotification(supabase, rule, rowToAlertEvent(event))
      notifiedTelegram = ok
    } catch (err) {
      console.error('[alert-engine] telegram notification failed', rule.id, err)
    }
  }
  return { notified_email: notifiedEmail, notified_telegram: notifiedTelegram }
}

// ============================================
// Run principal — appelé par /api/cron/check-alerts
// ============================================

export async function runAlertChecks(supabase: AdminSupabase): Promise<RunChecksResult> {
  const result: RunChecksResult = { evaluated: 0, triggered: 0, notified: 0, errors: 0 }
  const rules = await listActiveRules(supabase)

  for (const rule of rules) {
    try {
      result.evaluated += 1
      if (await isInCooldown(supabase, rule)) continue

      const evalResult = await evaluateRule(supabase, rule)
      if (!evalResult.triggered) continue

      const notif = await prepareNotificationFlags(rule, evalResult)

      const insertRow: AlertEventInsertRow = {
        rule_id: rule.id,
        target_type: evalResult.target_type ?? null,
        target_id: evalResult.target_id ?? null,
        target_label: evalResult.target_label ?? null,
        actual_value: evalResult.actual_value ?? null,
        threshold_value: rule.threshold_value,
        payload: (evalResult.payload ?? {}) as Json,
        notified_email: notif.notified_email,
        notified_telegram: notif.notified_telegram,
      }

      const inserter = supabase.from('alert_events') as unknown as AlertEventsInsertBuilder
      const { data: inserted, error: insErr } = await inserter
        .insert(insertRow)
        .select('*')
        .maybeSingle()
      if (insErr || !inserted) {
        result.errors += 1
        console.error('[alert-engine] insert failed', rule.id, insErr)
        continue
      }
      result.triggered += 1

      const sendFlags = await dispatchNotification(supabase, rule, inserted)
      if (sendFlags.notified_email || sendFlags.notified_telegram) result.notified += 1
    } catch (e) {
      result.errors += 1
      console.error('[alert-engine] rule failed', rule.id, e)
    }
  }

  return result
}

/**
 * Pré-calcule les flags notify_* avant insertion — V1 = simple miroir
 * de la config règle. Dans une V1.5 on pourrait filtrer ici (ex : ne pas
 * spammer Telegram entre 22h et 7h).
 */
function prepareNotificationFlags(
  rule: AlertRule,
  _eval: EvaluationResult,
): Promise<{ notified_email: boolean; notified_telegram: boolean }> {
  return Promise.resolve({
    notified_email: rule.notify_email,
    notified_telegram: rule.notify_telegram,
  })
}

// ============================================
// Service-role helper (pour les cron routes)
// ============================================

/**
 * Variante adminClient simplifiée pour les cron jobs : pas besoin de gate
 * verifyAdminAccess() (le cron est gardé par CRON_SECRET côté route). On ne
 * peut pas réutiliser createAdminClient() directement parce que les routes
 * cron n'ont pas de cookies user — c'est le même client en pratique.
 */
export function createCronSupabaseClient(): AdminSupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'alert-engine: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante.',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
