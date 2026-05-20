/**
 * GET /api/admin/utilities/adoption
 *
 * Retourne l'adoption des 5 Utilities terrain (30 jours + cohortes 6 mois).
 * Gate verifyAdminAccess() puis service-role admin client.
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { getUtilitiesAdoption } from '@/lib/admin/utilities-metrics'
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
  const adoption = await getUtilitiesAdoption(supabase)

  return NextResponse.json(adoption, { headers: { 'Cache-Control': 'no-store' } })
}
