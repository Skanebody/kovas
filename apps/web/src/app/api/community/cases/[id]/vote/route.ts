/**
 * /api/community/cases/[id]/vote — upvote / downvote.
 *
 * POST body : { value: 1 | -1 | 0 } (0 = retirer le vote)
 * Strategy : upsert sur (case_id, user_id) ; on recalcule les compteurs
 * dénormalisés `community_cases.upvotes_count` / `downvotes_count` après
 * chaque opération (best-effort applicatif tant qu'aucun trigger SQL n'est posé).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

interface VoteRow {
  id: string
  value: 1 | -1
}

interface VotesTable {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{ data: VoteRow | null; error: { message: string } | null }>
      }
    }
  }
  insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
  update: (patch: Record<string, unknown>) => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
  delete: () => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
}

interface CasesTable {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      single: () => Promise<{
        data: { upvotes_count: number; downvotes_count: number } | null
        error: { message: string } | null
      }>
    }
  }
  update: (patch: Record<string, unknown>) => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
}

function votesTable(supabase: SupabaseClient): VotesTable {
  return (supabase as unknown as { from(t: 'community_case_votes'): VotesTable }).from(
    'community_case_votes',
  )
}
function casesTable(supabase: SupabaseClient): CasesTable {
  return (supabase as unknown as { from(t: 'community_cases'): CasesTable }).from('community_cases')
}

interface VoteBody {
  value?: unknown
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<
  NextResponse<{ ok: true; net: number; upvotes: number; downvotes: number } | { error: string }>
> {
  const { user, supabase } = await getCurrentUser()
  const { id: caseId } = await params

  const body = (await request.json().catch(() => ({}))) as VoteBody
  const raw = body.value
  if (raw !== -1 && raw !== 1 && raw !== 0) {
    return NextResponse.json({ error: 'value doit être -1, 0 ou 1' }, { status: 400 })
  }
  const desired = raw as -1 | 0 | 1

  // Existing vote ?
  const existing = await votesTable(supabase)
    .select('id, value')
    .eq('case_id', caseId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing.error) {
    return NextResponse.json({ error: existing.error.message }, { status: 500 })
  }

  let delta = { up: 0, down: 0 }
  if (existing.data) {
    if (desired === 0) {
      // Retirer
      const del = await votesTable(supabase).delete().eq('id', existing.data.id)
      if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 })
      delta = existing.data.value === 1 ? { up: -1, down: 0 } : { up: 0, down: -1 }
    } else if (desired === existing.data.value) {
      delta = { up: 0, down: 0 }
    } else {
      const upd = await votesTable(supabase).update({ value: desired }).eq('id', existing.data.id)
      if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 })
      delta = desired === 1 ? { up: 1, down: -1 } : { up: -1, down: 1 }
    }
  } else if (desired !== 0) {
    const ins = await votesTable(supabase).insert({
      case_id: caseId,
      user_id: user.id,
      value: desired,
    })
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 })
    delta = desired === 1 ? { up: 1, down: 0 } : { up: 0, down: 1 }
  }

  // Recalcul applicatif (best-effort).
  const cur = await casesTable(supabase)
    .select('upvotes_count, downvotes_count')
    .eq('id', caseId)
    .single()
  if (cur.error || !cur.data) {
    return NextResponse.json({ error: cur.error?.message ?? 'Cas introuvable' }, { status: 500 })
  }
  const newUp = Math.max(0, cur.data.upvotes_count + delta.up)
  const newDown = Math.max(0, cur.data.downvotes_count + delta.down)
  await casesTable(supabase)
    .update({ upvotes_count: newUp, downvotes_count: newDown })
    .eq('id', caseId)

  return NextResponse.json({
    ok: true,
    net: newUp - newDown,
    upvotes: newUp,
    downvotes: newDown,
  })
}
