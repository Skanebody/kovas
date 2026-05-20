/**
 * GET /api/admin/audit-log/recent
 *
 * Renvoie les 20 dernières entries de admin_audit_log (toutes confondues).
 * Service-role pour fiabilité (bypass RLS — la gate est verifyAdminAccess()).
 *
 * Utilisé par <RecentActivityFeed> en initial load + polling 10s (V1 — Realtime V2).
 *
 * Réponse :
 *   { items: AuditLogItem[] }
 *
 * Où AuditLogItem = subset utile au feed UI.
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

const LIMIT = 20

export interface AuditLogItem {
  id: string
  admin_user_id: string
  action_type: string
  action_source: string
  target_type: string | null
  target_id: string | null
  target_label: string | null
  succeeded: boolean
  error_message: string | null
  created_at: string
}

interface AuditLogQueryResult {
  data: AuditLogItem[] | null
  error: { message: string } | null
}

export async function GET() {
  const access = await verifyAdminAccess()
  if (!access.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const adminDb = createAdminClient()

  // admin_audit_log absent du Database type — cast typé.
  const { data, error } = await (
    adminDb.from('admin_audit_log') as unknown as {
      select: (columns: string) => {
        order: (
          column: string,
          opts: { ascending: boolean },
        ) => {
          limit: (n: number) => Promise<AuditLogQueryResult>
        }
      }
    }
  )
    .select(
      'id, admin_user_id, action_type, action_source, target_type, target_id, target_label, succeeded, error_message, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(LIMIT)

  if (error) {
    console.error('[api/admin/audit-log/recent] query failed', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  return NextResponse.json(
    { items: data ?? [] },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
