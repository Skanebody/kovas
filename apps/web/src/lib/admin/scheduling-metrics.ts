/**
 * KOVAS — Service calculator scheduling admin (Partition 3).
 *
 * Métriques agrégées pour le dashboard admin :
 *   - Précision estimations durée (mission_duration_history.diff_min)
 *   - Quota DPE par user (top users surveillés)
 *   - Conflits détectés (vue agrégée — pas de table tracking V1)
 *   - Trajets économisés via clustering (estimation V1)
 *   - Coefficients personnels users (user_duration_coefficients)
 *
 * NB : V1 ne stocke pas les événements conflits/clustering individuellement.
 * Les sections "Conflits détectés" et "Clustering adoption" sont basées sur
 * des proxies (dossiers récents avec coordonnées + comparaison naïve), à
 * remplacer en V2 par une table d'événements scheduling_events.
 *
 * Toutes les fonctions reçoivent le client admin service-role créé après
 * verifyAdminAccess().
 */

import { DPE_ANNUAL_LIMIT } from '@/lib/admin/dpe-quota-tracker'
import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type AdminSupabase = SupabaseClient<Database>

// ============================================
// Types publics
// ============================================

export interface DurationAccuracyPoint {
  /** YYYY-MM-DD (Europe/Paris). */
  date: string
  /** Moyenne diff_min (actual - estimated) sur les missions complétées ce jour. */
  avgDiffMin: number
  /** Nombre de missions agrégées. */
  sampleSize: number
}

export interface DurationAccuracySummary {
  /** Moyenne sur les 30 derniers jours (toutes missions confondues). */
  avgDiffMin30d: number
  /** Nombre total de missions agrégées. */
  sampleSize: number
  /** Série temporelle jour par jour pour Recharts. */
  series: DurationAccuracyPoint[]
}

export interface ConflictCount {
  detected: number
  resolved: number
}

export interface DpeQuotaUserRow {
  userId: string
  userEmail: string | null
  dpeCount: number
  percentUsed: number
  severity: 'info' | 'warning' | 'critical' | 'ok'
}

export interface ClusteringAdoption {
  suggested: number
  accepted: number
  rate: number
  /** Total minutes économisés (estimation 25 min/mission groupée). */
  savingsMin: number
}

export interface UserSpeedRow {
  userId: string
  userEmail: string | null
  globalCoefficient: number
  sampleSize: number
  /** Diff avec moyenne en pourcentage (négatif = plus rapide que moyenne). */
  vsAverage: number
  enabled: boolean
}

export interface SchedulingMetricsSnapshot {
  durationAccuracy: DurationAccuracySummary
  conflicts: ConflictCount
  dpeQuotaTop: DpeQuotaUserRow[]
  clustering: ClusteringAdoption
  userSpeed: UserSpeedRow[]
}

// ============================================
// Helpers date Europe/Paris
// ============================================

function parisYmd(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

// ============================================
// Rows intermédiaires
// ============================================

interface DurationHistoryRow {
  diff_min: number | null
  completed_at: string | null
}

interface DurationCoefRow {
  user_id: string
  global_coefficient: number | string | null
  sample_size_total: number | null
  enabled: boolean | null
}

interface ProfileRow {
  id: string
  email: string | null
}

interface ConflictDossierRow {
  id: string
  user_id: string | null
  scheduled_at: string | null
  geo_lat: number | string | null
  geo_lng: number | string | null
  estimated_duration_min: number | null
  forced_duration_min: number | null
  status: string | null
  created_by: string | null
}

// ============================================
// 1. Précision estimations durée — fenêtre 30j
// ============================================

export async function getDurationAccuracy(
  supabase: AdminSupabase,
  days = 30,
): Promise<DurationAccuracySummary> {
  const sinceIso = daysAgoIso(days)

  const { data, error } = await supabase
    .from('mission_duration_history')
    .select('diff_min, completed_at')
    .gte('completed_at', sinceIso)
    .not('actual_duration_min', 'is', null)

  if (error) {
    throw new Error(`getDurationAccuracy: ${error.message}`)
  }

  const rows = ((data ?? []) as unknown as DurationHistoryRow[]).filter(
    (r) => r.diff_min !== null && r.completed_at !== null,
  )

  if (rows.length === 0) {
    return { avgDiffMin30d: 0, sampleSize: 0, series: [] }
  }

  // Agrégation par jour Europe/Paris
  const byDay = new Map<string, { sum: number; count: number }>()
  let totalSum = 0
  for (const row of rows) {
    if (row.completed_at === null || row.diff_min === null) continue
    const day = parisYmd(new Date(row.completed_at))
    const slot = byDay.get(day) ?? { sum: 0, count: 0 }
    slot.sum += row.diff_min
    slot.count += 1
    byDay.set(day, slot)
    totalSum += row.diff_min
  }

  const series: DurationAccuracyPoint[] = Array.from(byDay.entries())
    .map(([date, { sum, count }]) => ({
      date,
      avgDiffMin: Math.round((sum / count) * 10) / 10,
      sampleSize: count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    avgDiffMin30d: Math.round((totalSum / rows.length) * 10) / 10,
    sampleSize: rows.length,
    series,
  }
}

// ============================================
// 2. Top users surveillés DPE quota
// ============================================

export async function getDpeQuotaTopUsers(
  supabase: AdminSupabase,
  limit = 10,
): Promise<DpeQuotaUserRow[]> {
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  const sinceIso = twelveMonthsAgo.toISOString()

  // Le type de diagnostic vit sur `missions.type` (PAS sur `dossiers` — qui n'a
  // jamais eu de colonne `type`). On récupère donc d'abord les dossiers porteurs
  // d'au moins une mission DPE, puis on filtre ces dossiers (statut + fenêtre).
  const { data: dpeMissions, error: missionsErr } = await supabase
    .from('missions')
    .select('dossier_id')
    .in('type', ['dpe_vente', 'dpe_location'])

  if (missionsErr) {
    throw new Error(`getDpeQuotaTopUsers missions: ${missionsErr.message}`)
  }

  const dpeDossierIds = [
    ...new Set(
      ((dpeMissions ?? []) as { dossier_id: string | null }[])
        .map((m) => m.dossier_id)
        .filter((id): id is string => id !== null),
    ),
  ]

  if (dpeDossierIds.length === 0) return []

  // Dossiers DPE complétés sur 12 mois (status done/exported), un dossier = un DPE.
  const { data: dossiers, error } = await supabase
    .from('dossiers')
    .select('created_by')
    .in('id', dpeDossierIds)
    .in('status', ['done', 'exported'])
    .gte('completed_at', sinceIso)
    .not('created_by', 'is', null)

  if (error) {
    throw new Error(`getDpeQuotaTopUsers dossiers: ${error.message}`)
  }

  const rows = (dossiers ?? []) as { created_by: string | null }[]

  // Compter par user
  const countByUser = new Map<string, number>()
  for (const row of rows) {
    if (!row.created_by) continue
    countByUser.set(row.created_by, (countByUser.get(row.created_by) ?? 0) + 1)
  }

  if (countByUser.size === 0) return []

  // Récupère les profiles correspondants
  const userIds = Array.from(countByUser.keys())
  const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', userIds)
  const profileMap = new Map<string, string | null>()
  for (const p of (profiles ?? []) as ProfileRow[]) {
    profileMap.set(p.id, p.email)
  }

  const result: DpeQuotaUserRow[] = userIds.map((userId) => {
    const dpeCount = countByUser.get(userId) ?? 0
    const percentUsed = Math.round((dpeCount / DPE_ANNUAL_LIMIT) * 10000) / 100
    let severity: DpeQuotaUserRow['severity'] = 'ok'
    if (percentUsed >= 100) severity = 'critical'
    else if (percentUsed >= 95) severity = 'warning'
    else if (percentUsed >= 80) severity = 'info'

    return {
      userId,
      userEmail: profileMap.get(userId) ?? null,
      dpeCount,
      percentUsed,
      severity,
    }
  })

  result.sort((a, b) => b.dpeCount - a.dpeCount)
  return result.slice(0, limit)
}

// ============================================
// 3. Conflits détectés (V1 estimation — pas de table d'events)
// ============================================

/**
 * Estimation V1 : on parcourt les dossiers planifiés des 30 derniers jours
 * groupés par (user_id, jour_paris) et on compte les paires temporellement
 * trop proches (< 30 min entre fin_estimée et début_suivant).
 *
 * V2 : remplacer par lecture d'une table `scheduling_events` qui logue
 * détection + résolution via alternative.
 */
export async function getConflictDetectionStats(
  supabase: AdminSupabase,
  days = 30,
): Promise<ConflictCount> {
  const sinceIso = daysAgoIso(days)

  const { data, error } = await supabase
    .from('dossiers')
    .select(
      'id, created_by, assigned_to, scheduled_at, geo_lat, geo_lng, estimated_duration_min, forced_duration_min, status',
    )
    .gte('scheduled_at', sinceIso)
    .not('scheduled_at', 'is', null)
    .neq('status', 'cancelled')

  if (error) {
    // On retombe sur 0 si erreur (colonnes geo_* éventuellement absentes du type generated)
    return { detected: 0, resolved: 0 }
  }

  // On utilise `created_by` comme proxy user_id pour l'agrégation.
  interface Row {
    id: string
    user_id: string | null
    scheduled_at: string | null
    estimated_duration_min: number | null
    forced_duration_min: number | null
    status: string | null
  }
  const rows = (
    (data ?? []) as unknown as Array<{
      id: string
      created_by: string | null
      assigned_to: string | null
      scheduled_at: string | null
      estimated_duration_min: number | null
      forced_duration_min: number | null
      status: string | null
    }>
  ).map<Row>((r) => ({
    id: r.id,
    user_id: r.assigned_to ?? r.created_by ?? null,
    scheduled_at: r.scheduled_at,
    estimated_duration_min: r.estimated_duration_min,
    forced_duration_min: r.forced_duration_min,
    status: r.status,
  }))

  // Group by user + day, trier par scheduled_at
  const byKey = new Map<string, Row[]>()
  for (const row of rows) {
    if (!row.user_id || !row.scheduled_at) continue
    const day = parisYmd(new Date(row.scheduled_at))
    const key = `${row.user_id}_${day}`
    const list = byKey.get(key) ?? []
    list.push(row)
    byKey.set(key, list)
  }

  let detected = 0
  let resolved = 0
  for (const list of byKey.values()) {
    const sorted = [...list].sort((a, b) => {
      const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0
      const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0
      return ta - tb
    })
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const cur = sorted[i]
      if (!prev?.scheduled_at || !cur?.scheduled_at) continue
      const prevStart = new Date(prev.scheduled_at).getTime()
      const curStart = new Date(cur.scheduled_at).getTime()
      const prevDur = (prev.forced_duration_min ?? prev.estimated_duration_min ?? 90) * 60_000
      const gapMin = (curStart - (prevStart + prevDur)) / 60_000
      if (gapMin < 15) {
        detected += 1
        // Heuristique V1 : si la mission est "done" ou "exported", on considère
        // que l'utilisateur a résolu le conflit (sinon il y aurait eu annulation).
        if (cur.status === 'done' || cur.status === 'exported') resolved += 1
      }
    }
  }

  return { detected, resolved }
}

// ============================================
// 4. Clustering adoption (V1 estimation)
// ============================================

/**
 * V1 : pas de tracking des suggestions affichées vs acceptées.
 * On estime "accepté" comme : dossiers d'un même user dans un rayon de 5 km
 * planifiés le même jour (proxy = comportement de clustering effectif).
 *
 * V2 : table `clustering_suggestions(user_id, dossier_id, accepted_at)`.
 */
export async function getClusteringAdoption(
  supabase: AdminSupabase,
  days = 30,
): Promise<ClusteringAdoption> {
  const sinceIso = daysAgoIso(days)

  const { data, error } = await supabase
    .from('dossiers')
    .select('id, created_by, assigned_to, scheduled_at, geo_lat, geo_lng, status')
    .gte('scheduled_at', sinceIso)
    .not('scheduled_at', 'is', null)
    .neq('status', 'cancelled')

  if (error) {
    return { suggested: 0, accepted: 0, rate: 0, savingsMin: 0 }
  }

  const rows = (
    (data ?? []) as unknown as Array<{
      id: string
      created_by: string | null
      assigned_to: string | null
      scheduled_at: string | null
      geo_lat: number | string | null
      geo_lng: number | string | null
    }>
  ).filter((r) => r.scheduled_at && r.geo_lat !== null && r.geo_lng !== null)

  // Group by (user, day), compter dossiers proches (rayon 5 km)
  const byKey = new Map<string, Array<{ id: string; lat: number; lng: number }>>()
  for (const r of rows) {
    const user = r.assigned_to ?? r.created_by
    if (!user || !r.scheduled_at) continue
    const day = parisYmd(new Date(r.scheduled_at))
    const key = `${user}_${day}`
    const list = byKey.get(key) ?? []
    list.push({
      id: r.id,
      lat: Number(r.geo_lat),
      lng: Number(r.geo_lng),
    })
    byKey.set(key, list)
  }

  // Estimation : suggested = nombre total de jours-users avec ≥ 2 missions
  // accepted = nombre de jours-users avec ≥ 2 missions toutes dans rayon 5 km
  let suggested = 0
  let accepted = 0
  for (const list of byKey.values()) {
    if (list.length < 2) continue
    suggested += 1
    // Distance moyenne entre toutes paires
    const first = list[0]
    if (!first) continue
    let allWithinRadius = true
    for (let i = 1; i < list.length; i++) {
      const cur = list[i]
      if (!cur) continue
      const d = haversineKm(first.lat, first.lng, cur.lat, cur.lng)
      if (d > 5) {
        allWithinRadius = false
        break
      }
    }
    if (allWithinRadius) accepted += list.length // chaque mission groupée
  }

  const rate = suggested > 0 ? Math.round((accepted / suggested) * 1000) / 10 : 0
  return {
    suggested,
    accepted,
    rate,
    savingsMin: accepted * 25,
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// ============================================
// 5. Coefficients personnels users
// ============================================

export async function getUserSpeedCoefficients(
  supabase: AdminSupabase,
  limit = 25,
): Promise<UserSpeedRow[]> {
  const { data, error } = await supabase
    .from('user_duration_coefficients')
    .select('user_id, global_coefficient, sample_size_total, enabled')
    .order('sample_size_total', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`getUserSpeedCoefficients: ${error.message}`)
  }

  const rows = (data ?? []) as unknown as DurationCoefRow[]
  if (rows.length === 0) return []

  // Récupère profiles
  const userIds = rows.map((r) => r.user_id)
  const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', userIds)
  const profileMap = new Map<string, string | null>()
  for (const p of (profiles ?? []) as ProfileRow[]) {
    profileMap.set(p.id, p.email)
  }

  // Moyenne globale (pondérée par sample_size)
  let totalSampleCoef = 0
  let totalSample = 0
  for (const r of rows) {
    const coef = Number(r.global_coefficient ?? 1)
    const size = r.sample_size_total ?? 0
    totalSampleCoef += coef * size
    totalSample += size
  }
  const avgCoef = totalSample > 0 ? totalSampleCoef / totalSample : 1

  return rows.map((r) => {
    const coef = Number(r.global_coefficient ?? 1)
    const vsAverage = avgCoef !== 0 ? Math.round(((coef - avgCoef) / avgCoef) * 10000) / 100 : 0
    return {
      userId: r.user_id,
      userEmail: profileMap.get(r.user_id) ?? null,
      globalCoefficient: Math.round(coef * 1000) / 1000,
      sampleSize: r.sample_size_total ?? 0,
      vsAverage,
      enabled: r.enabled === true,
    }
  })
}

// ============================================
// 6. Agrégation snapshot complet (utilisé par /api/admin/scheduling/metrics)
// ============================================

export async function getSchedulingMetricsSnapshot(
  supabase: AdminSupabase,
): Promise<SchedulingMetricsSnapshot> {
  const [durationAccuracy, conflicts, dpeQuotaTop, clustering, userSpeed] = await Promise.all([
    getDurationAccuracy(supabase, 30),
    getConflictDetectionStats(supabase, 30),
    getDpeQuotaTopUsers(supabase, 10),
    getClusteringAdoption(supabase, 30),
    getUserSpeedCoefficients(supabase, 25),
  ])

  return {
    durationAccuracy,
    conflicts,
    dpeQuotaTop,
    clustering,
    userSpeed,
  }
}

// _ConflictDossierRow réservé export futur API typed
export type { ConflictDossierRow }
