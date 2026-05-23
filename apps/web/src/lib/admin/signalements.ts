import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Helpers data layer pour /admin/signalements.
 */

export interface SignalementRow {
  id: string
  diagnostician_id: string
  diagnostician_name: string | null
  diagnostician_city: string | null
  reporter_email: string | null
  reason: string
  description: string | null
  status: 'new' | 'investigating' | 'confirmed_fraud' | 'dismissed' | 'resolved'
  created_at: string
}

export type SignalementFilter = 'all' | 'new' | 'investigating' | 'confirmed_fraud' | 'dismissed'

export interface SignalementKpis {
  totalNew: number
  totalInvestigating: number
  totalConfirmedFraud: number
  totalDismissed: number
}

export async function fetchSignalements(
  supabase: SupabaseClient,
  filter: SignalementFilter,
  limit = 200,
): Promise<SignalementRow[]> {
  // biome-ignore lint/suspicious/noExplicitAny: types regen pending pour table VAL-1
  let query = (supabase as any)
    .from('diagnostician_signalements')
    .select(
      'id, diagnostician_id, reporter_email, reason, description, status, created_at, diagnostician:diagnosticians(full_name, first_name, last_name, city)',
    )
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 1000))

  if (filter !== 'all') {
    query = query.eq('status', filter)
  }

  const { data, error } = await query
  if (error) {
    console.error('[signalements] fetch error', error.message)
    return []
  }

  // biome-ignore lint/suspicious/noExplicitAny: types regen pending
  return ((data ?? []) as any[]).map((row) => {
    const r = row as {
      id: string
      diagnostician_id: string
      reporter_email: string | null
      reason: string
      description: string | null
      status: SignalementRow['status']
      created_at: string
      diagnostician?:
        | {
            full_name: string | null
            first_name: string | null
            last_name: string | null
            city: string | null
          }
        | Array<{
            full_name: string | null
            first_name: string | null
            last_name: string | null
            city: string | null
          }>
        | null
    }
    const diag = Array.isArray(r.diagnostician) ? r.diagnostician[0] : r.diagnostician
    const fullName =
      diag?.full_name?.trim() ||
      [diag?.first_name, diag?.last_name].filter(Boolean).join(' ').trim() ||
      null
    return {
      id: r.id,
      diagnostician_id: r.diagnostician_id,
      diagnostician_name: fullName,
      diagnostician_city: diag?.city ?? null,
      reporter_email: r.reporter_email,
      reason: r.reason,
      description: r.description,
      status: r.status,
      created_at: r.created_at,
    }
  })
}

export async function fetchSignalementKpis(supabase: SupabaseClient): Promise<SignalementKpis> {
  // biome-ignore lint/suspicious/noExplicitAny: types regen pending pour table VAL-1
  const sb = supabase as any
  const [n, i, c, d] = await Promise.all([
    sb
      .from('diagnostician_signalements')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new'),
    sb
      .from('diagnostician_signalements')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'investigating'),
    sb
      .from('diagnostician_signalements')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'confirmed_fraud'),
    sb
      .from('diagnostician_signalements')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'dismissed'),
  ])

  return {
    totalNew: n.count ?? 0,
    totalInvestigating: i.count ?? 0,
    totalConfirmedFraud: c.count ?? 0,
    totalDismissed: d.count ?? 0,
  }
}
