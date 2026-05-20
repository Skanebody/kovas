/**
 * POST /api/admin/users/[id]/upgrade
 *
 * Change le plan de l'organisation primaire (upgrade ou downgrade).
 * Body : { new_plan: 'decouverte' | 'standard' | 'volume' | 'founder' | 'cabinet' }
 *
 * V1 : update direct organizations.plan + subscriptions.tier. Pas d'appel Stripe
 * (subscription.update price + prorated invoicing). TODO V2 : appeler Stripe.
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

const ALLOWED_PLANS = ['decouverte', 'standard', 'volume', 'founder', 'cabinet'] as const
type AllowedPlan = (typeof ALLOWED_PLANS)[number]

// Mapping plan FR → tier Stripe EN (subscriptions.tier)
const PLAN_TO_TIER: Record<AllowedPlan, string> = {
  decouverte: 'discovery',
  standard: 'standard',
  volume: 'volume',
  founder: 'standard', // founder = standard à 49€ (cf. CLAUDE.md §6)
  cabinet: 'volume', // approximation V1
}

interface Body {
  new_plan?: string
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
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const newPlan = body.new_plan
  if (!newPlan || !ALLOWED_PLANS.includes(newPlan as AllowedPlan)) {
    return NextResponse.json(
      { error: `new_plan must be one of: ${ALLOWED_PLANS.join(', ')}` },
      { status: 400 },
    )
  }
  const plan = newPlan as AllowedPlan

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

  // Lecture previous plan (audit)
  const { data: prevOrg } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', orgId)
    .maybeSingle<{ plan: string }>()

  const tier = PLAN_TO_TIER[plan]

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'user_plan_changed',
      targetType: 'user',
      targetId: userId,
      targetLabel: profile.email,
      payload: {
        organization_id: orgId,
        from_plan: prevOrg?.plan ?? null,
        to_plan: plan,
        tier,
        stripe_subscription_update: 'TODO_V2',
      },
      previousState: { plan: prevOrg?.plan ?? null },
      newState: { plan },
    },
    async () => {
      const { error: orgErr } = await supabase
        .from('organizations')
        .update({ plan })
        .eq('id', orgId)
      if (orgErr) throw new Error(orgErr.message)

      // Upsert subscription tier (si row existe)
      const { error: subErr } = await supabase
        .from('subscriptions')
        .update({ tier })
        .eq('organization_id', orgId)
      if (subErr) throw new Error(subErr.message)
    },
  )

  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/users')

  return NextResponse.json({ ok: true, new_plan: plan, tier, stripe: 'stubbed_v1' })
}
