/**
 * PATCH /api/cancellation/step
 *
 * Marque les step*_seen_at en cours de workflow (utile si la nav se fait
 * principalement côté client, ex: SPA mobile). En V1 le wrapper page server
 * pose déjà ces timestamps, mais on expose la route pour intégrations clientes.
 *
 * Body: { cancellationId: string, step: 1|2 }
 */

import { logAdminAction } from '@/lib/admin/audit-log'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface StepRequest {
  cancellationId?: unknown
  step?: unknown
}

interface StepResponse {
  ok: boolean
  error?: string
}

export async function PATCH(request: Request): Promise<NextResponse<StepResponse>> {
  const { user } = await getCurrentUser()

  let body: StepRequest
  try {
    body = (await request.json()) as StepRequest
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 })
  }

  if (typeof body.cancellationId !== 'string' || body.cancellationId.length < 10) {
    return NextResponse.json({ ok: false, error: 'cancellationId required' }, { status: 400 })
  }
  if (body.step !== 1 && body.step !== 2) {
    return NextResponse.json({ ok: false, error: 'step must be 1 or 2' }, { status: 400 })
  }

  const cancellationId = body.cancellationId
  const stepCol: 'step1_seen_at' | 'step2_seen_at' =
    body.step === 1 ? 'step1_seen_at' : 'step2_seen_at'

  const admin = createAdminClient()

  // Vérifie ownership avant écriture.
  const ownerCheck = (await (
    admin.from('cancellations') as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { user_id: string; confirmed_at: string | null } | null
          }>
        }
      }
    }
  )
    .select('user_id, confirmed_at')
    .eq('id', cancellationId)
    .maybeSingle()) as {
    data: { user_id: string; confirmed_at: string | null } | null
  }

  if (!ownerCheck.data) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  }
  if (ownerCheck.data.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  if (ownerCheck.data.confirmed_at) {
    return NextResponse.json(
      { ok: false, error: 'cancellation already confirmed (immutable)' },
      { status: 409 },
    )
  }

  await (
    admin.from('cancellations') as unknown as {
      update: (patch: Record<string, string>) => {
        eq: (col: string, val: string) => Promise<{ error: unknown }>
      }
    }
  )
    .update({ [stepCol]: new Date().toISOString() })
    .eq('id', cancellationId)

  await logAdminAction({
    adminUserId: user.id,
    actionType: 'cancellation_step_seen',
    actionSource: 'dashboard_web',
    targetType: 'cancellation',
    targetId: cancellationId,
    payload: { step: body.step },
    succeeded: true,
  })

  return NextResponse.json({ ok: true })
}
