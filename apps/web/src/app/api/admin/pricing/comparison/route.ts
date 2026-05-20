/**
 * GET /api/admin/pricing/comparison
 *
 * Moyennes anonymisées des prix HT pratiqués par les users (8 diagnostics MVP)
 * + détection des outliers (≥ 20% écart vs moyenne sur au moins un diag).
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { getPricingComparison } from '@/lib/admin/revenue-metrics'
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
    const comparison = await getPricingComparison(supabase)
    return NextResponse.json({ generated_at: new Date().toISOString(), ...comparison })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
