/**
 * POST /api/admin/milestones/[id]/achieve
 *
 * Marque le palier comme atteint (achieved=true, achieved_at=now()).
 * Audit log via withAuditWrapper.
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import type { MilestoneRow } from '@/lib/admin/milestones-types'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

interface MilestoneSelect {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      maybeSingle: () => Promise<{
        data: MilestoneRow | null
        error: { message: string } | null
      }>
    }
  }
}

interface MilestoneUpdate {
  update: (v: {
    achieved: boolean
    achieved_at: string
    updated_at: string
  }) => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createAdminClient()

  // Récupère le row pour label / vérif existance
  const { data: existing, error: fetchErr } = await (
    supabase.from('milestones') as unknown as MilestoneSelect
  )
    .select('id, name, achieved, target_value, current_value, category')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
  }
  if (existing.achieved) {
    return NextResponse.json({ error: 'Milestone already achieved' }, { status: 400 })
  }

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'milestone_achieved',
      targetType: 'milestone',
      targetId: id,
      targetLabel: existing.name,
      previousState: {
        achieved: false,
        current_value: existing.current_value,
      },
      newState: {
        achieved: true,
        current_value: existing.target_value,
      },
      payload: { category: existing.category, target_value: existing.target_value },
    },
    async () => {
      const { error } = await (supabase.from('milestones') as unknown as MilestoneUpdate)
        .update({
          achieved: true,
          achieved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
  )

  revalidatePath('/admin/paliers')

  return NextResponse.json({ ok: true })
}
