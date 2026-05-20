/**
 * KOVAS — Document Intelligence API : POST /api/quota/check-and-deduct.
 *
 * Vérifie + déduit 1 scan atomiquement. À utiliser AVANT un appel IA classifier
 * pour les flows hors capture standard (ex : reclassification manuelle).
 *
 * Returns :
 *   - 200 + { ok: true, remaining } si quota dispo
 *   - 402 + { ok: false, reason } si quota épuisé sur tier bloquant
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { checkAndDeductQuota } from '@/lib/documents/quota-enforcer'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(): Promise<NextResponse> {
  let userId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    userId = u.user.id
    supabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await checkAndDeductQuota(userId, supabase)
    if (!result.ok) {
      return NextResponse.json(result, { status: 402 })
    }
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'quota failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
