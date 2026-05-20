/**
 * POST /api/admin/alerts/[id]/resolve
 *
 * Marque un alert_event comme résolu (resolved=true, resolved_at=now,
 * resolved_by=admin, resolution_note=body.note).
 *
 * Body : { note?: string }
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

interface Body {
  note?: string
}

interface RouteParams {
  params: Promise<{ id: string }>
}

interface AlertEventLite {
  id: string
  rule_id: string
  resolved: boolean
  target_label: string | null
}

interface EventByIdBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      maybeSingle: () => Promise<{
        data: AlertEventLite | null
        error: { message: string } | null
      }>
    }
  }
}

interface EventUpdateBuilder {
  update: (vals: {
    resolved: boolean
    resolved_at: string
    resolved_by: string
    resolution_note: string | null
  }) => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const { id: eventId } = await params
  let body: Body = {}
  try {
    body = (await request.json()) as Body
  } catch {
    // Body optionnel
  }
  const note = (body.note ?? '').trim() || null

  const supabase = createAdminClient()
  const adminUserId = access.user.id

  const lookup = (supabase.from('alert_events') as unknown as EventByIdBuilder)
    .select('id, rule_id, resolved, target_label')
    .eq('id', eventId)
  const { data: existing, error: lookupErr } = await lookup.maybeSingle()
  if (lookupErr || !existing) {
    return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
  }
  if (existing.resolved) {
    return NextResponse.json({ error: 'Alert already resolved' }, { status: 409 })
  }

  await withAuditWrapper(
    {
      adminUserId,
      actionType: 'alert_resolved',
      targetType: 'alert',
      targetId: eventId,
      targetLabel: existing.target_label,
      payload: { rule_id: existing.rule_id, note },
    },
    async () => {
      const updater = supabase.from('alert_events') as unknown as EventUpdateBuilder
      const { error } = await updater
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: adminUserId,
          resolution_note: note,
        })
        .eq('id', eventId)
      if (error) throw new Error(error.message)
    },
  )

  return NextResponse.json({ ok: true })
}
