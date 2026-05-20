/**
 * KOVAS — Document Intelligence API : GET /api/quota/scans.
 *
 * Retourne le quota courant (used, included, remaining, planId, overage).
 * Utilisé par le widget transparence permanent (cf. CLAUDE.md §5).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { getQuotaRemaining } from '@/lib/documents/quota-enforcer'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(): Promise<NextResponse> {
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
    const quota = await getQuotaRemaining(userId, supabase)
    return NextResponse.json({ ok: true, quota })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'quota failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
