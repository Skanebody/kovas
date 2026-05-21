/**
 * /api/community/cases/[id] — détail d'un cas (lecture + incrément views).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type { CommunityCaseRow } from '@/lib/community/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

interface CaseTable {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      single: () => Promise<{
        data: CommunityCaseRow | null
        error: { message: string } | null
      }>
    }
  }
  update: (patch: Record<string, unknown>) => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
}

function caseTable(supabase: SupabaseClient): CaseTable {
  return (supabase as unknown as { from(t: 'community_cases'): CaseTable }).from('community_cases')
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ case: CommunityCaseRow } | { error: string }>> {
  const { supabase } = await getCurrentUser()
  const { id } = await params

  const { data, error } = await caseTable(supabase)
    .select(
      'id, author_user_id, title, building_type, year_built_range, surface_range, diagnostic_kinds, region_anonymised, context_description, question, decision_made, justification, status, upvotes_count, downvotes_count, responses_count, views_count, tags, created_at, updated_at',
    )
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Cas introuvable' }, { status: 404 })
  }
  if (data.status !== 'approved') {
    return NextResponse.json({ error: 'Cas non publié' }, { status: 404 })
  }

  // Incrément views fire-and-forget (best-effort, on ignore l'éventuelle erreur).
  await caseTable(supabase)
    .update({ views_count: data.views_count + 1 })
    .eq('id', id)

  return NextResponse.json({ case: data }, { headers: { 'Cache-Control': 'no-store' } })
}
