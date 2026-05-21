/**
 * GET /api/regulatory/documents/[id]
 *   → détail d'un document réglementaire + notification user marquée lue si présente.
 *
 * POST /api/regulatory/documents/[id]
 *   → marque toutes les notifs du user pour ce document comme lues.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type { RegulatoryDocType, RegulatoryDocumentDetail, RegulatoryImportance } from '@/lib/regulatory/types'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface RawDocDetail {
  id: string
  doc_type: string
  title: string
  url: string
  published_at: string | null
  effective_at: string | null
  ai_summary: string | null
  topics: string[] | null
  diagnostic_kinds: string[] | null
  applies_to: string[] | null
  importance: string
  is_superseded: boolean
  processed_at: string | null
  raw_text: string
  jurisdiction: string
  created_at: string
  regulatory_sources:
    | { id: string; name: string; authority: string }
    | { id: string; name: string; authority: string }[]
    | null
}

function asSource(
  value:
    | { id: string; name: string; authority: string }
    | { id: string; name: string; authority: string }[]
    | null,
): { id: string; name: string; authority: string } | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

interface NotifUpdateBuilder {
  update: (patch: { read_at: string }) => {
    eq: (col: string, val: string) => {
      eq: (col: string, val: string) => {
        is: (col: string, val: null) => Promise<{ error: { message: string } | null }>
      }
    }
  }
}

export async function GET(_req: Request, ctx: RouteParams): Promise<Response> {
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 })

  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const cu = await getCurrentUser()
    supabase = cu.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('regulatory_documents')
    .select(
      'id, doc_type, title, url, published_at, effective_at, ai_summary, topics, diagnostic_kinds, applies_to, importance, is_superseded, processed_at, raw_text, jurisdiction, created_at, regulatory_sources:regulatory_sources!source_id ( id, name, authority )',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) {
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const raw = data as unknown as RawDocDetail
  const detail: RegulatoryDocumentDetail = {
    id: raw.id,
    doc_type: raw.doc_type as RegulatoryDocType,
    title: raw.title,
    url: raw.url,
    published_at: raw.published_at,
    effective_at: raw.effective_at,
    ai_summary: raw.ai_summary,
    topics: raw.topics ?? [],
    diagnostic_kinds: raw.diagnostic_kinds ?? [],
    applies_to: raw.applies_to ?? [],
    importance: raw.importance as RegulatoryImportance,
    is_superseded: raw.is_superseded,
    processed_at: raw.processed_at,
    raw_text: raw.raw_text,
    jurisdiction: raw.jurisdiction,
    created_at: raw.created_at,
    source: asSource(raw.regulatory_sources),
  }

  return NextResponse.json({ document: detail })
}

export async function POST(_req: Request, ctx: RouteParams): Promise<Response> {
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 })

  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  let userId: string
  try {
    const cu = await getCurrentUser()
    supabase = cu.supabase
    userId = cu.user.id
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const builder = supabase.from('regulatory_notifications') as unknown as NotifUpdateBuilder
  const now = new Date().toISOString()
  const { error } = await builder
    .update({ read_at: now })
    .eq('user_id', userId)
    .eq('document_id', id)
    .is('read_at', null)
  if (error) {
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
