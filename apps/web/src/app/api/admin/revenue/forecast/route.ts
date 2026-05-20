/**
 * GET /api/admin/revenue/forecast?days=30
 *
 * CA prévisionnel basé sur mission_pricing_snapshots status='estimated'
 * + dossier.scheduled_at dans les `days` prochains jours.
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { getRevenueForecast } from '@/lib/admin/revenue-metrics'
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
  const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 180 ? daysParam : 30

  try {
    const supabase = createAdminClient()
    const forecast = await getRevenueForecast(supabase, days)
    return NextResponse.json({ generated_at: new Date().toISOString(), ...forecast })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
