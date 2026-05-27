/**
 * KOVAS — Récupération du litige actif pour une mission (si existe).
 *
 * GET /api/litigation/by-mission/[missionId]
 */

import type {
  Jurisprudence,
  LitigationData,
  LitigationStatus,
} from '@/components/defense/LitigationWorkflow'
import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface LitigationRow {
  id: string
  status: LitigationStatus
  opened_at: string
  reason: string
  ai_suggested_response: string | null
  jurisprudences: Jurisprudence[] | null
  lawyer_letter_url: string | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ missionId: string }> },
): Promise<Response> {
  const { missionId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(missionId)) {
    return NextResponse.json({ error: 'invalid_mission_id' }, { status: 400 })
  }

  try {
    const { orgId, supabase } = await getCurrentUser()
    const { data } = await supabase
      .from('litigations' as never)
      .select(
        'id, status, opened_at, reason, ai_suggested_response, jurisprudences, lawyer_letter_url',
      )
      .eq('mission_id', missionId)
      .eq('organization_id', orgId)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const row = data as unknown as LitigationRow | null
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const out: LitigationData = {
      id: row.id,
      status: row.status,
      openedAt: row.opened_at,
      reason: row.reason,
      aiSuggestedResponse: row.ai_suggested_response ?? '',
      jurisprudences: Array.isArray(row.jurisprudences) ? row.jurisprudences : [],
      lawyerLetterUrl: row.lawyer_letter_url,
    }
    return NextResponse.json(out)
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
}
