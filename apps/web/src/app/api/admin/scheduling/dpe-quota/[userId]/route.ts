/**
 * GET /api/admin/scheduling/dpe-quota/[userId]
 *
 * Admin-only : lit le quota DPE d'un user donné (12 mois glissants).
 * Bypass RLS via createAdminClient() (gate = verifyAdminAccess).
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { checkDpeQuota } from '@/lib/admin/dpe-quota-tracker'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(_request: Request, ctx: { params: Promise<{ userId: string }> }) {
  const { isAdmin, needs2FA } = await verifyAdminAccess()
  if (!isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (needs2FA) {
    return NextResponse.json({ error: '2fa_required' }, { status: 401 })
  }

  const { userId } = await ctx.params
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: 'invalid userId' }, { status: 400 })
  }

  const supabase = createAdminClient()
  try {
    const warning = await checkDpeQuota(userId, supabase)
    if (!warning) {
      return NextResponse.json({ status: 'ok' })
    }
    return NextResponse.json(warning)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
