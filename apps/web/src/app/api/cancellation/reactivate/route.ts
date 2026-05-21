/**
 * POST /api/cancellation/reactivate
 *
 * Réactive l'abonnement après usage du winback_code envoyé en email J+7.
 *
 * Validations :
 *   - winbackCode valide (format COMEBACK50-XXXXXXXX)
 *   - cancellation existe + appartient au user courant
 *   - winback_code_used_at IS NULL (jamais utilisé)
 *   - winback_code_expires_at > now() (non expiré)
 *
 * Effets :
 *   - Stripe : cancel_at_period_end = false + applique coupon RETENTION50_3M
 *   - UPDATE cancellations : reactivated_at + winback_code_used_at
 *   - Audit log
 *
 * Body : { winbackCode: string }
 */

import { logAdminAction } from '@/lib/admin/audit-log'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getStripe, isStripeConfigured } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const WINBACK_DISCOUNT_PERCENT = Number.parseInt(
  process.env.WINBACK_DISCOUNT_PERCENT ?? '50',
  10,
)
const WINBACK_DISCOUNT_DURATION_MONTHS = Number.parseInt(
  process.env.WINBACK_DISCOUNT_DURATION_MONTHS ?? '3',
  10,
)

interface RequestBody {
  winbackCode?: unknown
}

interface ReactivateResponse {
  ok: boolean
  error?: string
}

export async function POST(request: Request): Promise<NextResponse<ReactivateResponse>> {
  const { user } = await getCurrentUser()

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 })
  }

  if (typeof body.winbackCode !== 'string' || body.winbackCode.length < 10) {
    return NextResponse.json({ ok: false, error: 'winbackCode required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // SELECT cancellation par code
  const cancRes = (await (
    admin.from('cancellations') as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: {
              id: string
              user_id: string
              subscription_id: string
              winback_code_used_at: string | null
              winback_code_expires_at: string | null
              confirmed_at: string | null
            } | null
          }>
        }
      }
    }
  )
    .select(
      'id, user_id, subscription_id, winback_code_used_at, winback_code_expires_at, confirmed_at',
    )
    .eq('winback_code', body.winbackCode)
    .maybeSingle()) as {
    data: {
      id: string
      user_id: string
      subscription_id: string
      winback_code_used_at: string | null
      winback_code_expires_at: string | null
      confirmed_at: string | null
    } | null
  }

  if (!cancRes.data) {
    return NextResponse.json({ ok: false, error: 'invalid code' }, { status: 404 })
  }
  if (cancRes.data.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  if (cancRes.data.winback_code_used_at) {
    return NextResponse.json({ ok: false, error: 'code already used' }, { status: 409 })
  }
  if (
    cancRes.data.winback_code_expires_at &&
    new Date(cancRes.data.winback_code_expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json({ ok: false, error: 'code expired' }, { status: 410 })
  }
  if (!cancRes.data.confirmed_at) {
    return NextResponse.json(
      { ok: false, error: 'no confirmed cancellation to reactivate' },
      { status: 409 },
    )
  }

  // Charge subscription pour réactivation Stripe
  const subRes = (await admin
    .from('subscriptions')
    .select('id, stripe_subscription_id')
    .eq('id', cancRes.data.subscription_id)
    .maybeSingle()) as {
    data: { id: string; stripe_subscription_id: string | null } | null
  }

  if (!subRes.data) {
    return NextResponse.json({ ok: false, error: 'subscription not found' }, { status: 404 })
  }

  // Stripe : annule le cancel_at_period_end + applique coupon
  try {
    if (isStripeConfigured() && subRes.data.stripe_subscription_id) {
      const stripe = getStripe()
      const couponId = await ensureRetentionCoupon(
        WINBACK_DISCOUNT_PERCENT,
        WINBACK_DISCOUNT_DURATION_MONTHS,
      )
      await stripe.subscriptions.update(subRes.data.stripe_subscription_id, {
        cancel_at_period_end: false,
        discounts: [{ coupon: couponId }],
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'stripe error'
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }

  // UPDATE cancellations
  const nowIso = new Date().toISOString()
  await (
    admin.from('cancellations') as unknown as {
      update: (p: Record<string, string>) => {
        eq: (col: string, val: string) => Promise<{ error: unknown }>
      }
    }
  )
    .update({
      reactivated_at: nowIso,
      winback_code_used_at: nowIso,
    })
    .eq('id', cancRes.data.id)

  // Désactive cancel_at_period_end côté DB
  await (
    admin.from('subscriptions') as unknown as {
      update: (p: Record<string, boolean | string | null>) => {
        eq: (col: string, val: string) => Promise<{ error: unknown }>
      }
    }
  )
    .update({ cancel_at_period_end: false, cancel_reason: null, cancel_feedback: null })
    .eq('id', subRes.data.id)

  await logAdminAction({
    adminUserId: user.id,
    actionType: 'cancellation_reactivated',
    actionSource: 'dashboard_web',
    targetType: 'cancellation',
    targetId: cancRes.data.id,
    payload: { winback_code: body.winbackCode },
    succeeded: true,
  })

  return NextResponse.json({ ok: true })
}

async function ensureRetentionCoupon(
  percent: number,
  durationMonths: number,
): Promise<string> {
  const couponId = `RETENTION${percent}_${durationMonths}M`
  const stripe = getStripe()
  try {
    const existing = await stripe.coupons.retrieve(couponId)
    if (existing && !existing.deleted) return existing.id
  } catch {
    // 404 → create
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
