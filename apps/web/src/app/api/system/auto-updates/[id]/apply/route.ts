/**
 * POST /api/system/auto-updates/[id]/apply
 *
 * Déclenche l'application d'une auto-update approuvée. Relay vers l'Edge Function
 * `auto-update-apply` qui contient la logique d'écriture en base + rollback_payload.
 *
 * Body : { notes?: string }
 *
 * Pré-conditions :
 *   - status='approved' (sinon 409)
 *
 * Auth : admin + 2FA. Audit log : `system_auto_update_apply_requested` (et l'Edge
 * Function loggera elle-même `system_auto_update_applied`/`...failed`).
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

interface ApplyBody {
  notes?: string
}

interface RowShape {
  id: string
  status: string
  title: string
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

  let body: ApplyBody = {}
  try {
    body = (await request.json()) as ApplyBody
  } catch {
    // body optionnel
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
  if (row.status === 'applied') {
    return NextResponse.json({ ok: true, idempotent: true, status: 'applied' })
  }
  if (row.status !== 'approved') {
    return NextResponse.json(
      { error: 'invalid_status', detail: `status must be 'approved', got '${row.status}'` },
      { status: 409 },
    )
  }

  await logAdminAction({
    adminUserId: access.user.id,
    actionType: 'system_auto_update_apply_requested',
    actionSource: 'dashboard_web',
    targetType: 'system_auto_update',
    targetId: id,
    targetLabel: row.title.slice(0, 200),
    payload: { notes: body.notes ?? null },
    succeeded: true,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'edge_function_not_configured' },
      { status: 500 },
    )
  }

  const edgeUrl = `${supabaseUrl}/functions/v1/auto-update-apply`
  let edgeResp: Response
  try {
    edgeResp = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Edge Function service-to-service : on lui passe la service role key et
        // l'identité de l'admin via le body (audit côté Edge).
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        auto_update_id: id,
        admin_user_id: access.user.id,
        notes: body.notes ?? null,
      }),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    await logAdminAction({
      adminUserId: access.user.id,
      actionType: 'system_auto_update_apply_failed',
      actionSource: 'dashboard_web',
      targetType: 'system_auto_update',
      targetId: id,
      targetLabel: row.title.slice(0, 200),
      succeeded: false,
      errorMessage: msg,
    })
    return NextResponse.json({ error: 'edge_unreachable', detail: msg }, { status: 502 })
  }

  let edgeJson: unknown
  try {
    edgeJson = await edgeResp.json()
  } catch {
    edgeJson = { raw_status: edgeResp.status }
  }

  if (!edgeResp.ok) {
    return NextResponse.json(
      { error: 'edge_function_error', status: edgeResp.status, detail: edgeJson },
      { status: edgeResp.status },
    )
  }

  return NextResponse.json({ ok: true, status: 'applied', edge: edgeJson })
}
