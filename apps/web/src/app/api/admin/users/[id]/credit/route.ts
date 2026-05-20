/**
 * POST /api/admin/users/[id]/credit
 *
 * Accorde un crédit (en euros) à l'organisation primaire.
 * Body : { amount_eur: number, reason: string, confirm_large?: boolean }
 *
 * Si amount_eur > 100 ET !confirm_large → 403 avec flag retry_with_confirmation.
 * Le frontend doit alors poser une confirmation explicite et renvoyer
 * `confirm_large: true`.
 *
 * V1 : pas d'appel Stripe (customer balance adjustment). On stocke uniquement
 * dans l'audit log + payload. La logique de "consommation" du crédit lors du
 * prochain prélèvement est TODO V2 (refacto facturation Stripe).
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

interface Body {
  amount_eur?: number
  reason?: string
  confirm_large?: boolean
}

interface RouteParams {
  params: Promise<{ id: string }>
}

const LARGE_AMOUNT_THRESHOLD_EUR = 100

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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const amountEur = Number(body.amount_eur)
  const reason = (body.reason ?? '').trim()
  const confirmLarge = Boolean(body.confirm_large)

  if (!Number.isFinite(amountEur) || amountEur <= 0) {
    return NextResponse.json({ error: 'amount_eur must be a positive number' }, { status: 400 })
  }
  if (!reason) {
    return NextResponse.json({ error: 'reason required' }, { status: 400 })
  }

  if (amountEur > LARGE_AMOUNT_THRESHOLD_EUR && !confirmLarge) {
    return NextResponse.json(
      {
        error: 'Large credit requires explicit confirmation',
        retry_with_confirmation: true,
        threshold_eur: LARGE_AMOUNT_THRESHOLD_EUR,
      },
      { status: 403 },
    )
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

  const amountCents = Math.round(amountEur * 100)

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'user_credit_granted',
      targetType: 'user',
      targetId: userId,
      targetLabel: profile.email,
      payload: {
        organization_id: orgId,
        amount_eur: amountEur,
        amount_cents: amountCents,
        reason,
        large: amountEur > LARGE_AMOUNT_THRESHOLD_EUR,
        stripe_customer_balance_adjustment: 'TODO_V2',
      },
    },
    async () => {
      // V1 : no DB row required — l'événement est tracé dans admin_audit_log
      // (immutable, append-only). V2 : créer une table `credits_ledger` + appel
      // Stripe customer.balance_adjustment.
      return Promise.resolve()
    },
  )

  revalidatePath(`/admin/users/${userId}`)

  return NextResponse.json({
    ok: true,
    amount_eur: amountEur,
    amount_cents: amountCents,
    stripe: 'stubbed_v1',
  })
}
