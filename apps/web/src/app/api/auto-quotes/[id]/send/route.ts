/**
 * KOVAS — Envoi effectif du devis auto-généré au client (Resend email + audit).
 *
 * POST /api/auto-quotes/[id]/send  { lines, notes }
 *
 * 1. UPDATE auto_quotes (lines + notes + status = 'sent' + sent_at)
 * 2. Best-effort : trigger Edge Function `auto-quote-send` (génération PDF + Resend)
 * 3. Renvoie la row complète à jour
 */

import type { AutoQuoteData, QuoteLine } from '@/components/quotes/AutoQuoteReview'
import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface SendBody {
  lines: QuoteLine[]
  notes?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  let body: SendBody
  try {
    body = (await request.json()) as SendBody
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: 'lines_required' }, { status: 400 })
  }

  let orgId: string
  let userId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
    userId = u.user.id
    supabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sentAt = new Date().toISOString()
  const { error: updErr } = await supabase
    .from('auto_quotes' as never)
    .update({
      lines: body.lines as never,
      notes: body.notes ?? '',
      status: 'sent',
      sent_at: sentAt,
      sent_by: userId,
    } as never)
    .eq('id', id)
    .eq('organization_id', orgId)

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  await supabase.from('audit_log' as never).insert({
    organization_id: orgId,
    user_id: userId,
    action: 'auto_quote.send',
    resource_type: 'auto_quote',
    resource_id: id,
  } as never)

  // Trigger Edge Function (best-effort, non bloquant pour l'UX).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (token) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/auto-quote-send`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ autoQuoteId: id }),
        })
      } catch {
        // Le retry sera fait par le worker SQL cron.
      }
    }
  }

  // Reload + return
  const { data } = await supabase
    .from('auto_quotes' as never)
    .select('id, status, extraction, lines, vat_rate, notes')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()

  const row = data as unknown as {
    id: string
    status: AutoQuoteData['status']
    extraction: AutoQuoteData['extraction'] | null
    lines: QuoteLine[] | null
    vat_rate: number | null
    notes: string | null
  } | null
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const out: AutoQuoteData = {
    id: row.id,
    status: row.status,
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
  return NextResponse.json(out)
}
