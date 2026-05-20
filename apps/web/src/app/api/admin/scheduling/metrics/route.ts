/**
 * GET /api/admin/scheduling/metrics
 *
 * Agrège tout le snapshot scheduling admin (precision durée 30j, conflits,
 * top users DPE, clustering adoption, coefficients perso).
 *
 * Auth : verifyAdminAccess() + service-role client (bypass RLS).
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { getSchedulingMetricsSnapshot } from '@/lib/admin/scheduling-metrics'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const { isAdmin, needs2FA } = await verifyAdminAccess()
  if (!isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (needs2FA) {
    return NextResponse.json({ error: '2fa_required' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const snapshot = await getSchedulingMetricsSnapshot(supabase)
    return NextResponse.json({ generated_at: new Date().toISOString(), ...snapshot })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
