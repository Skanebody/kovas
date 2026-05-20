/**
 * GET /api/cron/escalate-alerts
 *
 * Cron Vercel (toutes les 15 minutes — cf. vercel.json) qui escalade les
 * alertes non résolues depuis > 1h (V1 stub).
 *
 * V1 : on log juste les events critiques non résolus > 1h. La vraie escalade
 * (re-notification Telegram + SMS) arrive itération 9 avec le bot Telegram.
 */

import { createCronSupabaseClient } from '@/lib/admin/alert-engine'
import type { Json } from '@kovas/database/types'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 30

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  const auth = request.headers.get('authorization') ?? ''
  if (auth === `Bearer ${secret}`) return true
  if (process.env.NODE_ENV !== 'production') {
    const url = new URL(request.url)
    if (url.searchParams.get('secret') === secret) return true
  }
  return false
}

interface UnresolvedEventRow {
  id: string
  rule_id: string
  target_label: string | null
  payload: Json
  created_at: string
}

interface UnresolvedQueryBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: boolean,
    ) => {
      lte: (
        col: string,
        val: string,
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{
          data: UnresolvedEventRow[] | null
          error: { message: string } | null
        }>
      }
    }
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createCronSupabaseClient()
  const oneHourAgoIso = new Date(Date.now() - 60 * 60_000).toISOString()

  const builder = supabase.from('alert_events') as unknown as UnresolvedQueryBuilder
  const { data, error } = await builder
    .select('id, rule_id, target_label, payload, created_at')
    .eq('resolved', false)
    .lte('created_at', oneHourAgoIso)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[cron/escalate-alerts] query failed', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const events = data ?? []
  // V1 stub : log les events stale, V2 = re-notify Telegram + SMS.
  for (const ev of events) {
    console.warn(
      `[cron/escalate-alerts] stale alert ${ev.id} (rule ${ev.rule_id}) since ${ev.created_at}`,
    )
  }

  return NextResponse.json({
    ok: true,
    stale_count: events.length,
    escalated: 0, // V1 stub
  })
}
