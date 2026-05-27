/**
 * KOVAS — Gestion d'un litige (lecture + transitions de statut).
 *
 *   GET   /api/litigation/[id]
 *   PATCH /api/litigation/[id]  { status?, regenerate?, escalateReason? }
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

async function load(
  supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase'],
  orgId: string,
  id: string,
): Promise<LitigationData | null> {
  const { data } = await supabase
    .from('litigations' as never)
    .select(
      'id, status, opened_at, reason, ai_suggested_response, jurisprudences, lawyer_letter_url',
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()

  const row = data as unknown as LitigationRow | null
  if (!row) return null
  return {
    id: row.id,
    status: row.status,
    openedAt: row.opened_at,
    reason: row.reason,
    aiSuggestedResponse: row.ai_suggested_response ?? '',
    jurisprudences: Array.isArray(row.jurisprudences) ? row.jurisprudences : [],
    lawyerLetterUrl: row.lawyer_letter_url,
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
  status?: LitigationStatus
  regenerate?: boolean
  escalateReason?: string
}

const ALLOWED_TRANSITIONS: LitigationStatus[] = [
  'opened',
  'in_progress',
  'resolved',
  'closed',
  'court',
]

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

  if (body.status && !ALLOWED_TRANSITIONS.includes(body.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
  }

  if (body.status === 'court' && (body.escalateReason ?? '').trim().length < 20) {
    return NextResponse.json({ error: 'escalate_reason_required' }, { status: 400 })
  }

  if (body.status) {
    const { error } = await supabase
      .from('litigations' as never)
      .update({
        status: body.status,
        updated_at: new Date().toISOString(),
        ...(body.escalateReason ? { escalate_reason: body.escalateReason.trim() } : {}),
      } as never)
      .eq('id', id)
      .eq('organization_id', orgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('audit_log' as never).insert({
      organization_id: orgId,
      user_id: userId,
      action: `litigation.status.${body.status}`,
      resource_type: 'litigation',
      resource_id: id,
      metadata: body.escalateReason
        ? ({ escalate_reason: body.escalateReason.trim() } as never)
        : (null as never),
    } as never)
  }

  if (body.regenerate) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (token) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/litigation-ai`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ litigationId: id, regenerate: true }),
          })
        } catch {
          // ignoré — l'UI re-tentera.
        }
      }
    }
  }

  const out = await load(supabase, orgId, id)
  if (!out) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json(out)
}
