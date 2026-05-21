/**
 * GET /api/regulatory/notifications
 *   → notifications du user (non lues d'abord).
 * POST /api/regulatory/notifications
 *   → body { documentIds?: string[]; markAll?: boolean }
 *     marque comme lues les notifs (ciblées ou toutes).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RawNotif {
  id: string
  document_id: string
  severity: string
  reason: string | null
  matched_topics: string[] | null
  matched_kinds: string[] | null
  read_at: string | null
  dismissed_at: string | null
  created_at: string
  regulatory_documents:
    | {
        id: string
        title: string
        doc_type: string
        importance: string
        published_at: string | null
      }
    | {
        id: string
        title: string
        doc_type: string
        importance: string
        published_at: string | null
      }[]
    | null
}

function unwrap<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function GET(request: Request): Promise<Response> {
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  let userId: string
  try {
    const cu = await getCurrentUser()
    supabase = cu.supabase
    userId = cu.user.id
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const onlyUnread = url.searchParams.get('unread') === '1'
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '', 10) || 30),
  )

  let q = supabase
    .from('regulatory_notifications')
    .select(
      'id, document_id, severity, reason, matched_topics, matched_kinds, read_at, dismissed_at, created_at, regulatory_documents:regulatory_documents!document_id ( id, title, doc_type, importance, published_at )',
    )
    .eq('user_id', userId)
    .is('dismissed_at', null)
  if (onlyUnread) q = q.is('read_at', null)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) {
    // Graceful degradation : si table inexistante (migrations pas appliquées en dev),
    // retourner état vide propre au lieu de 500 qui pollue les logs + casse le badge cloche.
    const msg = error.message ?? ''
    if (msg.includes('does not exist') || msg.includes('schema cache') || error.code === '42P01') {
      return NextResponse.json({ items: [], unreadCount: 0 })
    }
    return NextResponse.json({ error: 'db_error', detail: msg }, { status: 500 })
  }
  const rows = (data ?? []) as unknown as RawNotif[]
  const items = rows.map((r) => ({
    id: r.id,
    document_id: r.document_id,
    severity: r.severity as 'info' | 'warning' | 'critical',
    reason: r.reason,
    matched_topics: r.matched_topics ?? [],
    matched_kinds: r.matched_kinds ?? [],
    read_at: r.read_at,
    created_at: r.created_at,
    document: unwrap(r.regulatory_documents),
  }))

  // Compteur séparé pour le badge header. Tolérant si la 2e requête échoue.
  let unreadCount = 0
  try {
    const { count } = await supabase
      .from('regulatory_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
      .is('dismissed_at', null)
    unreadCount = count ?? 0
  } catch {
    // ignore — fallback à 0
  }

  return NextResponse.json({ items, unreadCount })
}

interface MarkReadBody {
  documentIds?: string[]
  notificationIds?: string[]
  markAll?: boolean
}

interface UpdateBuilder {
  update: (patch: { read_at: string }) => {
    eq: (col: string, val: string) => {
      is: (col: string, val: null) => Promise<{ error: { message: string } | null }>
      in: (col: string, vals: string[]) => Promise<{ error: { message: string } | null }>
    }
  }
}

export async function POST(request: Request): Promise<Response> {
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  let userId: string
  try {
    const cu = await getCurrentUser()
    supabase = cu.supabase
    userId = cu.user.id
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: MarkReadBody
  try {
    body = (await request.json()) as MarkReadBody
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const builder = supabase.from('regulatory_notifications') as unknown as UpdateBuilder
  const docIds = Array.isArray(body.documentIds)
    ? body.documentIds.filter((v): v is string => typeof v === 'string')
    : []
  const notifIds = Array.isArray(body.notificationIds)
    ? body.notificationIds.filter((v): v is string => typeof v === 'string')
    : []

  if (body.markAll === true) {
    const { error } = await builder
      .update({ read_at: now })
      .eq('user_id', userId)
      .is('read_at', null)
    if (error) {
      return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }
  if (notifIds.length > 0) {
    const { error } = await builder
      .update({ read_at: now })
      .eq('user_id', userId)
      .in('id', notifIds)
    if (error) {
      return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }
  if (docIds.length > 0) {
    const { error } = await builder
      .update({ read_at: now })
      .eq('user_id', userId)
      .in('document_id', docIds)
    if (error) {
      return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
}
