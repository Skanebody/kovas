/**
 * GET /api/scheduling/my-dpe-quota
 *
 * Renvoie le quota DPE du user courant (12 mois glissants, limite légale 1000).
 *
 * Return :
 *   - QuotaWarning si user ≥ 80% du quota (insertion auto dans dpe_quota_alerts si pas dédup)
 *   - { status: 'ok' } si user < 80%
 */

import { checkDpeQuota } from '@/lib/admin/dpe-quota-tracker'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const warning = await checkDpeQuota(user.id, supabase)
    if (!warning) {
      return NextResponse.json({ status: 'ok' })
    }
    return NextResponse.json(warning)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
