/**
 * POST /api/admin/users/[id]/unsuspend
 *
 * Réactive l'organisation primaire (suspended_at = null, suspension_reason = null).
 * V1 : pas d'appel Stripe (resume_collection). Stub TODO V2.
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

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

  const { id: userId } = await params
  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, default_org_id')
    .eq('id', userId)
    .maybeSingle<{ id: string; email: string; default_org_id: string | null }>()

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  let orgId = profile.default_org_id
  if (!orgId) {
    const { data: mem } = await supabase
      .from('memberships')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle<{ organization_id: string }>()
    orgId = mem?.organization_id ?? null
  }

  if (!orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 })
  }

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'user_reactivated',
      targetType: 'user',
      targetId: userId,
      targetLabel: profile.email,
      payload: { organization_id: orgId, stripe_resume: 'TODO_V2' },
    },
    async () => {
      // suspended_at/suspension_reason absents du Database type (migration récente).
      const update: { suspended_at: null; suspension_reason: null } = {
        suspended_at: null,
        suspension_reason: null,
      }
      const { error } = await (
        supabase.from('organizations') as unknown as {
          update: (v: typeof update) => {
            eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
          }
        }
      )
        .update(update)
        .eq('id', orgId)
      if (error) throw new Error(error.message)
    },
  )

  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/users')

  return NextResponse.json({ ok: true, stripe: 'stubbed_v1' })
}
