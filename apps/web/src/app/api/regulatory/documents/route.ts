/**
 * GET /api/regulatory/documents
 *
 * Liste paginée des documents réglementaires traités (processed_at IS NOT NULL,
 * is_superseded=false). Filtres : modules, doc_type, importance, dates.
 *
 * Auth : authenticated user (RLS permissive sur regulatory_documents).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type {
  RegulatoryDocType,
  RegulatoryDocumentListItem,
  RegulatoryImportance,
  RegulatoryModule,
} from '@/lib/regulatory/types'
import { ALL_DOC_TYPES, ALL_IMPORTANCES, ALL_MODULES } from '@/lib/regulatory/types'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

interface RawDocRow {
  id: string
  doc_type: string
  title: string
  url: string
  published_at: string | null
  effective_at: string | null
  ai_summary: string | null
  topics: string[] | null
  diagnostic_kinds: string[] | null
  importance: string
  is_superseded: boolean
  processed_at: string | null
  regulatory_sources:
    | { id: string; name: string; authority: string }
    | { id: string; name: string; authority: string }[]
    | null
}

function parseList(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function filterEnum<T extends string>(values: string[], allowed: readonly T[]): T[] {
  const allowedSet = new Set<string>(allowed)
  return values.filter((v): v is T => allowedSet.has(v))
}

function asArray(
  value:
    | { id: string; name: string; authority: string }
    | { id: string; name: string; authority: string }[]
    | null,
): { id: string; name: string; authority: string } | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

interface DocumentsQueryBuilder {
  select: (cols: string) => DocumentsQueryBuilder
  not: (col: string, op: string, val: null) => DocumentsQueryBuilder
  eq: (col: string, val: string | boolean) => DocumentsQueryBuilder
  in: (col: string, vals: string[]) => DocumentsQueryBuilder
  overlaps: (col: string, vals: string[]) => DocumentsQueryBuilder
  gte: (col: string, val: string) => DocumentsQueryBuilder
  lte: (col: string, val: string) => DocumentsQueryBuilder
  order: (col: string, opts: { ascending: boolean; nullsFirst?: boolean }) => DocumentsQueryBuilder
  range: (
    from: number,
    to: number,
  ) => Promise<{ data: RawDocRow[] | null; error: { message: string } | null }>
}

export async function GET(request: Request): Promise<Response> {
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const cu = await getCurrentUser()
    supabase = cu.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const modules = filterEnum<RegulatoryModule>(parseList(url.searchParams.get('modules')), ALL_MODULES)
  const docTypes = filterEnum<RegulatoryDocType>(
    parseList(url.searchParams.get('doc_types')),
    ALL_DOC_TYPES,
  )
  const importances = filterEnum<RegulatoryImportance>(
    parseList(url.searchParams.get('importance')),
    ALL_IMPORTANCES,
  )
  const dateFrom = url.searchParams.get('date_from') ?? ''
  const dateTo = url.searchParams.get('date_to') ?? ''
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '', 10) || DEFAULT_LIMIT),
  )
  const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') ?? '', 10) || 0)

  let qb = (supabase.from('regulatory_documents') as unknown as DocumentsQueryBuilder)
    .select(
      'id, doc_type, title, url, published_at, effective_at, ai_summary, topics, diagnostic_kinds, importance, is_superseded, processed_at, regulatory_sources:regulatory_sources!source_id ( id, name, authority )',
    )
    .eq('is_superseded', false)
    .not('processed_at', 'is', null)

  if (modules.length > 0) {
    // Un document est pertinent s'il touche au moins un module sélectionné.
    qb = qb.overlaps('topics', modules)
  }
  if (docTypes.length > 0) qb = qb.in('doc_type', docTypes)
  if (importances.length > 0) qb = qb.in('importance', importances)
  if (dateFrom) qb = qb.gte('published_at', dateFrom)
  if (dateTo) qb = qb.lte('published_at', `${dateTo}T23:59:59`)

  qb = qb.order('published_at', { ascending: false, nullsFirst: false })

  const { data, error } = await qb.range(offset, offset + limit - 1)
  if (error) {
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as RawDocRow[]
  const items: RegulatoryDocumentListItem[] = rows.map((r) => ({
    id: r.id,
    doc_type: r.doc_type as RegulatoryDocType,
    title: r.title,
    url: r.url,
    published_at: r.published_at,
    effective_at: r.effective_at,
    ai_summary: r.ai_summary,
    topics: r.topics ?? [],
    diagnostic_kinds: r.diagnostic_kinds ?? [],
    importance: r.importance as RegulatoryImportance,
    is_superseded: r.is_superseded,
    processed_at: r.processed_at,
    source: asArray(r.regulatory_sources),
  }))

  return NextResponse.json({ items, count: items.length, limit, offset })
}
