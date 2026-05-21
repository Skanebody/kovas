/**
 * POST /api/cancellation/init
 *
 * Démarre formellement le workflow de résiliation (INSERT row cancellations).
 *
 * En pratique cette route est rarement appelée directement : la page server
 * `/dashboard/account/cancellation` crée le draft à l'arrivée step=1 via
 * `getOrCreateCancellation`. La route ici sert pour des intégrations futures
 * (mobile / API publique).
 *
 * Auth : utilisateur connecté avec abonnement actif.
 */

import { logAdminAction } from '@/lib/admin/audit-log'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface InitResponse {
  ok: boolean
  cancellationId?: string
  error?: string
}

export async function POST(request: Request): Promise<NextResponse<InitResponse>> {
  const { orgId, user } = await getCurrentUser()

  const admin = createAdminClient()
  const subRes = (await admin
    .from('subscriptions')
    .select('id, status')
    .eq('organization_id', orgId)
    .maybeSingle()) as { data: { id: string; status: string | null } | null }

  if (!subRes.data || subRes.data.status !== 'active') {
    return NextResponse.json(
      { ok: false, error: 'no active subscription' },
      { status: 409 },
    )
  }

  // Vérifier qu'aucune cancellation in-progress n'existe déjà.
  const existing = (await (
    admin.from('cancellations') as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          is: (col: string, val: null) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<{ data: { id: string } | null }>
            }
          }
        }
      }
    }
  )
    .select('id')
    .eq('user_id', user.id)
    .is('confirmed_at', null)
    .limit(1)
    .maybeSingle()) as { data: { id: string } | null }

  if (existing.data) {
    return NextResponse.json({ ok: true, cancellationId: existing.data.id })
  }

  const draftFeedback =
    '[draft cancellation in progress — to be filled at step 3]___'.padEnd(50, '_')

  const inserted = (await (
    admin.from('cancellations') as unknown as {
      insert: (rows: Record<string, unknown>) => {
        select: (cols: string) => {
          single: () => Promise<{
            data: { id: string } | null
            error: { message: string } | null
          }>
        }
      }
    }
  )
    .insert({
      organization_id: orgId,
      user_id: user.id,
      subscription_id: subRes.data.id,
      feedback_text: draftFeedback,
      feedback_category: 'other',
      ip_address: extractIp(request),
      user_agent: request.headers.get('user-agent'),
    })
    .select('id')
    .single()) as { data: { id: string } | null; error: { message: string } | null }

  if (inserted.error || !inserted.data) {
    return NextResponse.json(
      { ok: false, error: inserted.error?.message ?? 'insert failed' },
      { status: 500 },
    )
  }

  await logAdminAction({
    adminUserId: user.id,
    actionType: 'cancellation_initiated',
    actionSource: 'dashboard_web',
    targetType: 'cancellation',
    targetId: inserted.data.id,
    payload: { subscription_id: subRes.data.id },
    succeeded: true,
  })

  return NextResponse.json({ ok: true, cancellationId: inserted.data.id })
}

function extractIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]?.trim() ?? null
  return req.headers.get('x-real-ip')
}
