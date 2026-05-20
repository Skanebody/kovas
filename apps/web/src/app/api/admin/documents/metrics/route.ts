/**
 * GET /api/admin/documents/metrics
 *
 * Retourne les métriques Document Intelligence (30j) :
 *   - KPI globaux : total scans, success rate, avg confidence, cost, marge
 *   - Type breakdown, correction rate by field
 *   - Top users par volume + coût IA + users proches du quota
 *
 * Gate verifyAdminAccess() puis service-role admin client.
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { getDocumentMetrics } from '@/lib/admin/document-metrics'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const access = await verifyAdminAccess()
  if (!access.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const metrics = await getDocumentMetrics(supabase)

  return NextResponse.json(metrics, { headers: { 'Cache-Control': 'no-store' } })
}
