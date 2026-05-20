/**
 * PATCH /api/admin/milestones/[id]
 *
 * Update target_value, current_value, description, icon, display_order.
 * Toute action passe par withAuditWrapper.
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

interface PatchBody {
  target_value?: number
  current_value?: number
  description?: string | null
  icon?: string | null
  display_order?: number
  name?: string
}

interface MilestoneUpdateRow {
  target_value?: number
  current_value?: number
  description?: string | null
  icon?: string | null
  display_order?: number
  name?: string
  updated_at?: string
}

interface MilestoneUpdateBuilder {
  update: (v: MilestoneUpdateRow) => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const { id } = await params
  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const update: MilestoneUpdateRow = { updated_at: new Date().toISOString() }
  if (typeof body.target_value === 'number' && body.target_value > 0) {
    update.target_value = body.target_value
  }
  if (typeof body.current_value === 'number' && body.current_value >= 0) {
    update.current_value = body.current_value
  }
  if (typeof body.description === 'string' || body.description === null) {
    update.description = body.description
  }
  if (typeof body.icon === 'string' || body.icon === null) update.icon = body.icon
  if (typeof body.display_order === 'number') update.display_order = body.display_order
  if (typeof body.name === 'string' && body.name.trim().length > 0) {
    update.name = body.name.trim()
  }

  const keys = Object.keys(update).filter((k) => k !== 'updated_at')
  if (keys.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const supabase = createAdminClient()

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'milestone_updated',
      targetType: 'milestone',
      targetId: id,
      payload: update as Record<string, unknown>,
    },
    async () => {
      const { error } = await (supabase.from('milestones') as unknown as MilestoneUpdateBuilder)
        .update(update)
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
  )

  revalidatePath('/admin/paliers')

  return NextResponse.json({ ok: true })
}
