/**
 * POST /api/admin/users/[id]/suspend
 *
 * Suspend l'organisation primaire du user (suspended_at = now()).
 * Body : { reason: string }
 *
 * V1 : pas d'appel Stripe (pause_collection). À implémenter V2 quand Stripe SDK
 * est installé et configuré. Pour l'instant on log un TODO dans le payload.
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

interface Body {
  reason?: string
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const { id: userId } = await params
  let body: Body = {}
  try {
    body = (await request.json()) as Body
  } catch {
    // Body optionnel
  }
  const reason = (body.reason ?? '').trim()

  const supabase = createAdminClient()

  // Trouver l'org primaire
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
    return NextResponse.json({ error: 'No organization to suspend' }, { status: 400 })
  }

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'user_suspended',
      targetType: 'user',
      targetId: userId,
      targetLabel: profile.email,
      payload: { reason, organization_id: orgId, stripe_pause: 'TODO_V2' },
    },
    async () => {
      // organizations.suspended_at/suspension_reason absents du Database type
      // (migration 20260521170000, types à régénérer via `pnpm db:gen-types`).
      // Cast typé local.
      const update: { suspended_at: string; suspension_reason: string | null } = {
        suspended_at: new Date().toISOString(),
        suspension_reason: reason || null,
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
