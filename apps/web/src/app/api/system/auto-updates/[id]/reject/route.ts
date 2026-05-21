/**
 * POST /api/system/auto-updates/[id]/reject
 *
 * Marque une auto-update système comme rejetée (status='rejected').
 * Body : { notes: string } — la raison est OBLIGATOIRE pour rejet.
 *
 * Auth : admin + 2FA. Audit log : `system_auto_update_rejected`.
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { logAdminAction } from '@/lib/admin/audit-log'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface RejectBody {
  notes?: string
}

interface RowShape {
  id: string
  status: string
  title: string
}

interface UpdateBuilder {
  update: (patch: {
    status: string
    reviewed_by: string
    reviewed_at: string
    review_notes: string
  }) => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
}

export async function POST(request: Request, ctx: RouteParams): Promise<Response> {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (access.needs2FA) {
    return NextResponse.json({ error: '2fa_required' }, { status: 403 })
  }
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 })

  let body: RejectBody
  try {
    body = (await request.json()) as RejectBody
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const notes = (body.notes ?? '').trim()
  if (notes.length === 0) {
    return NextResponse.json({ error: 'notes_required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('system_auto_updates')
    .select('id, status, title')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const row = data as RowShape
  if (row.status === 'rejected') {
    return NextResponse.json({ ok: true, idempotent: true, status: 'rejected' })
  }
  if (row.status !== 'pending_review' && row.status !== 'approved') {
    return NextResponse.json(
      { error: 'invalid_status', detail: `cannot reject from status '${row.status}'` },
      { status: 409 },
    )
  }

  const builder = supabase.from('system_auto_updates') as unknown as UpdateBuilder
  const { error: updErr } = await builder
    .update({
      status: 'rejected',
      reviewed_by: access.user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: notes,
    })
    .eq('id', id)
  if (updErr) {
    return NextResponse.json({ error: 'db_error', detail: updErr.message }, { status: 500 })
  }

  await logAdminAction({
    adminUserId: access.user.id,
    actionType: 'system_auto_update_rejected',
    actionSource: 'dashboard_web',
    targetType: 'system_auto_update',
    targetId: id,
    targetLabel: row.title.slice(0, 200),
    payload: { notes },
    succeeded: true,
  })

  return NextResponse.json({ ok: true, status: 'rejected' })
}
