/**
 * KOVAS — Enregistrement d'une déviation utilisateur vs suggestion paramétrique.
 *
 * POST /api/parameters/suggest/deviation
 *
 * Enrichit `parameter_suggestions` (user_chosen_value + user_reason_for_deviation)
 * pour alimenter l'apprentissage IA continu (cf. CLAUDE.md §7bis).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface DeviationBody {
  cacheKey: string
  parameterName: string
  suggestedValue: string
  userChosenValue: string
  userReasonForDeviation: string | null
  missionId: string | null
}

export async function POST(request: Request): Promise<Response> {
  let userId: string
  let orgId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    userId = u.user.id
    orgId = u.orgId
    supabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: DeviationBody
  try {
    body = (await request.json()) as DeviationBody
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (
    typeof body.cacheKey !== 'string' ||
    typeof body.parameterName !== 'string' ||
    typeof body.userChosenValue !== 'string'
  ) {
    return NextResponse.json({ error: 'invalid_fields' }, { status: 400 })
  }

  const { error } = await supabase.from('parameter_suggestions' as never).insert({
    organization_id: orgId,
    user_id: userId,
    mission_id: body.missionId,
    cache_key: body.cacheKey,
    parameter_name: body.parameterName,
    suggested_value: body.suggestedValue,
    user_chosen_value: body.userChosenValue,
    user_reason_for_deviation: body.userReasonForDeviation,
    deviated: body.suggestedValue !== body.userChosenValue,
  } as never)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
