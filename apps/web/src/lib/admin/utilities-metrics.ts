/**
 * Analytics adoption des Utilities terrain (5 outils) pour la page /admin/utilities.
 *
 * Tables consommées :
 *   - `utilities_usage` (user_id, utility, context, used_at)  ← créée par autre agent
 *   - `profiles` (id, last_active_at)                         ← pour comptage users actifs
 *
 * Stratégie V1 : lecture des rows brutes des 30 derniers jours puis agrégation
 * JS (volumes attendus < 50k rows/mois). En V2, basculer vers RPC SQL si latence
 * > 1s. Toutes les fonctions retournent des valeurs neutres ([]) si la table
 * est vide ou n'existe pas encore.
 *
 * Note typage : la table `utilities_usage` n'est pas (encore) dans le Database
 * type généré — on type localement les rows lues, comme `admin-middleware.ts`
 * le fait pour `admin_users`.
 */

import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// Types publics
// ============================================

export type UtilityName =
  | 'diagnostic_requirements'
  | 'validity_checker'
  | 'surface_calculator'
  | 'client_template_generator'
  | 'pre_departure_checklist'

export interface UtilityAdoptionEntry {
  name: UtilityName
  label: string
  usageCount30d: number
  uniqueUsers30d: number
  uniqueUsersPercent: number // % vs users actifs ce mois
}

export interface UtilityCohortRow {
  cohortMonth: string // 'YYYY-MM'
  diagnosticReq: number
  validityChecker: number
  surfaceCalc: number
  templates: number
  checklist: number
}

export interface UtilitiesAdoption {
  tools: UtilityAdoptionEntry[]
  byCohort: UtilityCohortRow[]
  activeUsersThisMonth: number
}

// ============================================
// Mapping nom technique → label FR
// ============================================

const UTILITY_LABELS: Record<UtilityName, string> = {
  diagnostic_requirements: 'Diagnostics requis',
  validity_checker: 'Vérif. validité',
  surface_calculator: 'Calcul surface',
  client_template_generator: 'Templates pièces',
  pre_departure_checklist: 'Checklist départ',
}

const UTILITIES: UtilityName[] = [
  'diagnostic_requirements',
  'validity_checker',
  'surface_calculator',
  'client_template_generator',
  'pre_departure_checklist',
]

// ============================================
// Types row partiels (tables pas (encore) typées)
// ============================================

interface UtilitiesUsageRow {
  user_id: string
  utility: string
  used_at: string
}

interface ProfileLastActiveRow {
  id: string
  last_active_at: string | null
}

// ============================================
// Helpers temps
// ============================================

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function startOfThisMonthIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

function startOfMonthsAgoIso(monthsAgo: number): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1).toISOString()
}

function monthKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

// ============================================
// Public API
// ============================================

export async function getUtilitiesAdoption(
  supabase: SupabaseClient<Database>,
): Promise<UtilitiesAdoption> {
  const since30dIso = daysAgoIso(30)
  const since6mIso = startOfMonthsAgoIso(5) // 6 cohortes (mois M-5 → M0)

  // 1. Usage 30j
  // biome-ignore lint/suspicious/noExplicitAny: table non-encore typée dans Database
  const usageRes = await (supabase as any)
    .from('utilities_usage')
    .select('user_id, utility, used_at')
    .gte('used_at', since30dIso)

  const usage30d: UtilitiesUsageRow[] = Array.isArray(usageRes?.data)
    ? (usageRes.data as UtilitiesUsageRow[])
    : []

  // 2. Usage 6 mois (pour cohortes)
  // biome-ignore lint/suspicious/noExplicitAny: table non-encore typée dans Database
  const cohortRes = await (supabase as any)
    .from('utilities_usage')
    .select('user_id, utility, used_at')
    .gte('used_at', since6mIso)

  const usage6m: UtilitiesUsageRow[] = Array.isArray(cohortRes?.data)
    ? (cohortRes.data as UtilitiesUsageRow[])
    : []

  // 3. Active users ce mois (last_active_at >= 1er du mois)
  const startMonth = startOfThisMonthIso()
  const profilesRes = await supabase
    .from('profiles')
    .select('id, last_active_at')
    .not('last_active_at', 'is', null)
    .gte('last_active_at', startMonth)

  const activeProfiles: ProfileLastActiveRow[] = Array.isArray(profilesRes.data)
    ? (profilesRes.data as ProfileLastActiveRow[])
    : []
  const activeUsersThisMonth = activeProfiles.length

  // 4. Agrégation par outil (30j)
  const tools: UtilityAdoptionEntry[] = UTILITIES.map((name) => {
    const filtered = usage30d.filter((r) => r.utility === name)
    const uniqueUsers = new Set(filtered.map((r) => r.user_id))
    const uniqueCount = uniqueUsers.size
    const percent = activeUsersThisMonth > 0 ? (uniqueCount / activeUsersThisMonth) * 100 : 0
    return {
      name,
      label: UTILITY_LABELS[name],
      usageCount30d: filtered.length,
      uniqueUsers30d: uniqueCount,
      uniqueUsersPercent: percent,
    }
  })

  // 5. Cohortes : 6 derniers mois × 5 outils
  const cohortsMap = new Map<string, UtilityCohortRow>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    cohortsMap.set(key, {
      cohortMonth: key,
      diagnosticReq: 0,
      validityChecker: 0,
      surfaceCalc: 0,
      templates: 0,
      checklist: 0,
    })
  }

  for (const row of usage6m) {
    const key = monthKey(row.used_at)
    const cohort = cohortsMap.get(key)
    if (!cohort) continue
    switch (row.utility) {
      case 'diagnostic_requirements':
        cohort.diagnosticReq += 1
        break
      case 'validity_checker':
        cohort.validityChecker += 1
        break
      case 'surface_calculator':
        cohort.surfaceCalc += 1
        break
      case 'client_template_generator':
        cohort.templates += 1
        break
      case 'pre_departure_checklist':
        cohort.checklist += 1
        break
    }
  }

  return {
    tools,
    byCohort: [...cohortsMap.values()],
    activeUsersThisMonth,
  }
}
