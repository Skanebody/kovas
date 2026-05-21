/**
 * Calcul des métriques de stockage par organisation pour /admin/storage.
 *
 * Lecture seule de la colonne organizations.storage_used_bytes (alimentée par
 * les triggers DB de la migration 20260524100000_storage_tracking.sql) +
 * organizations.storage_quota_bytes.
 *
 * Ces colonnes ne sont pas (encore) régénérées dans @kovas/database/types.ts
 * (les types seront refresh via `pnpm db:gen-types` post-deploy). On type
 * localement la response pour éviter `any`.
 */

import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'

const GB = 1024 * 1024 * 1024

export type StorageUsageFilter = 'all' | 'over_75' | 'over_90' | 'over_100'

export interface StorageOrgRow {
  organization_id: string
  organization_name: string
  plan: string
  storage_used_bytes: number
  storage_quota_bytes: number
  utilization_pct: number
  last_mission_at: string | null
}

export interface StorageOverviewKpi {
  totalUsedGo: number
  totalQuotaGo: number
  orgsAbove80: number
  orgsAbove100: number
  totalOrgs: number
}

interface OrgRowWithStorage {
  id: string
  name: string
  plan: string
  storage_used_bytes: number | null
  storage_quota_bytes: number | null
}

interface MissionLastRow {
  organization_id: string
  created_at: string
}

export interface StorageOverview {
  kpi: StorageOverviewKpi
  rows: StorageOrgRow[]
}

/**
 * Convertit bytes → Go arrondi à 2 décimales (display admin).
 */
export function bytesToGo(bytes: number): number {
  return Math.round((bytes / GB) * 100) / 100
}

/**
 * Charge l'ensemble des organisations avec leur consommation de stockage,
 * triées par usage descendant. Pas de pagination DB-side : le volume total
 * d'orgs reste modeste (< 5000 attendus à M24) — pagination est gérée côté UI.
 */
export async function getStorageOverview(
  supabase: SupabaseClient<Database>,
  options: {
    plan?: string | null
    minPct?: number | null
  } = {},
): Promise<StorageOverview> {
  // Cast typé local : storage_used_bytes / storage_quota_bytes ajoutés par
  // la migration 20260524100000 (types Supabase à régénérer).
  const orgsRes = (await supabase
    .from('organizations')
    .select('id, name, plan, storage_used_bytes, storage_quota_bytes')
    .is('deleted_at', null)) as unknown as {
    data: OrgRowWithStorage[] | null
    error: { message: string } | null
  }

  const orgs = orgsRes.data ?? []

  // Dernière mission par org (1 requête, group côté JS — volume raisonnable)
  const missionsRes = await supabase
    .from('missions')
    .select('organization_id, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const lastMissionByOrg = new Map<string, string>()
  for (const m of (missionsRes.data ?? []) as MissionLastRow[]) {
    if (!lastMissionByOrg.has(m.organization_id)) {
      lastMissionByOrg.set(m.organization_id, m.created_at)
    }
  }

  let rows: StorageOrgRow[] = orgs.map((o) => {
    const used = o.storage_used_bytes ?? 0
    const quota = o.storage_quota_bytes ?? 1 // évite div/0
    const pct = quota > 0 ? Math.round((used / quota) * 1000) / 10 : 0
    return {
      organization_id: o.id,
      organization_name: o.name,
      plan: o.plan,
      storage_used_bytes: used,
      storage_quota_bytes: quota,
      utilization_pct: pct,
      last_mission_at: lastMissionByOrg.get(o.id) ?? null,
    }
  })

  // Filtres
  if (options.plan && options.plan !== 'all') {
    rows = rows.filter((r) => r.plan === options.plan)
  }
  if (options.minPct && options.minPct > 0) {
    rows = rows.filter((r) => r.utilization_pct >= options.minPct!)
  }

  rows.sort((a, b) => b.storage_used_bytes - a.storage_used_bytes)

  // KPIs globaux (calculés sur l'univers complet, pas le filtré)
  const totalUsed = orgs.reduce((sum, o) => sum + (o.storage_used_bytes ?? 0), 0)
  const totalQuota = orgs.reduce((sum, o) => sum + (o.storage_quota_bytes ?? 0), 0)
  const orgsAbove80 = orgs.filter((o) => {
    const used = o.storage_used_bytes ?? 0
    const quota = o.storage_quota_bytes ?? 1
    return quota > 0 && used / quota >= 0.8
  }).length
  const orgsAbove100 = orgs.filter((o) => {
    const used = o.storage_used_bytes ?? 0
    const quota = o.storage_quota_bytes ?? 1
    return quota > 0 && used >= quota
  }).length

  return {
    kpi: {
      totalUsedGo: bytesToGo(totalUsed),
      totalQuotaGo: bytesToGo(totalQuota),
      orgsAbove80,
      orgsAbove100,
      totalOrgs: orgs.length,
    },
    rows,
  }
}
