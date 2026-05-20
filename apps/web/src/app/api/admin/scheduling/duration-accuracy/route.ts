/**
 * GET /api/admin/scheduling/duration-accuracy?days=30
 *
 * Breakdown précision estimation durée par jour (mission_duration_history).
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { getDurationAccuracy } from '@/lib/admin/scheduling-metrics'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { isAdmin, needs2FA } = await verifyAdminAccess()
  if (!isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (needs2FA) {
    return NextResponse.json({ error: '2fa_required' }, { status: 401 })
  }

  const url = new URL(request.url)
  const daysParam = Number(url.searchParams.get('days') ?? '30')
  const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 365 ? daysParam : 30

  try {
    const supabase = createAdminClient()
    const summary = await getDurationAccuracy(supabase, days)
    return NextResponse.json({ generated_at: new Date().toISOString(), ...summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
