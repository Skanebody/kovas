/**
 * /admin/audit — Itération 11.
 *
 * Server component : charge admin_audit_log avec filtres + pagination cursor-based.
 *
 * Query params :
 *   ?admin_user_id  ?action_types=a,b  ?action_sources=dashboard_web,...
 *   ?succeeded=true|false|all  ?target_type=  ?q=  ?date_from=  ?date_to=
 *   ?cursor=ISO  ?cursor_dir=next|prev
 */

import { AuditFiltersBar } from '@/components/admin/audit/AuditFilters'
import { AuditLogTable } from '@/components/admin/audit/AuditLogTable'
import { AuditStatsPanel } from '@/components/admin/audit/AuditStatsPanel'
import type { AuditActionSource } from '@/lib/admin/audit-log'
import {
  AUDIT_PAGE_SIZE,
  type AuditFilters,
  type AuditLogRow,
  type AuditStats,
  CRITICAL_ACTION_TYPES,
} from '@/lib/admin/audit-types'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Audit log',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  searchParams: Promise<{
    admin_user_id?: string
    action_types?: string
    action_sources?: string
    succeeded?: string
    target_type?: string
    q?: string
    date_from?: string
    date_to?: string
    cursor?: string
    cursor_dir?: string
  }>
}

interface RawAuditRow {
  id: string
  admin_user_id: string
  action_type: string
  action_source: AuditActionSource
  target_type: string | null
  target_id: string | null
  target_label: string | null
  payload: Record<string, unknown>
  previous_state: Record<string, unknown> | null
  new_state: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  succeeded: boolean
  error_message: string | null
  created_at: string
}

interface QueryBuilder {
  select: (
    cols: string,
    opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean },
  ) => QueryBuilder
  eq: (col: string, val: string | boolean) => QueryBuilder
  in: (col: string, vals: string[]) => QueryBuilder
  gte: (col: string, val: string) => QueryBuilder
  lte: (col: string, val: string) => QueryBuilder
  lt: (col: string, val: string) => QueryBuilder
  gt: (col: string, val: string) => QueryBuilder
  or: (filter: string) => QueryBuilder
  order: (col: string, opts: { ascending: boolean }) => QueryBuilder
  limit: (n: number) => Promise<{
    data: RawAuditRow[] | null
    count: number | null
    error: { message: string } | null
  }>
}

function parseList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseSucceeded(value: string | undefined): 'all' | 'true' | 'false' {
  if (value === 'true' || value === 'false') return value
  return 'all'
}

async function fetchAuditData(sp: Awaited<PageProps['searchParams']>): Promise<{
  rows: AuditLogRow[]
  stats: AuditStats
  filters: AuditFilters
  adminOptions: Array<{ user_id: string; email: string }>
  actionTypeOptions: string[]
  targetTypeOptions: string[]
  hasMore: boolean
  hasPrev: boolean
  nextCursor: string | null
  prevCursor: string | null
}> {
  const supabase = createAdminClient()

  const filters: AuditFilters = {
    adminUserId: sp.admin_user_id ?? '',
    actionTypes: parseList(sp.action_types),
    actionSources: parseList(sp.action_sources) as AuditActionSource[],
    succeeded: parseSucceeded(sp.succeeded),
    targetType: sp.target_type ?? '',
    q: sp.q ?? '',
    dateFrom: sp.date_from ?? '',
    dateTo: sp.date_to ?? '',
  }

  const cursor = sp.cursor ?? ''
  const cursorDir = sp.cursor_dir === 'prev' ? 'prev' : 'next'

  // 1. Query principale (rows page)
  let qb = (supabase.from('admin_audit_log') as unknown as QueryBuilder).select(
    'id, admin_user_id, action_type, action_source, target_type, target_id, target_label, payload, previous_state, new_state, ip_address, user_agent, succeeded, error_message, created_at',
  )

  if (filters.adminUserId) qb = qb.eq('admin_user_id', filters.adminUserId)
  if (filters.actionTypes.length > 0) qb = qb.in('action_type', filters.actionTypes)
  if (filters.actionSources.length > 0) qb = qb.in('action_source', filters.actionSources)
  if (filters.succeeded === 'true') qb = qb.eq('succeeded', true)
  if (filters.succeeded === 'false') qb = qb.eq('succeeded', false)
  if (filters.targetType) qb = qb.eq('target_type', filters.targetType)
  if (filters.dateFrom) qb = qb.gte('created_at', filters.dateFrom)
  if (filters.dateTo) qb = qb.lte('created_at', `${filters.dateTo}T23:59:59`)
  if (filters.q) qb = qb.or(`target_label.ilike.%${filters.q}%,error_message.ilike.%${filters.q}%`)
  if (cursor) {
    if (cursorDir === 'next') qb = qb.lt('created_at', cursor)
    else qb = qb.gt('created_at', cursor)
  }
  qb = qb.order('created_at', { ascending: cursorDir === 'prev' })

  const queryResult = await qb.limit(AUDIT_PAGE_SIZE + 1)
  const rawRows = queryResult.data ?? []
  const hasMore = rawRows.length > AUDIT_PAGE_SIZE
  const pageRows = hasMore ? rawRows.slice(0, AUDIT_PAGE_SIZE) : rawRows
  // Si on est en prev, les rows sont en ascending → on inverse pour l'affichage.
  const orderedRows = cursorDir === 'prev' ? [...pageRows].reverse() : pageRows

  // 2. Stats globales (avec filtres mais sans cursor, pour la période)
  let statsQb = (supabase.from('admin_audit_log') as unknown as QueryBuilder).select(
    'id, action_type, succeeded, created_at',
    { count: 'exact' },
  )
  if (filters.adminUserId) statsQb = statsQb.eq('admin_user_id', filters.adminUserId)
  if (filters.actionTypes.length > 0) statsQb = statsQb.in('action_type', filters.actionTypes)
  if (filters.actionSources.length > 0) statsQb = statsQb.in('action_source', filters.actionSources)
  if (filters.targetType) statsQb = statsQb.eq('target_type', filters.targetType)
  if (filters.dateFrom) statsQb = statsQb.gte('created_at', filters.dateFrom)
  if (filters.dateTo) statsQb = statsQb.lte('created_at', `${filters.dateTo}T23:59:59`)
  if (filters.q)
    statsQb = statsQb.or(`target_label.ilike.%${filters.q}%,error_message.ilike.%${filters.q}%`)

  const statsResult = await statsQb.limit(10_000)
  const statsRowsRaw = (statsResult.data ?? []) as Array<{
    action_type: string
    succeeded: boolean
    created_at: string
  }>
  const now = Date.now()
  const stats: AuditStats = {
    total: statsResult.count ?? statsRowsRaw.length,
    failedTotal: statsRowsRaw.filter((r) => !r.succeeded).length,
    criticalActionsTotal: statsRowsRaw.filter((r) => CRITICAL_ACTION_TYPES.has(r.action_type))
      .length,
    last24h: statsRowsRaw.filter(
      (r) => now - new Date(r.created_at).getTime() < 24 * 60 * 60 * 1000,
    ).length,
  }

  // 3. Options de filtres (admins + action_types + target_types) — limites raisonnables
  interface AdminProfile {
    user_id: string
    profiles: { email: string } | null
  }
  const { data: adminsData } = await supabase
    .from('admin_users')
    .select('user_id, profiles:profiles!user_id ( email )')
    .eq('is_active', true)
  const adminOptions: Array<{ user_id: string; email: string }> = (
    (adminsData ?? []) as unknown as AdminProfile[]
  )
    .map((a) => ({ user_id: a.user_id, email: a.profiles?.email ?? a.user_id.slice(0, 8) }))
    .sort((a, b) => a.email.localeCompare(b.email))

  // distinct action_types + target_types — V1 : on prend ce qu'on a dans les stats rows
  const distinctActionTypes = Array.from(new Set(statsRowsRaw.map((r) => r.action_type))).sort()
  const distinctTargetTypes = Array.from(
    new Set(orderedRows.map((r) => r.target_type).filter((t): t is string => Boolean(t))),
  ).sort()

  // 4. Hydratation admin_email sur les rows page (jointure manuelle car la table
  //    profiles n'est pas accessible via une vraie FK depuis admin_audit_log).
  const adminEmailById = new Map(adminOptions.map((a) => [a.user_id, a.email]))
  const rows: AuditLogRow[] = orderedRows.map((r) => ({
    ...r,
    admin_email: adminEmailById.get(r.admin_user_id) ?? null,
  }))

  // Cursor next / prev pour pagination
  const nextCursor = rows.length > 0 ? (rows[rows.length - 1]?.created_at ?? null) : null
  const prevCursor = rows.length > 0 ? (rows[0]?.created_at ?? null) : null
  const hasPrev = Boolean(cursor)

  return {
    rows,
    stats,
    filters,
    adminOptions,
    actionTypeOptions: distinctActionTypes,
    targetTypeOptions: distinctTargetTypes,
    hasMore,
    hasPrev,
    nextCursor: hasMore ? nextCursor : null,
    prevCursor: hasPrev ? prevCursor : null,
  }
}

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const data = await fetchAuditData(sp)

  return (
    <div className="space-y-7 max-w-7xl">
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          📜 Audit log · Traçabilité
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Audit.
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          Toutes les actions admin tracées immuablement. Filtres + recherche + export CSV.
        </p>
      </div>

      <AuditStatsPanel stats={data.stats} />

      <section aria-label="Filtres" className="rounded-xl border border-rule bg-paper p-4">
        <AuditFiltersBar
          initial={data.filters}
          adminOptions={data.adminOptions}
          actionTypeOptions={data.actionTypeOptions}
          targetTypeOptions={data.targetTypeOptions}
        />
      </section>

      <AuditLogTable
        rows={data.rows}
        hasMore={data.hasMore}
        hasPrev={data.hasPrev}
        nextCursor={data.nextCursor}
        prevCursor={data.prevCursor}
      />
    </div>
  )
}
