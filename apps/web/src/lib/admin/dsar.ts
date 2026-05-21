/**
 * Helpers RGPD DSAR queue (admin + user-facing).
 *
 * Schéma : table dsar_requests (migration 20260524110000_admin_p0_rgpd.sql).
 * RLS : admins lisent tout, users insèrent leur propre demande.
 */

import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type DsarType = 'export' | 'erasure'
export type DsarStatus = 'pending' | 'processing' | 'completed' | 'rejected'

export interface DsarRequestRow {
  id: string
  user_id: string
  organization_id: string | null
  type: DsarType
  status: DsarStatus
  requested_at: string
  deadline: string
  notes: string | null
  completed_by_admin: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  user_email: string | null
  user_full_name: string | null
  organization_name: string | null
}

interface DsarJoinedRow {
  id: string
  user_id: string
  organization_id: string | null
  type: DsarType
  status: DsarStatus
  requested_at: string
  deadline: string
  notes: string | null
  completed_by_admin: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  profiles?: { email: string | null; full_name: string | null } | null
  organizations?: { name: string | null } | null
}

export interface DsarQueueData {
  pending: DsarRequestRow[]
  processing: DsarRequestRow[]
  completed: DsarRequestRow[]
  rejected: DsarRequestRow[]
  kpi: {
    pendingCount: number
    processingCount: number
    overdueCount: number
    averageResolutionDays: number | null
  }
}

/**
 * Calcule le délai en jours entre maintenant et la deadline.
 * Négatif → en retard. Positif → encore le temps.
 */
export function daysUntilDeadline(deadlineIso: string): number {
  const deadline = new Date(deadlineIso).getTime()
  const ms = deadline - Date.now()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export function urgencyVariant(days: number): 'red' | 'orange' | 'yellow' | 'green' {
  if (days < 0) return 'red' // déjà en retard
  if (days < 7) return 'red'
  if (days < 14) return 'orange'
  if (days < 21) return 'yellow'
  return 'green'
}

export async function getDsarQueue(
  supabase: SupabaseClient<Database>,
): Promise<DsarQueueData> {
  // Cast typé : dsar_requests pas encore dans @kovas/database/types
  // (migration 20260524110000, types à régénérer via `pnpm db:gen-types`).
  const res = (await supabase
    .from('dsar_requests')
    .select(
      `id, user_id, organization_id, type, status, requested_at, deadline,
       notes, completed_by_admin, completed_at, created_at, updated_at,
       profiles:profiles!user_id(email, full_name),
       organizations:organizations(name)`,
    )
    .order('deadline', { ascending: true })) as unknown as {
    data: DsarJoinedRow[] | null
    error: { message: string } | null
  }

  const rows = (res.data ?? []).map((r): DsarRequestRow => ({
    id: r.id,
    user_id: r.user_id,
    organization_id: r.organization_id,
    type: r.type,
    status: r.status,
    requested_at: r.requested_at,
    deadline: r.deadline,
    notes: r.notes,
    completed_by_admin: r.completed_by_admin,
    completed_at: r.completed_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    user_email: r.profiles?.email ?? null,
    user_full_name: r.profiles?.full_name ?? null,
    organization_name: r.organizations?.name ?? null,
  }))

  const pending = rows.filter((r) => r.status === 'pending')
  const processing = rows.filter((r) => r.status === 'processing')
  const completed = rows.filter((r) => r.status === 'completed')
  const rejected = rows.filter((r) => r.status === 'rejected')

  const overdueCount = [...pending, ...processing].filter(
    (r) => daysUntilDeadline(r.deadline) < 0,
  ).length

  // Moyenne résolution sur les completed
  let avgResolutionDays: number | null = null
  if (completed.length > 0) {
    const totalMs = completed.reduce((sum, r) => {
      if (!r.completed_at) return sum
      return sum + (new Date(r.completed_at).getTime() - new Date(r.requested_at).getTime())
    }, 0)
    avgResolutionDays = Math.round((totalMs / completed.length) / (1000 * 60 * 60 * 24))
  }

  return {
    pending,
    processing,
    completed,
    rejected,
    kpi: {
      pendingCount: pending.length,
      processingCount: processing.length,
      overdueCount,
      averageResolutionDays: avgResolutionDays,
    },
  }
}
