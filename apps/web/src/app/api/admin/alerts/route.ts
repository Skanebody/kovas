/**
 * GET /api/admin/alerts
 *
 * Liste les rules (toutes, actives + inactives) + events actifs (resolved=false).
 * Gate verifyAdminAccess() puis service_role.
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import type { AlertRule } from '@/lib/admin/alert-engine'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Json } from '@kovas/database/types'
import { NextResponse } from 'next/server'

interface AlertRuleRow {
  id: string
  name: string
  description: string | null
  detection_formula: Json
  threshold_value: number | string | null
  severity: 'info' | 'warning' | 'critical'
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

export interface AlertEventDto {
  id: string
  rule_id: string
  rule_name: string
  rule_severity: 'info' | 'warning' | 'critical'
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

interface AlertEventJoinRow {
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
  alert_rules:
    | { name: string; severity: 'info' | 'warning' | 'critical' }
    | { name: string; severity: 'info' | 'warning' | 'critical' }[]
    | null
}

export interface AlertsListResponse {
  rules: AlertRule[]
  active_events: AlertEventDto[]
  recent_resolved: AlertEventDto[]
  counts: {
    active_critical: number
    active_warning: number
    active_info: number
    resolved_7d: number
    rules_active: number
  }
}

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'string' ? Number.parseFloat(v) : v
  return Number.isFinite(n) ? n : null
}

function rowToRule(row: AlertRuleRow): AlertRule {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    detection_formula: (row.detection_formula ?? {
      type: 'daily_ia_cost',
    }) as unknown as AlertRule['detection_formula'],
    threshold_value: toNum(row.threshold_value),
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

function rowToEvent(row: AlertEventJoinRow): AlertEventDto {
  const joined = Array.isArray(row.alert_rules) ? row.alert_rules[0] : row.alert_rules
  return {
    id: row.id,
    rule_id: row.rule_id,
    rule_name: joined?.name ?? '(règle supprimée)',
    rule_severity: joined?.severity ?? 'warning',
    target_type: row.target_type,
    target_id: row.target_id,
    target_label: row.target_label,
    actual_value: toNum(row.actual_value),
    threshold_value: toNum(row.threshold_value),
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

interface RulesQuery {
  select: (cols: string) => {
    order: (
      col: string,
      opts: { ascending: boolean },
    ) => Promise<{
      data: AlertRuleRow[] | null
      error: { message: string } | null
    }>
  }
}

interface EventsActiveQuery {
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
          data: AlertEventJoinRow[] | null
          error: { message: string } | null
        }>
      }
    }
  }
}

interface EventsResolvedQuery {
  select: (cols: string) => {
    eq: (
      col: string,
      val: boolean,
    ) => {
      gte: (
        col: string,
        val: string,
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          limit: (n: number) => Promise<{
            data: AlertEventJoinRow[] | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
}

export async function GET() {
  const access = await verifyAdminAccess()
  if (!access.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const rulesQuery = (supabase.from('alert_rules') as unknown as RulesQuery)
    .select('*')
    .order('created_at', { ascending: false })

  const activeQuery = (supabase.from('alert_events') as unknown as EventsActiveQuery)
    .select('*, alert_rules:rule_id (name, severity)')
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(100)

  const resolvedQuery = (supabase.from('alert_events') as unknown as EventsResolvedQuery)
    .select('*, alert_rules:rule_id (name, severity)')
    .eq('resolved', true)
    .gte('created_at', sevenDaysAgoIso)
    .order('resolved_at', { ascending: false })
    .limit(30)

  const [rulesRes, activeRes, resolvedRes] = await Promise.all([
    rulesQuery,
    activeQuery,
    resolvedQuery,
  ])

  if (rulesRes.error) {
    console.error('[api/admin/alerts] rules failed', rulesRes.error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const rules = (rulesRes.data ?? []).map(rowToRule)
  const activeEvents = (activeRes.data ?? []).map(rowToEvent)
  const recentResolved = (resolvedRes.data ?? []).map(rowToEvent)

  let active_critical = 0
  let active_warning = 0
  let active_info = 0
  for (const ev of activeEvents) {
    if (ev.rule_severity === 'critical') active_critical += 1
    else if (ev.rule_severity === 'warning') active_warning += 1
    else active_info += 1
  }
  const rules_active = rules.filter((r) => r.active).length

  const response: AlertsListResponse = {
    rules,
    active_events: activeEvents,
    recent_resolved: recentResolved,
    counts: {
      active_critical,
      active_warning,
      active_info,
      resolved_7d: recentResolved.length,
      rules_active,
    },
  }

  return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } })
}
