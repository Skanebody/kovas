/**
 * PATCH /api/admin/alerts/rules/[id]   → toggle active / update fields
 * DELETE /api/admin/alerts/rules/[id]  → suppression (V1 — préférer toggle active)
 *
 * Toutes les mutations passent par withAuditWrapper.
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import type { AlertSeverity } from '@/lib/admin/alert-engine'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

interface PatchBody {
  active?: unknown
  name?: unknown
  description?: unknown
  threshold_value?: unknown
  severity?: unknown
  cooldown_minutes?: unknown
  notify_email?: unknown
  notify_telegram?: unknown
  notify_telegram_channel?: unknown
}

interface RouteParams {
  params: Promise<{ id: string }>
}

interface RuleLite {
  id: string
  name: string
  active: boolean
}

interface RuleByIdBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      maybeSingle: () => Promise<{
        data: RuleLite | null
        error: { message: string } | null
      }>
    }
  }
}

interface RuleUpdateValues {
  active?: boolean
  name?: string
  description?: string | null
  threshold_value?: number | null
  severity?: AlertSeverity
  cooldown_minutes?: number
  notify_email?: boolean
  notify_telegram?: boolean
  notify_telegram_channel?: string | null
  updated_at?: string
}

interface RuleUpdateBuilder {
  update: (vals: RuleUpdateValues) => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
}

interface RuleDeleteBuilder {
  delete: () => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
}

const ALLOWED_SEVERITIES: AlertSeverity[] = ['info', 'warning', 'critical']

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const { id: ruleId } = await params
  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const lookup = (supabase.from('alert_rules') as unknown as RuleByIdBuilder)
    .select('id, name, active')
    .eq('id', ruleId)
  const { data: existing, error: lookupErr } = await lookup.maybeSingle()
  if (lookupErr || !existing) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  const updates: RuleUpdateValues = { updated_at: new Date().toISOString() }
  if (typeof body.active === 'boolean') updates.active = body.active
  if (typeof body.name === 'string' && body.name.trim().length > 0) {
    updates.name = body.name.trim()
  }
  if (typeof body.description === 'string') {
    updates.description = body.description.trim() || null
  }
  if (body.threshold_value === null) {
    updates.threshold_value = null
  } else if (typeof body.threshold_value === 'number' && Number.isFinite(body.threshold_value)) {
    updates.threshold_value = body.threshold_value
  }
  if (
    typeof body.severity === 'string' &&
    ALLOWED_SEVERITIES.includes(body.severity as AlertSeverity)
  ) {
    updates.severity = body.severity as AlertSeverity
  }
  if (
    typeof body.cooldown_minutes === 'number' &&
    Number.isFinite(body.cooldown_minutes) &&
    body.cooldown_minutes >= 0
  ) {
    updates.cooldown_minutes = Math.floor(body.cooldown_minutes)
  }
  if (typeof body.notify_email === 'boolean') updates.notify_email = body.notify_email
  if (typeof body.notify_telegram === 'boolean') updates.notify_telegram = body.notify_telegram
  if (typeof body.notify_telegram_channel === 'string') {
    updates.notify_telegram_channel = body.notify_telegram_channel.trim() || null
  } else if (body.notify_telegram_channel === null) {
    updates.notify_telegram_channel = null
  }

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'alert_rule_updated',
      targetType: 'alert_rule',
      targetId: ruleId,
      targetLabel: existing.name,
      payload: { changes: updates },
    },
    async () => {
      const updater = supabase.from('alert_rules') as unknown as RuleUpdateBuilder
      const { error } = await updater.update(updates).eq('id', ruleId)
      if (error) throw new Error(error.message)
    },
  )

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }
  // Permission supplémentaire : seul super_admin peut supprimer.
  if (access.role !== 'super_admin') {
    return NextResponse.json({ error: 'super_admin required for delete' }, { status: 403 })
  }

  const { id: ruleId } = await params
  const supabase = createAdminClient()
  const lookup = (supabase.from('alert_rules') as unknown as RuleByIdBuilder)
    .select('id, name, active')
    .eq('id', ruleId)
  const { data: existing } = await lookup.maybeSingle()
  if (!existing) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'alert_rule_deleted',
      targetType: 'alert_rule',
      targetId: ruleId,
      targetLabel: existing.name,
    },
    async () => {
      const deleter = supabase.from('alert_rules') as unknown as RuleDeleteBuilder
      const { error } = await deleter.delete().eq('id', ruleId)
      if (error) throw new Error(error.message)
    },
  )

  return NextResponse.json({ ok: true })
}
