/**
 * /api/community/cases — référentiel communautaire (cas anonymisés).
 *
 *  - GET  : liste paginée des cas `approved`, filtres optionnels.
 *  - POST : crée un cas pending (anonymisation à brancher Edge Function).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import {
  COMMUNITY_BUILDING_TYPES,
  COMMUNITY_DIAGNOSTIC_KINDS,
  COMMUNITY_YEAR_RANGES,
  type CommunityBuildingType,
  type CommunityCaseRow,
  type CommunityDiagnosticKind,
  type CommunityYearRange,
} from '@/lib/community/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Cast helper — les types DB n'incluent pas encore community_cases
 * (regénération à venir). On force le type via assertion locale.
 */
function communityCasesTable(supabase: SupabaseClient) {
  return (
    supabase as unknown as {
      from(table: 'community_cases'): {
        select: (
          cols: string,
          options?: { count?: 'exact' | 'planned' | 'estimated' },
        ) => {
          eq: (col: string, val: string) => CommunityCasesQueryChain
        }
        insert: (row: Record<string, unknown>) => {
          select: (cols: string) => {
            single: () => Promise<{
              data: CommunityCaseRow | null
              error: { message: string } | null
            }>
          }
        }
      }
    }
  ).from('community_cases')
}

type CommunityCasesQueryChain = {
  eq: (col: string, val: string) => CommunityCasesQueryChain
  in: (col: string, values: readonly string[]) => CommunityCasesQueryChain
  contains: (col: string, values: readonly string[]) => CommunityCasesQueryChain
  or: (filter: string) => CommunityCasesQueryChain
  ilike: (col: string, pattern: string) => CommunityCasesQueryChain
  order: (col: string, opts: { ascending: boolean }) => CommunityCasesQueryChain
  range: (
    from: number,
    to: number,
  ) => Promise<{
    data: CommunityCaseRow[] | null
    error: { message: string } | null
    count: number | null
  }>
}

const PAGE_SIZE = 20
const MAX_TITLE_LENGTH = 200
const MAX_BODY_LENGTH = 8_000

interface ListResponse {
  cases: CommunityCaseRow[]
  page: number
  pageSize: number
  total: number
}

export async function GET(
  request: Request,
): Promise<NextResponse<ListResponse | { error: string }>> {
  const { supabase } = await getCurrentUser()
  const url = new URL(request.url)
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const search = url.searchParams.get('q')?.trim() ?? ''
  const buildingType = url.searchParams.get('buildingType')
  const yearRange = url.searchParams.get('yearRange')
  const diagnostic = url.searchParams.get('diagnostic')
  const expertOnly = url.searchParams.get('expertOnly') === '1'

  let q = communityCasesTable(supabase)
    .select(
      'id, author_user_id, title, building_type, year_built_range, surface_range, diagnostic_kinds, region_anonymised, context_description, question, decision_made, justification, status, upvotes_count, downvotes_count, responses_count, views_count, tags, created_at, updated_at',
      { count: 'exact' },
    )
    .eq('status', 'approved')

  if (buildingType && (COMMUNITY_BUILDING_TYPES as readonly string[]).includes(buildingType)) {
    q = q.eq('building_type', buildingType)
  }
  if (yearRange && (COMMUNITY_YEAR_RANGES as readonly string[]).includes(yearRange)) {
    q = q.eq('year_built_range', yearRange)
  }
  if (diagnostic && (COMMUNITY_DIAGNOSTIC_KINDS as readonly string[]).includes(diagnostic)) {
    q = q.contains('diagnostic_kinds', [diagnostic])
  }
  if (expertOnly) {
    q = q.contains('tags', ['expert_validated'])
  }
  if (search.length > 0) {
    // Full-text-like : OR sur title/question/context.
    const escaped = search.replace(/[%_]/g, ' ').slice(0, 80)
    q = q.or(
      `title.ilike.%${escaped}%,question.ilike.%${escaped}%,context_description.ilike.%${escaped}%`,
    )
  }

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, error, count } = await q
    .order('upvotes_count', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    {
      cases: data ?? [],
      page,
      pageSize: PAGE_SIZE,
      total: count ?? 0,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

interface CreateBody {
  title?: unknown
  buildingType?: unknown
  yearRange?: unknown
  surfaceRange?: unknown
  diagnosticKinds?: unknown
  context?: unknown
  question?: unknown
  decisionMade?: unknown
  justification?: unknown
  references?: unknown
  tags?: unknown
}

function pickStringEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== 'string') return null
  return (allowed as readonly string[]).includes(value) ? (value as T) : null
}

export async function POST(
  request: Request,
): Promise<NextResponse<{ ok: true; id: string } | { error: string }>> {
  const { user, supabase } = await getCurrentUser()
  const body = (await request.json().catch(() => ({}))) as CreateBody

  if (typeof body.title !== 'string' || body.title.trim().length < 5) {
    return NextResponse.json({ error: 'Titre trop court (5 caractères minimum)' }, { status: 400 })
  }
  if (body.title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json({ error: 'Titre trop long' }, { status: 400 })
  }
  if (typeof body.context !== 'string' || body.context.trim().length < 20) {
    return NextResponse.json(
      { error: 'Contexte trop court (20 caractères minimum)' },
      { status: 400 },
    )
  }
  if (body.context.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: 'Contexte trop long' }, { status: 400 })
  }
  if (typeof body.question !== 'string' || body.question.trim().length < 10) {
    return NextResponse.json(
      { error: 'Question trop courte (10 caractères minimum)' },
      { status: 400 },
    )
  }

  const buildingType = pickStringEnum<CommunityBuildingType>(
    body.buildingType,
    COMMUNITY_BUILDING_TYPES,
  )
  const yearRange = pickStringEnum<CommunityYearRange>(body.yearRange, COMMUNITY_YEAR_RANGES)

  const diagnosticKinds: CommunityDiagnosticKind[] = []
  if (Array.isArray(body.diagnosticKinds)) {
    for (const k of body.diagnosticKinds) {
      const v = pickStringEnum<CommunityDiagnosticKind>(k, COMMUNITY_DIAGNOSTIC_KINDS)
      if (v && !diagnosticKinds.includes(v)) diagnosticKinds.push(v)
    }
  }

  const tags: string[] = []
  if (Array.isArray(body.tags)) {
    for (const t of body.tags) {
      if (typeof t === 'string' && t.trim().length > 0 && t.length < 40) {
        const clean = t.trim().toLowerCase()
        if (!tags.includes(clean)) tags.push(clean)
      }
    }
  }

  // Références : on les concatène dans la justification pour V1 (pas de table dédiée).
  const referencesNote =
    Array.isArray(body.references) && body.references.length > 0
      ? `\n\nRéférences réglementaires :\n${body.references
          .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
          .map((r) => `- ${r.trim()}`)
          .join('\n')}`
      : ''

  const justification =
    typeof body.justification === 'string' && body.justification.trim().length > 0
      ? body.justification.trim() + referencesNote
      : referencesNote.length > 0
        ? referencesNote.trim()
        : null

  const { data, error } = await communityCasesTable(supabase)
    .insert({
      author_user_id: user.id,
      title: body.title.trim(),
      building_type: buildingType,
      year_built_range: yearRange,
      diagnostic_kinds: diagnosticKinds,
      context_description: body.context.trim(),
      question: body.question.trim(),
      decision_made: typeof body.decisionMade === 'string' ? body.decisionMade.trim() : null,
      justification,
      tags,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Échec création' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}
