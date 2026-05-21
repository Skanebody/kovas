/**
 * KOVAS — Mutation d'une séquence de relance (pause / resume / cancel).
 *
 * PATCH /api/followup-sequences/[id]  { action: 'pause' | 'resume' | 'cancel' }
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface PatchBody {
  action: 'pause' | 'resume' | 'cancel'
}

const STATUS_MAP: Record<PatchBody['action'], 'paused' | 'active' | 'cancelled'> = {
  pause: 'paused',
  resume: 'active',
  cancel: 'cancelled',
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (!body.action || !(body.action in STATUS_MAP)) {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  }

  try {
    const { orgId, userId, supabase } = await getCurrentUser().then((u) => ({
      orgId: u.orgId,
      userId: u.user.id,
      supabase: u.supabase,
    }))

    const newStatus = STATUS_MAP[body.action]
    const { error } = await supabase
      .from('follow_up_sequences' as never)
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', id)
      .eq('organization_id', orgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('audit_log' as never).insert({
      organization_id: orgId,
      user_id: userId,
      action: `followup_sequence.${body.action}`,
      resource_type: 'followup_sequence',
      resource_id: id,
    } as never)

    return NextResponse.json({ ok: true, status: newStatus })
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
}
