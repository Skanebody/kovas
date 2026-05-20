/**
 * GET /api/admin/broadcast/history
 *
 * Renvoie les 20 derniers broadcasts triés par created_at desc.
 * Service-role pour fiabilité (gate = verifyAdminAccess()).
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import type { BroadcastHistoryRow } from '@/lib/admin/broadcasts-types'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

const LIMIT = 20

interface QueryResult {
  data: BroadcastHistoryRow[] | null
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

  const supabase = createAdminClient()

  const { data, error } = await (
    supabase.from('broadcast_history') as unknown as {
      select: (cols: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          limit: (n: number) => Promise<QueryResult>
        }
      }
    }
  )
    .select(
      'id, subject, body_html, body_text, audience_filter, recipients_count, status, sent_at, delivered_count, opened_count, clicked_count, error_count, created_at, created_by',
    )
    .order('created_at', { ascending: false })
    .limit(LIMIT)

  if (error) {
    console.error('[api/admin/broadcast/history] query failed', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}
