/**
 * PATCH /api/admin/users/[id]/cap
 *
 * Modifie les caps IA personnalisés de l'organisation primaire.
 * Body : { ai_cap_daily_cents?: number | null, ai_cap_monthly_cents?: number | null }
 *
 * `null` = reset au default du plan. Valeur positive = override.
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

interface Body {
  ai_cap_daily_cents?: number | null
  ai_cap_monthly_cents?: number | null
}

interface RouteParams {
  params: Promise<{ id: string }>
}

function validateCap(
  v: unknown,
  name: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (v === null) return { ok: true, value: null }
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    return { ok: false, error: `${name} must be a non-negative number or null` }
  }
  return { ok: true, value: Math.round(v) }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const { id: userId } = await params
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const update: Record<string, number | null> = {}
  if ('ai_cap_daily_cents' in body) {
    const res = validateCap(body.ai_cap_daily_cents, 'ai_cap_daily_cents')
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
    update.ai_cap_daily_cents = res.value
  }
  if ('ai_cap_monthly_cents' in body) {
    const res = validateCap(body.ai_cap_monthly_cents, 'ai_cap_monthly_cents')
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
    update.ai_cap_monthly_cents = res.value
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

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
      actionType: 'user_ai_cap_updated',
      targetType: 'user',
      targetId: userId,
      targetLabel: profile.email,
      payload: { organization_id: orgId, ...update },
    },
    async () => {
      const { error } = await (
        supabase.from('organizations') as unknown as {
          update: (v: Record<string, number | null>) => {
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

  return NextResponse.json({ ok: true })
}
