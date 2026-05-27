/**
 * KOVAS — API verrou de paiement par mission.
 *
 *   GET   /api/payment-lock/[missionId]            → état complet
 *   PATCH /api/payment-lock/[missionId]            → activer/désactiver le verrou
 *   POST  /api/payment-lock/[missionId]            → override "client de confiance" (audit)
 *
 * Authority : CLAUDE.md §3 + §10 RGPD.
 */

import type { PaymentLockReminder, PaymentLockState } from '@/components/payment/ReportLockToggle'
import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface MissionLockRow {
  id: string
  amount_due_cents: number | null
  payment_locked: boolean | null
  payment_received_at: string | null
  payment_override_active: boolean | null
  payment_override_reason: string | null
  payment_override_by: string | null
}

interface ReminderRow {
  id: string
  sent_at: string
  channel: 'email' | 'sms'
  recipient: string
  status: 'sent' | 'opened' | 'clicked' | 'failed'
}

async function loadState(
  supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase'],
  orgId: string,
  missionId: string,
): Promise<PaymentLockState | null> {
  const { data: mission } = await supabase
    .from('missions' as never)
    .select(
      'id, amount_due_cents, payment_locked, payment_received_at, payment_override_active, payment_override_reason, payment_override_by',
    )
    .eq('id', missionId)
    .eq('organization_id', orgId)
    .maybeSingle()

  const row = mission as unknown as MissionLockRow | null
  if (!row) return null

  const { data: reminders } = await supabase
    .from('payment_reminders' as never)
    .select('id, sent_at, channel, recipient, status')
    .eq('mission_id', missionId)
    .eq('organization_id', orgId)
    .order('sent_at', { ascending: false })
    .limit(20)

  const remindersList = ((reminders ?? []) as unknown as ReminderRow[]).map<PaymentLockReminder>(
    (r) => ({
      id: r.id,
      sentAt: r.sent_at,
      channel: r.channel,
      recipient: r.recipient,
      status: r.status,
    }),
  )

  return {
    locked: row.payment_locked ?? false,
    amountDueCents: row.amount_due_cents ?? 0,
    paymentReceivedAt: row.payment_received_at,
    override: row.payment_override_active
      ? {
          active: true,
          reason: row.payment_override_reason,
          by: row.payment_override_by,
        }
      : null,
    reminders: remindersList,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ missionId: string }> },
): Promise<Response> {
  const { missionId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(missionId)) {
    return NextResponse.json({ error: 'invalid_mission_id' }, { status: 400 })
  }

  try {
    const { orgId, supabase } = await getCurrentUser()
    const state = await loadState(supabase, orgId, missionId)
    if (!state) return NextResponse.json({ error: 'mission_not_found' }, { status: 404 })
    return NextResponse.json(state)
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
}

interface PatchBody {
  locked: boolean
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ missionId: string }> },
): Promise<Response> {
  const { missionId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(missionId)) {
    return NextResponse.json({ error: 'invalid_mission_id' }, { status: 400 })
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (typeof body.locked !== 'boolean') {
    return NextResponse.json({ error: 'locked_required' }, { status: 400 })
  }

  try {
    const { orgId, supabase, user } = await getCurrentUser()
    const { error } = await supabase
      .from('missions' as never)
      .update({
        payment_locked: body.locked,
        payment_override_active: false,
        payment_override_reason: null,
        payment_override_by: null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', missionId)
      .eq('organization_id', orgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('audit_log' as never).insert({
      organization_id: orgId,
      user_id: user.id,
      action: body.locked ? 'payment_lock.enable' : 'payment_lock.disable',
      resource_type: 'mission',
      resource_id: missionId,
    } as never)

    const state = await loadState(supabase, orgId, missionId)
    return NextResponse.json(state)
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
}

interface PostBody {
  override: true
  reason: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ missionId: string }> },
): Promise<Response> {
  const { missionId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(missionId)) {
    return NextResponse.json({ error: 'invalid_mission_id' }, { status: 400 })
  }

  let body: PostBody
  try {
    body = (await request.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (body.override !== true || typeof body.reason !== 'string' || body.reason.trim().length < 10) {
    return NextResponse.json({ error: 'invalid_reason' }, { status: 400 })
  }

  try {
    const { orgId, supabase, user } = await getCurrentUser()
    const reason = body.reason.trim()

    const { error } = await supabase
      .from('missions' as never)
      .update({
        payment_locked: false,
        payment_override_active: true,
        payment_override_reason: reason,
        payment_override_by: user.id,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', missionId)
      .eq('organization_id', orgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('audit_log' as never).insert({
      organization_id: orgId,
      user_id: user.id,
      action: 'payment_lock.override',
      resource_type: 'mission',
      resource_id: missionId,
      metadata: { reason } as never,
    } as never)

    const state = await loadState(supabase, orgId, missionId)
    return NextResponse.json(state)
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
}
