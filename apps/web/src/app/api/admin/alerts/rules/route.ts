/**
 * POST /api/admin/alerts/rules
 *
 * Crée une nouvelle alert_rule. V1 : essentiellement utilisé pour des règles
 * ad-hoc + tests. Les 6 règles standards sont seedées dans la migration SQL.
 *
 * Body : {
 *   name: string
 *   description?: string
 *   detection_formula: { type, ... }
 *   threshold_value?: number
 *   severity: 'info' | 'warning' | 'critical'
 *   cooldown_minutes?: number
 *   notify_email?: boolean
 *   notify_telegram?: boolean
 *   notify_telegram_channel?: string
 * }
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import type { AlertFormula, AlertFormulaType, AlertSeverity } from '@/lib/admin/alert-engine'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Json } from '@kovas/database/types'
import { NextResponse } from 'next/server'

interface Body {
  name?: unknown
  description?: unknown
  detection_formula?: unknown
  threshold_value?: unknown
  severity?: unknown
  cooldown_minutes?: unknown
  notify_email?: unknown
  notify_telegram?: unknown
  notify_telegram_channel?: unknown
}

const ALLOWED_FORMULA_TYPES: AlertFormulaType[] = [
  'daily_ia_cost',
  'user_daily_ia_cap',
  'api_error_rate',
  'stripe_webhook_age',
  'mrr_milestone',
  'signups_anomaly',
]

const ALLOWED_SEVERITIES: AlertSeverity[] = ['info', 'warning', 'critical']

interface AlertRuleInsertRow {
  name: string
  description: string | null
  detection_formula: Json
  threshold_value: number | null
  severity: AlertSeverity
  cooldown_minutes: number
  notify_email: boolean
  notify_telegram: boolean
  notify_telegram_channel: string | null
  created_by: string
}

interface RuleInsertBuilder {
  insert: (row: AlertRuleInsertRow) => {
    select: (cols: string) => {
      maybeSingle: () => Promise<{
        data: { id: string } | null
        error: { message: string } | null
      }>
    }
  }
}

function isFormula(v: unknown): v is AlertFormula {
  if (!v || typeof v !== 'object') return false
  const obj = v as Record<string, unknown>
  return (
    typeof obj.type === 'string' && ALLOWED_FORMULA_TYPES.includes(obj.type as AlertFormulaType)
  )
}

export async function POST(request: Request) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  if (!isFormula(body.detection_formula)) {
    return NextResponse.json({ error: 'detection_formula invalid' }, { status: 400 })
  }
  const severity =
    typeof body.severity === 'string' && ALLOWED_SEVERITIES.includes(body.severity as AlertSeverity)
      ? (body.severity as AlertSeverity)
      : 'warning'

  const description = typeof body.description === 'string' ? body.description.trim() || null : null
  const threshold_value =
    typeof body.threshold_value === 'number' && Number.isFinite(body.threshold_value)
      ? body.threshold_value
      : null
  const cooldown_minutes =
    typeof body.cooldown_minutes === 'number' &&
    Number.isFinite(body.cooldown_minutes) &&
    body.cooldown_minutes >= 0
      ? Math.floor(body.cooldown_minutes)
      : 60
  const notify_email = body.notify_email === true
  const notify_telegram = body.notify_telegram === true
  const notify_telegram_channel =
    typeof body.notify_telegram_channel === 'string'
      ? body.notify_telegram_channel.trim() || null
      : null

  const supabase = createAdminClient()
  const insertRow: AlertRuleInsertRow = {
    name,
    description,
    detection_formula: body.detection_formula as unknown as Json,
    threshold_value,
    severity,
    cooldown_minutes,
    notify_email,
    notify_telegram,
    notify_telegram_channel,
    created_by: access.user.id,
  }

  let createdId = ''
  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'alert_rule_created',
      targetType: 'alert_rule',
      targetId: 'new',
      targetLabel: name,
      payload: { severity, formula_type: (body.detection_formula as AlertFormula).type },
    },
    async () => {
      const inserter = supabase.from('alert_rules') as unknown as RuleInsertBuilder
      const { data, error } = await inserter.insert(insertRow).select('id').maybeSingle()
      if (error || !data) throw new Error(error?.message ?? 'insert failed')
      createdId = data.id
    },
  )

  return NextResponse.json({ ok: true, id: createdId }, { status: 201 })
}
