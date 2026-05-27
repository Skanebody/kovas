/**
 * KOVAS — Devis auto-généré (lecture + mise à jour des lignes/notes/statut).
 *
 *   GET   /api/auto-quotes/[id]
 *   PATCH /api/auto-quotes/[id]   { lines?, notes?, status? }
 */

import type {
  AutoQuoteData,
  AutoQuoteExtraction,
  QuoteLine,
} from '@/components/quotes/AutoQuoteReview'
import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface AutoQuoteRow {
  id: string
  status: AutoQuoteData['status']
  extraction: AutoQuoteExtraction | null
  lines: QuoteLine[] | null
  vat_rate: number | null
  notes: string | null
}

async function load(
  supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase'],
  orgId: string,
  id: string,
): Promise<AutoQuoteData | null> {
  const { data } = await supabase
    .from('auto_quotes' as never)
    .select('id, status, extraction, lines, vat_rate, notes')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()
  const row = data as unknown as AutoQuoteRow | null
  if (!row) return null
  return {
    id: row.id,
    status: row.status ?? 'pending_review',
    extraction: row.extraction ?? {
      address: '',
      diagnosticTypes: [],
      surface: null,
      clientName: null,
      clientEmail: null,
      rawEmailExcerpt: '',
    },
    lines: Array.isArray(row.lines) ? row.lines : [],
    vatRate: typeof row.vat_rate === 'number' ? row.vat_rate : 0.2,
    notes: row.notes ?? '',
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }
  try {
    const { orgId, supabase } = await getCurrentUser()
    const out = await load(supabase, orgId, id)
    if (!out) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(out)
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
}

interface PatchBody {
  lines?: QuoteLine[]
  notes?: string
  status?: AutoQuoteData['status']
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  try {
    const { orgId, userId, supabase } = await ((): Promise<{
      orgId: string
      userId: string
      supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
    }> => {
      // wrap pour conserver le pattern unauthorized propre
      return getCurrentUser().then((u) => ({
        orgId: u.orgId,
        userId: u.user.id,
        supabase: u.supabase,
      }))
    })()

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (Array.isArray(body.lines)) patch.lines = body.lines
    if (typeof body.notes === 'string') patch.notes = body.notes
    if (body.status) patch.status = body.status

    const { error } = await supabase
      .from('auto_quotes' as never)
      .update(patch as never)
      .eq('id', id)
      .eq('organization_id', orgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (body.status) {
      await supabase.from('audit_log' as never).insert({
        organization_id: orgId,
        user_id: userId,
        action: `auto_quote.status.${body.status}`,
        resource_type: 'auto_quote',
        resource_id: id,
      } as never)
    }

    const out = await load(supabase, orgId, id)
    if (!out) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(out)
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
}
