/**
 * POST /api/cancellation/accept-alternative
 *
 * Applique une des 3 alternatives proposées au step 2 du workflow :
 *   - "pause"     → met l'abonnement en pause (1 ou 3 mois) côté Stripe + DB
 *   - "discount"  → applique coupon RETENTION50 (-50% sur 3 mois) via Stripe
 *   - "downgrade" → change le plan_code vers un tier inférieur
 *
 * Effets de bord :
 *   - UPDATE cancellations : step2_alternative_offered + accepted=true + détails
 *   - UPDATE subscriptions : selon alternative
 *   - Stripe : sub.pause_collection / discount / item.price selon cas
 *   - Audit log
 *
 * Body : { cancellationId, type: 'pause'|'discount'|'downgrade', pauseMonths?, targetPlanCode? }
 */

import { logAdminAction } from '@/lib/admin/audit-log'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { type KovasPlanId, getPlan, getStripePriceId } from '@/lib/stripe-config'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const WINBACK_DISCOUNT_PERCENT = Number.parseInt(process.env.WINBACK_DISCOUNT_PERCENT ?? '50', 10)
const WINBACK_DISCOUNT_DURATION_MONTHS = Number.parseInt(
  process.env.WINBACK_DISCOUNT_DURATION_MONTHS ?? '3',
  10,
)

interface RequestBody {
  cancellationId?: unknown
  type?: unknown
  pauseMonths?: unknown
  targetPlanCode?: unknown
}

interface SubscriptionRow {
  id: string
  organization_id: string
  stripe_subscription_id: string | null
  plan_code: string | null
}

interface AcceptResponse {
  ok: boolean
  redirect?: string
  error?: string
}

export async function POST(request: Request): Promise<NextResponse<AcceptResponse>> {
  const { user, orgId } = await getCurrentUser()

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 })
  }

  if (typeof body.cancellationId !== 'string') {
    return NextResponse.json({ ok: false, error: 'cancellationId required' }, { status: 400 })
  }
  const type = body.type
  if (type !== 'pause' && type !== 'discount' && type !== 'downgrade') {
    return NextResponse.json({ ok: false, error: 'invalid alternative type' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Vérifie ownership cancellation.
  const cancRes = (await (
    admin.from('cancellations') as unknown as {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: {
              id: string
              user_id: string
              subscription_id: string
              confirmed_at: string | null
            } | null
          }>
        }
      }
    }
  )
    .select('id, user_id, subscription_id, confirmed_at')
    .eq('id', body.cancellationId)
    .maybeSingle()) as {
    data: {
      id: string
      user_id: string
      subscription_id: string
      confirmed_at: string | null
    } | null
  }

  if (!cancRes.data) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  }
  if (cancRes.data.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  if (cancRes.data.confirmed_at) {
    return NextResponse.json({ ok: false, error: 'already confirmed' }, { status: 409 })
  }

  const subRes = (await admin
    .from('subscriptions')
    .select('id, organization_id, stripe_subscription_id, plan_code')
    .eq('id', cancRes.data.subscription_id)
    .maybeSingle()) as { data: SubscriptionRow | null }

  if (!subRes.data || subRes.data.organization_id !== orgId) {
    return NextResponse.json({ ok: false, error: 'subscription mismatch' }, { status: 403 })
  }
  const sub = subRes.data

  // ============================================================
  // Dispatch par type
  // ============================================================
  try {
    if (type === 'pause') {
      const months = body.pauseMonths === 3 ? 3 : 1
      await applyPause(sub, months)
      await updateCancellationAlternative(body.cancellationId, {
        step2_alternative_offered: 'pause',
        step2_alternative_accepted: true,
        step2_pause_duration_months: months,
      })
      await logAdminAction({
        adminUserId: user.id,
        actionType: 'cancellation_alternative_accepted',
        actionSource: 'dashboard_web',
        targetType: 'cancellation',
        targetId: body.cancellationId,
        payload: { type: 'pause', pause_months: months },
        succeeded: true,
      })
      return NextResponse.json({ ok: true, redirect: '/dashboard/account?paused=1' })
    }

    if (type === 'discount') {
      await applyDiscount(sub)
      await updateCancellationAlternative(body.cancellationId, {
        step2_alternative_offered: 'discount',
        step2_alternative_accepted: true,
        step2_discount_percentage: WINBACK_DISCOUNT_PERCENT,
      })
      await logAdminAction({
        adminUserId: user.id,
        actionType: 'cancellation_alternative_accepted',
        actionSource: 'dashboard_web',
        targetType: 'cancellation',
        targetId: body.cancellationId,
        payload: {
          type: 'discount',
          percent: WINBACK_DISCOUNT_PERCENT,
          duration_months: WINBACK_DISCOUNT_DURATION_MONTHS,
        },
        succeeded: true,
      })
      return NextResponse.json({ ok: true, redirect: '/dashboard/account?discount=1' })
    }

    // type === 'downgrade'
    if (typeof body.targetPlanCode !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'targetPlanCode required for downgrade' },
        { status: 400 },
      )
    }
    const targetPlan = getPlan(body.targetPlanCode)
    if (!targetPlan) {
      return NextResponse.json({ ok: false, error: 'unknown targetPlanCode' }, { status: 400 })
    }
    await applyDowngrade(sub, targetPlan.id)
    await updateCancellationAlternative(body.cancellationId, {
      step2_alternative_offered: 'downgrade',
      step2_alternative_accepted: true,
      step2_downgrade_to_plan_code: targetPlan.id,
    })
    await logAdminAction({
      adminUserId: user.id,
      actionType: 'cancellation_alternative_accepted',
      actionSource: 'dashboard_web',
      targetType: 'cancellation',
      targetId: body.cancellationId,
      payload: { type: 'downgrade', target_plan_code: targetPlan.id },
      succeeded: true,
    })
    return NextResponse.json({
      ok: true,
      redirect: `/dashboard/account?downgraded=${targetPlan.id}`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'internal error'
    await logAdminAction({
      adminUserId: user.id,
      actionType: 'cancellation_alternative_failed',
      actionSource: 'dashboard_web',
      targetType: 'cancellation',
      targetId: body.cancellationId,
      payload: { type, error: msg },
      succeeded: false,
      errorMessage: msg,
    })
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// ============================================================
// Helpers — actions Stripe + DB
// ============================================================

async function updateCancellationAlternative(
  cancellationId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const admin = createAdminClient()
  await (
    admin.from('cancellations') as unknown as {
      update: (p: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: unknown }>
      }
    }
  )
    .update(patch)
    .eq('id', cancellationId)
}

async function applyPause(sub: SubscriptionRow, months: 1 | 3): Promise<void> {
  const admin = createAdminClient()
  const now = new Date()
  const ends = new Date(now)
  ends.setMonth(ends.getMonth() + months)

  // Stripe pause_collection (Stripe garde l'abonnement actif mais ne facture pas).
  if (isStripeConfigured() && sub.stripe_subscription_id) {
    await getStripe().subscriptions.update(sub.stripe_subscription_id, {
      pause_collection: {
        behavior: 'keep_as_draft',
        resumes_at: Math.floor(ends.getTime() / 1000),
      },
    })
  }

  await (
    admin.from('subscriptions') as unknown as {
      update: (p: Record<string, string | null>) => {
        eq: (col: string, val: string) => Promise<{ error: unknown }>
      }
    }
  )
    .update({
      pause_started_at: now.toISOString(),
      pause_ends_at: ends.toISOString(),
    })
    .eq('id', sub.id)
}

async function applyDiscount(sub: SubscriptionRow): Promise<void> {
  if (!isStripeConfigured()) {
    // Mode stub : on log mais on n'échoue pas (dev sans Stripe).
    console.log('[cancellation/discount] stub — Stripe not configured')
    return
  }
  if (!sub.stripe_subscription_id) {
    throw new Error('subscription has no stripe_subscription_id')
  }

  const stripe = getStripe()
  const couponId = await ensureRetentionCoupon(
    WINBACK_DISCOUNT_PERCENT,
    WINBACK_DISCOUNT_DURATION_MONTHS,
  )

  await stripe.subscriptions.update(sub.stripe_subscription_id, {
    discounts: [{ coupon: couponId }],
  })
}

async function applyDowngrade(sub: SubscriptionRow, targetPlanId: KovasPlanId): Promise<void> {
  const admin = createAdminClient()

  if (isStripeConfigured() && sub.stripe_subscription_id) {
    const stripe = getStripe()
    const priceId = getStripePriceId(targetPlanId, 'monthly')
    if (priceId) {
      // Récupère l'item courant et met à jour son price.
      const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
      const itemId = current.items.data[0]?.id
      if (itemId) {
        await stripe.subscriptions.update(sub.stripe_subscription_id, {
          items: [{ id: itemId, price: priceId }],
          proration_behavior: 'create_prorations',
        })
      }
    }
  }

  await (
    admin.from('subscriptions') as unknown as {
      update: (p: Record<string, string>) => {
        eq: (col: string, val: string) => Promise<{ error: unknown }>
      }
    }
  )
    .update({ plan_code: targetPlanId })
    .eq('id', sub.id)
}

/**
 * Crée le coupon "RETENTION{percent}" s'il n'existe pas déjà, sinon le retourne.
 */
async function ensureRetentionCoupon(percent: number, durationMonths: number): Promise<string> {
  const couponId = `RETENTION${percent}_${durationMonths}M`
  const stripe = getStripe()
  try {
    const existing = await stripe.coupons.retrieve(couponId)
    if (existing && !existing.deleted) return existing.id
  } catch {
    // 404 → on crée
  }
  const created = await stripe.coupons.create({
    id: couponId,
    percent_off: percent,
    duration: 'repeating',
    duration_in_months: durationMonths,
    name: `Rétention -${percent}% sur ${durationMonths} mois`,
  })
  return created.id
}
