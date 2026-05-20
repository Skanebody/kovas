/**
 * GET /api/admin/audit/export.csv
 *
 * Streamé en text/csv. Applique les mêmes filtres que la page /admin/audit
 * (query string params), limite dure AUDIT_EXPORT_MAX (10k rows).
 *
 * Filtres :
 *   ?admin_user_id=  ?action_types=user_suspended,user_unsuspended
 *   ?action_sources=dashboard_web,system_automated  ?succeeded=true|false|all
 *   ?target_type=user  ?q=foo  ?date_from=2026-01-01  ?date_to=2026-05-31
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { AUDIT_EXPORT_MAX } from '@/lib/admin/audit-types'
import type { AuditLogRow } from '@/lib/admin/audit-types'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

type RawAuditRow = Omit<AuditLogRow, 'admin_email'>

interface QueryBuilder {
  select: (cols: string) => QueryBuilder
  eq: (col: string, val: string | boolean) => QueryBuilder
  in: (col: string, vals: string[]) => QueryBuilder
  gte: (col: string, val: string) => QueryBuilder
  lte: (col: string, val: string) => QueryBuilder
  or: (filter: string) => QueryBuilder
  order: (col: string, opts: { ascending: boolean }) => QueryBuilder
  limit: (n: number) => Promise<{ data: RawAuditRow[] | null; error: { message: string } | null }>
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(request: Request) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (access.needs2FA || access.hasNoSecret)
    return NextResponse.json({ error: '2FA required' }, { status: 401 })

  const url = new URL(request.url)
  const adminUserId = url.searchParams.get('admin_user_id') ?? ''
  const actionTypes = (url.searchParams.get('action_types') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const actionSources = (url.searchParams.get('action_sources') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const succeededParam = url.searchParams.get('succeeded') ?? 'all'
  const targetType = url.searchParams.get('target_type') ?? ''
  const q = url.searchParams.get('q') ?? ''
  const dateFrom = url.searchParams.get('date_from') ?? ''
  const dateTo = url.searchParams.get('date_to') ?? ''

  const supabase = createAdminClient()
  let qb = (supabase.from('admin_audit_log') as unknown as QueryBuilder).select(
    'id, admin_user_id, action_type, action_source, target_type, target_id, target_label, payload, previous_state, new_state, ip_address, user_agent, succeeded, error_message, created_at',
  )

  if (adminUserId) qb = qb.eq('admin_user_id', adminUserId)
  if (actionTypes.length > 0) qb = qb.in('action_type', actionTypes)
  if (actionSources.length > 0) qb = qb.in('action_source', actionSources)
  if (succeededParam === 'true') qb = qb.eq('succeeded', true)
  if (succeededParam === 'false') qb = qb.eq('succeeded', false)
  if (targetType) qb = qb.eq('target_type', targetType)
  if (dateFrom) qb = qb.gte('created_at', dateFrom)
  if (dateTo) qb = qb.lte('created_at', dateTo)
  if (q) qb = qb.or(`target_label.ilike.%${q}%,error_message.ilike.%${q}%`)

  const { data, error } = await qb.order('created_at', { ascending: false }).limit(AUDIT_EXPORT_MAX)

  if (error) {
    console.error('[api/admin/audit/export] query failed', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const rows = data ?? []
  const header = [
    'created_at',
    'admin_user_id',
    'action_type',
    'action_source',
    'target_type',
    'target_id',
    'target_label',
    'succeeded',
    'error_message',
    'ip_address',
    'payload',
  ]

  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.created_at),
        csvEscape(r.admin_user_id),
        csvEscape(r.action_type),
        csvEscape(r.action_source),
        csvEscape(r.target_type),
        csvEscape(r.target_id),
        csvEscape(r.target_label),
        csvEscape(String(r.succeeded)),
        csvEscape(r.error_message),
        csvEscape(r.ip_address),
        csvEscape(r.payload),
      ].join(','),
    )
  }

  const csv = lines.join('\n')
  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
