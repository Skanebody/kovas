/**
 * KOVAS — Listing des séquences de relance pour l'org courante.
 *
 *   GET  /api/followup-sequences?kind=<kind>&status=<status>
 *   POST /api/followup-sequences   { kind, targetType, targetId }
 */

import type {
  FollowUpKind,
  FollowUpSequence,
  FollowUpStatus,
} from '@/components/followup/FollowUpSequencesManager'
import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const ALLOWED_KINDS: FollowUpKind[] = [
  'pending_quote',
  'unpaid_invoice',
  'post_dpe_fg',
  'silent_prescriber',
  'client_review',
]
const ALLOWED_STATUSES: FollowUpStatus[] = ['active', 'paused', 'completed', 'cancelled']

interface SequenceRow {
  id: string
  kind: FollowUpKind | null
  status: FollowUpStatus
  target_name: string | null
  target_email: string | null
  current_step_label: string | null
  next_action_at: string | null
  step_index: number | null
  total_steps: number | null
  started_at: string | null
  response_received_at: string | null
  // Champs canoniques (migration 20260525152000)
  target_entity_type: string | null
  target_entity_id: string | null
  current_step: number | null
  sequence_template: string | null
  created_at: string | null
  context: Record<string, unknown> | null
}

// Mapping sequence_template (DB canonique) → kind (UI legacy).
// Permet de supporter à la fois les rows v1 (avec `kind`) et v2 (avec `sequence_template` / `target_entity_type`).
function resolveKind(row: SequenceRow): FollowUpKind {
  if (row.kind && ALLOWED_KINDS.includes(row.kind)) return row.kind
  const tpl = row.sequence_template ?? ''
  if (tpl.startsWith('quote')) return 'pending_quote'
  if (tpl.startsWith('invoice')) return 'unpaid_invoice'
  if (tpl.startsWith('post_dpe')) return 'post_dpe_fg'
  if (tpl.startsWith('prescriber')) return 'silent_prescriber'
  if (tpl.startsWith('review')) return 'client_review'
  // Fallback : déduire depuis target_entity_type
  switch (row.target_entity_type) {
    case 'quote':
    case 'auto_quote':
      return 'pending_quote'
    case 'invoice':
      return 'unpaid_invoice'
    case 'mission':
      return 'post_dpe_fg'
    case 'contact':
      return 'silent_prescriber'
    default:
      return 'pending_quote'
  }
}

function kindToTemplateFilter(kind: FollowUpKind): string[] {
  switch (kind) {
    case 'pending_quote':
      return ['quote_pending']
    case 'unpaid_invoice':
      return ['invoice_unpaid']
    case 'post_dpe_fg':
      return ['post_dpe_fg']
    case 'silent_prescriber':
      return ['prescriber_silent']
    case 'client_review':
      return ['review_request']
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const kind = url.searchParams.get('kind') as FollowUpKind | null
  const status = url.searchParams.get('status') as FollowUpStatus | null

  if (kind && !ALLOWED_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 })
  }
  if (status && !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
  }

  try {
    const { orgId, supabase } = await getCurrentUser()
    let q = supabase
      .from('follow_up_sequences' as never)
      .select(
        'id, kind, status, target_name, target_email, current_step_label, next_action_at, step_index, total_steps, started_at, response_received_at, target_entity_type, target_entity_id, current_step, sequence_template, created_at, context',
      )
      .eq('organization_id', orgId)
      .order('next_action_at', { ascending: true, nullsFirst: false })
      .limit(200)

    if (kind) {
      // Filtre dual : si la colonne `kind` est présente, ou sequence_template correspond.
      const templates = kindToTemplateFilter(kind)
      q = q.or(`kind.eq.${kind},sequence_template.in.(${templates.join(',')})`)
    }
    if (status) q = q.eq('status', status)

    const { data, error } = await q
    if (error) {
      // Graceful degradation : colonnes absentes (schémas désalignés) → re-essai avec colonnes minimales
      const msg = error.message ?? ''
      if (
        msg.includes('does not exist') ||
        msg.includes('schema cache') ||
        error.code === '42P01' ||
        error.code === '42703'
      ) {
        // Fallback strict aux colonnes garanties par la migration
        const fallback = await supabase
          .from('follow_up_sequences' as never)
          .select(
            'id, status, target_entity_type, target_entity_id, current_step, total_steps, sequence_template, next_action_at, created_at, context',
          )
          .eq('organization_id', orgId)
          .order('next_action_at', { ascending: true, nullsFirst: false })
          .limit(200)
        if (fallback.error) return NextResponse.json({ sequences: [] })
        const fbRows = (fallback.data ?? []) as unknown as SequenceRow[]
        const enriched = await enrichWithTargetReferences(supabase, fbRows)
        const sequences = fbRows
          .map((r) => normalizeRow(r, enriched))
          .filter((s) => (kind ? s.kind === kind : true))
        return NextResponse.json({ sequences })
      }
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const rows = (data ?? []) as unknown as SequenceRow[]
    const enriched = await enrichWithTargetReferences(supabase, rows)
    const sequences: FollowUpSequence[] = rows.map((r) => normalizeRow(r, enriched))

    return NextResponse.json({ sequences })
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
}

/**
 * Récupère la référence (DEV-XXXX / FAC-XXXX / DOS-XXXX) pour chaque target,
 * groupé par type pour 3 requêtes max (au lieu d'une par row).
 */
async function enrichWithTargetReferences(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: SequenceRow[],
): Promise<
  Map<string, { reference: string | null; clientName: string | null; clientEmail: string | null }>
> {
  const out = new Map<
    string,
    { reference: string | null; clientName: string | null; clientEmail: string | null }
  >()
  const quoteIds = rows
    .filter((r) => r.target_entity_type === 'quote' || r.target_entity_type === 'auto_quote')
    .map((r) => r.target_entity_id)
    .filter(Boolean) as string[]
  const invoiceIds = rows
    .filter((r) => r.target_entity_type === 'invoice')
    .map((r) => r.target_entity_id)
    .filter(Boolean) as string[]
  const missionIds = rows
    .filter((r) => r.target_entity_type === 'mission')
    .map((r) => r.target_entity_id)
    .filter(Boolean) as string[]
  const contactIds = rows
    .filter((r) => r.target_entity_type === 'contact')
    .map((r) => r.target_entity_id)
    .filter(Boolean) as string[]

  if (quoteIds.length > 0) {
    const { data } = await supabase
      .from('quotes')
      .select('id, reference, client_snapshot, clients(display_name, email)')
      .in('id', quoteIds)
    if (data) {
      for (const q of data as Array<{
        id: string
        reference: string
        client_snapshot: { displayName?: string; email?: string } | null
        clients: { display_name: string | null; email: string | null } | null
      }>) {
        out.set(q.id, {
          reference: q.reference,
          clientName: q.client_snapshot?.displayName ?? q.clients?.display_name ?? null,
          clientEmail: q.client_snapshot?.email ?? q.clients?.email ?? null,
        })
      }
    }
  }
  if (invoiceIds.length > 0) {
    const { data } = await supabase
      .from('invoices')
      .select('id, reference, client_snapshot, clients(display_name, email)')
      .in('id', invoiceIds)
    if (data) {
      for (const inv of data as Array<{
        id: string
        reference: string
        client_snapshot: { display_name?: string; email?: string } | null
        clients: { display_name: string | null; email: string | null } | null
      }>) {
        out.set(inv.id, {
          reference: inv.reference,
          clientName: inv.client_snapshot?.display_name ?? inv.clients?.display_name ?? null,
          clientEmail: inv.client_snapshot?.email ?? inv.clients?.email ?? null,
        })
      }
    }
  }
  if (missionIds.length > 0) {
    const { data } = await supabase
      .from('missions')
      .select('id, reference, clients(display_name, email)')
      .in('id', missionIds)
    if (data) {
      for (const m of data as Array<{
        id: string
        reference: string
        clients: { display_name: string | null; email: string | null } | null
      }>) {
        out.set(m.id, {
          reference: m.reference,
          clientName: m.clients?.display_name ?? null,
          clientEmail: m.clients?.email ?? null,
        })
      }
    }
  }
  if (contactIds.length > 0) {
    const { data } = await supabase
      .from('contacts')
      .select('id, full_name, email')
      .in('id', contactIds)
    if (data) {
      for (const c of data as Array<{
        id: string
        full_name: string | null
        email: string | null
      }>) {
        out.set(c.id, {
          reference: null,
          clientName: c.full_name,
          clientEmail: c.email,
        })
      }
    }
  }
  return out
}

function normalizeRow(
  r: SequenceRow,
  enriched: Map<
    string,
    { reference: string | null; clientName: string | null; clientEmail: string | null }
  >,
): FollowUpSequence {
  const ext = r.target_entity_id ? enriched.get(r.target_entity_id) : undefined
  const stepIndex = r.step_index ?? r.current_step ?? 0
  const totalSteps = r.total_steps ?? 3
  return {
    id: r.id,
    kind: resolveKind(r),
    status: r.status,
    targetName: r.target_name ?? ext?.clientName ?? '—',
    targetEmail: r.target_email ?? ext?.clientEmail ?? null,
    targetReference: ext?.reference ?? null,
    targetEntityType: (r.target_entity_type as FollowUpSequence['targetEntityType']) ?? null,
    targetEntityId: r.target_entity_id ?? null,
    currentStepLabel: r.current_step_label ?? `Étape ${stepIndex + 1}`,
    nextActionAt: r.next_action_at,
    stepIndex,
    totalSteps,
    startedAt: r.started_at ?? r.created_at ?? new Date().toISOString(),
    responseReceivedAt: r.response_received_at,
  }
}

interface CreateBody {
  kind: FollowUpKind
  targetType: string
  targetId: string
  targetName?: string
  targetEmail?: string
}

export async function POST(request: Request): Promise<Response> {
  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (!ALLOWED_KINDS.includes(body.kind)) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 })
  }

  try {
    const { orgId, userId, supabase } = await getCurrentUser().then((u) => ({
      orgId: u.orgId,
      userId: u.user.id,
      supabase: u.supabase,
    }))

    const { data, error } = await supabase
      .from('follow_up_sequences' as never)
      .insert({
        organization_id: orgId,
        kind: body.kind,
        target_type: body.targetType,
        target_id: body.targetId,
        target_name: body.targetName ?? null,
        target_email: body.targetEmail ?? null,
        status: 'active',
        step_index: 0,
        started_at: new Date().toISOString(),
        created_by: userId,
      } as never)
      .select('id')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'insert_failed' }, { status: 500 })
    }
    return NextResponse.json({ id: (data as unknown as { id: string }).id })
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
}
