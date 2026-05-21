/**
 * /api/community/cases/[id]/responses — fil de discussion d'un cas.
 *
 *  - GET  : liste des réponses `published`
 *  - POST : crée une réponse (status `published`)
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type { CommunityCaseResponseRow } from '@/lib/community/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

interface ResponsesTable {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      eq: (
        col: string,
        val: string,
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{
          data: CommunityCaseResponseRow[] | null
          error: { message: string } | null
        }>
      }
    }
  }
  insert: (row: Record<string, unknown>) => {
    select: (cols: string) => {
      single: () => Promise<{
        data: CommunityCaseResponseRow | null
        error: { message: string } | null
      }>
    }
  }
}

interface CasesTable {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      single: () => Promise<{
        data: { responses_count: number } | null
        error: { message: string } | null
      }>
    }
  }
  update: (patch: Record<string, unknown>) => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
}

function responsesTable(supabase: SupabaseClient): ResponsesTable {
  return (supabase as unknown as { from(t: 'community_case_responses'): ResponsesTable }).from(
    'community_case_responses',
  )
}
function casesTable(supabase: SupabaseClient): CasesTable {
  return (supabase as unknown as { from(t: 'community_cases'): CasesTable }).from('community_cases')
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ responses: CommunityCaseResponseRow[] } | { error: string }>> {
  const { supabase } = await getCurrentUser()
  const { id } = await params

  const { data, error } = await responsesTable(supabase)
    .select(
      'id, case_id, author_user_id, body, status, upvotes_count, downvotes_count, created_at, updated_at',
    )
    .eq('case_id', id)
    .eq('status', 'published')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ responses: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}

interface CreateBody {
  body?: unknown
}

const MAX_RESPONSE_LENGTH = 5_000

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ ok: true; response: CommunityCaseResponseRow } | { error: string }>> {
  const { user, supabase } = await getCurrentUser()
  const { id: caseId } = await params

  const json = (await request.json().catch(() => ({}))) as CreateBody
  if (typeof json.body !== 'string' || json.body.trim().length < 10) {
    return NextResponse.json(
      { error: 'Réponse trop courte (10 caractères minimum)' },
      { status: 400 },
    )
  }
  if (json.body.length > MAX_RESPONSE_LENGTH) {
    return NextResponse.json({ error: 'Réponse trop longue' }, { status: 400 })
  }

  const { data, error } = await responsesTable(supabase)
    .insert({
      case_id: caseId,
      author_user_id: user.id,
      body: json.body.trim(),
      status: 'published',
    })
    .select(
      'id, case_id, author_user_id, body, status, upvotes_count, downvotes_count, created_at, updated_at',
    )
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Échec création' }, { status: 500 })
  }

  // Bump compteur responses_count (best-effort applicatif).
  const cur = await casesTable(supabase).select('responses_count').eq('id', caseId).single()
  if (cur.data) {
    await casesTable(supabase)
      .update({ responses_count: cur.data.responses_count + 1 })
      .eq('id', caseId)
  }

  return NextResponse.json({ ok: true, response: data }, { status: 201 })
}
