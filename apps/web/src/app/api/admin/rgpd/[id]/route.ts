/**
 * PATCH /api/admin/rgpd/[id]
 *
 * Body : { status: 'processing' | 'completed' | 'rejected', notes?: string }
 *
 * Met à jour le statut d'une demande DSAR + journalise l'action dans
 * admin_audit_log (action_type : dsar_status_changed).
 *
 * Règles :
 *   - notes obligatoire si status = completed | rejected
 *   - completed_by_admin = admin courant si status = completed
 *   - completed_at calculé automatiquement par le trigger DB
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import type { DsarStatus, DsarType } from '@/lib/admin/dsar'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

interface Body {
  status?: string
  notes?: string | null
}

interface RouteParams {
  params: Promise<{ id: string }>
}

interface DsarRow {
  id: string
  user_id: string
  type: DsarType
  status: DsarStatus
  notes: string | null
  profiles?: { email: string | null } | null
}

const ALLOWED_STATUSES: DsarStatus[] = ['processing', 'completed', 'rejected']

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const { id } = await params
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const status = (body.status ?? '') as DsarStatus
  const notes = (body.notes ?? '').trim() || null

  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status doit être ${ALLOWED_STATUSES.join(' | ')}` },
      { status: 400 },
    )
  }

  if ((status === 'completed' || status === 'rejected') && !notes) {
    return NextResponse.json(
      { error: 'Note obligatoire pour completed/rejected' },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  // Cast typé : dsar_requests pas dans @kovas/database/types.
  const fetchRes = (await supabase
    .from('dsar_requests')
    .select(
      'id, user_id, type, status, notes, profiles:profiles!user_id(email)',
    )
    .eq('id', id)
    .maybeSingle()) as unknown as {
    data: DsarRow | null
    error: { message: string } | null
  }

  const row = fetchRes.data
  if (!row) {
    return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  }

  if (row.status === 'completed' || row.status === 'rejected') {
    return NextResponse.json(
      { error: 'Demande déjà clôturée — créer une nouvelle demande si besoin' },
      { status: 409 },
    )
  }

  const previousState = { status: row.status, notes: row.notes }
  const newState: {
    status: DsarStatus
    notes: string | null
    completed_by_admin?: string
  } = { status, notes }
  if (status === 'completed' || status === 'rejected') {
    newState.completed_by_admin = access.user.id
  }

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'dsar_status_changed',
      targetType: 'dsar_request',
      targetId: row.id,
      targetLabel: row.profiles?.email ?? row.user_id,
      payload: { dsar_type: row.type, new_status: status },
      previousState,
      newState,
    },
    async () => {
      const { error } = await (
        supabase.from('dsar_requests') as unknown as {
          update: (v: typeof newState) => {
            eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
          }
        }
      )
        .update(newState)
        .eq('id', row.id)
      if (error) throw new Error(error.message)
    },
  )

  revalidatePath('/admin/rgpd')

  return NextResponse.json({ ok: true })
}
