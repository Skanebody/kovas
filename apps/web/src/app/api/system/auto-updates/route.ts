/**
 * GET /api/system/auto-updates
 *
 * Liste les system_auto_updates (admin only).
 * Filtres : status, change_type, risk_level.
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import type {
  AutoUpdateChangeType,
  AutoUpdateRiskLevel,
  AutoUpdateStatus,
  SystemAutoUpdateRow,
} from '@/lib/regulatory/types'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface AutoUpdatesQueryBuilder {
  select: (cols: string) => AutoUpdatesQueryBuilder
  eq: (col: string, val: string) => AutoUpdatesQueryBuilder
  in: (col: string, vals: string[]) => AutoUpdatesQueryBuilder
  order: (col: string, opts: { ascending: boolean }) => AutoUpdatesQueryBuilder
  range: (
    from: number,
    to: number,
  ) => Promise<{
    data: Array<
      SystemAutoUpdateRow & { regulatory_documents: { id: string; title: string } | null }
    >
    error: { message: string } | null
  }>
}

function parseList(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function GET(request: Request): Promise<Response> {
  const access = await verifyAdminAccess()
  if (!access.isAdmin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (access.needs2FA) {
    return NextResponse.json({ error: '2fa_required' }, { status: 403 })
  }

  const url = new URL(request.url)
  const status = parseList(url.searchParams.get('status')) as AutoUpdateStatus[]
  const changeTypes = parseList(url.searchParams.get('change_type')) as AutoUpdateChangeType[]
  const riskLevels = parseList(url.searchParams.get('risk_level')) as AutoUpdateRiskLevel[]
  const limit = Math.min(
    200,
    Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '', 10) || 50),
  )
  const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') ?? '', 10) || 0)

  const supabase = createAdminClient()
  let qb = (supabase.from('system_auto_updates') as unknown as AutoUpdatesQueryBuilder).select(
    'id, triggered_by_doc_id, detected_by, title, summary, rationale, affected_areas, change_type, proposed_payload, rollback_payload, status, reviewed_by, reviewed_at, review_notes, applied_by, applied_at, apply_result, apply_error, risk_level, created_at, updated_at, regulatory_documents:regulatory_documents!triggered_by_doc_id ( id, title )',
  )
  if (status.length > 0) qb = qb.in('status', status)
  if (changeTypes.length > 0) qb = qb.in('change_type', changeTypes)
  if (riskLevels.length > 0) qb = qb.in('risk_level', riskLevels)
  qb = qb.order('created_at', { ascending: false })
  const { data, error } = await qb.range(offset, offset + limit - 1)
  if (error) {
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ items: data, count: data?.length ?? 0, limit, offset })
}
