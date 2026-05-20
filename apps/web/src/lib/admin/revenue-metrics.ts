/**
 * KOVAS — Service calculator revenue admin (Partition 3).
 *
 * Métriques basées sur `mission_pricing_snapshots` :
 *   - CA prévisionnel : status='estimated' + dossier.scheduled_at dans 30j
 *   - CA réalisé : status='mission_done' + status_updated_at récent
 *   - Panier moyen (HT et TTC)
 *   - Adoption des packs custom (user_pricing_packs)
 *   - Comparaison anonymisée pricing par diagnostic
 *
 * Tous les montants stockés en numeric Postgres → string en JS → parseFloat safe.
 */

import { PREDEFINED_PACKS } from '@/lib/pricing/pack-definitions'
import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type AdminSupabase = SupabaseClient<Database>

// ============================================
// Types publics
// ============================================

export interface RevenueForecast {
  /** Somme des total_ttc des snapshots 'estimated' sur la fenêtre forward. */
  forecastTtc: number
  forecastHt: number
  /** Nombre de missions estimées planifiées. */
  count: number
  /** Panier moyen TTC. */
  avgTicketTtc: number
}

export interface RevenueRealized {
  /** Somme des total_ttc des snapshots 'mission_done' sur la fenêtre. */
  realizedTtc: number
  realizedHt: number
  count: number
  avgTicketTtc: number
  /** Marge KOVAS estimée : commission V2 ; en V1 c'est juste le CA des users. */
  marginEstimate: number
}

export interface PackAdoptionRow {
  packId: string
  packName: string
  orgsCount: number
}

export interface PricingComparisonRow {
  /** Numero anonyme (1..N) pour ne pas exposer user_id. */
  anon: number
  /** Map diagnostic → prix HT moyen pratiqué. */
  prices: Record<string, number | null>
  /** True si > 20% écart vs moyenne sur au moins un diag. */
  outlier: boolean
}

export interface PricingComparison {
  /** Moyennes anonymisées par diagnostic (clé = TYPE). */
  averages: Record<string, number>
  /** Rangée par user anonymisé. */
  rows: PricingComparisonRow[]
  /** Diagnostics présents dans la comparaison. */
  diagnostics: string[]
}

// ============================================
// Rows intermédiaires
// ============================================

interface PricingSnapshotRow {
  total_ht: number | string | null
  total_ttc: number | string | null
  status: string
  dossier_id: string
  user_id: string
  status_updated_at: string | null
  estimated_at: string | null
}

interface DossierScheduledRow {
  id: string
  scheduled_at: string | null
}

interface PricingPackRow {
  predefined_pack_id: string | null
  organization_id: string
  is_active: boolean
}

interface PricingConfigRow {
  user_id: string
  pricing_config: unknown
}

// ============================================
// Helpers
// ============================================

function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0
  return typeof v === 'number' ? v : Number.parseFloat(v) || 0
}

function daysAheadIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

// ============================================
// 1. CA prévisionnel — fenêtre forward 30j
// ============================================

export async function getRevenueForecast(
  supabase: AdminSupabase,
  daysForward = 30,
): Promise<RevenueForecast> {
  const now = new Date().toISOString()
  const forwardIso = daysAheadIso(daysForward)

  // 1. Récupérer les snapshots 'estimated'
  const { data: snaps, error: snapErr } = await supabase
    .from('mission_pricing_snapshots')
    .select('dossier_id, total_ht, total_ttc, status, estimated_at, status_updated_at, user_id')
    .eq('status', 'estimated')

  if (snapErr) {
    throw new Error(`getRevenueForecast snapshots: ${snapErr.message}`)
  }

  const snapshots = (snaps ?? []) as unknown as PricingSnapshotRow[]
  if (snapshots.length === 0) {
    return { forecastTtc: 0, forecastHt: 0, count: 0, avgTicketTtc: 0 }
  }

  // 2. Filtrer par scheduled_at dans la fenêtre via dossiers
  const dossierIds = Array.from(new Set(snapshots.map((s) => s.dossier_id)))
  const { data: dossiers } = await supabase
    .from('dossiers')
    .select('id, scheduled_at')
    .in('id', dossierIds)
    .gte('scheduled_at', now)
    .lte('scheduled_at', forwardIso)
    .not('scheduled_at', 'is', null)

  const validDossierIds = new Set(
    ((dossiers ?? []) as unknown as DossierScheduledRow[]).map((d) => d.id),
  )

  const inWindow = snapshots.filter((s) => validDossierIds.has(s.dossier_id))

  const forecastTtc = inWindow.reduce((acc, s) => acc + num(s.total_ttc), 0)
  const forecastHt = inWindow.reduce((acc, s) => acc + num(s.total_ht), 0)
  const count = inWindow.length
  const avgTicketTtc = count > 0 ? Math.round((forecastTtc / count) * 100) / 100 : 0

  return {
    forecastTtc: Math.round(forecastTtc * 100) / 100,
    forecastHt: Math.round(forecastHt * 100) / 100,
    count,
    avgTicketTtc,
  }
}

// ============================================
// 2. CA réalisé — fenêtre back 30j
// ============================================

export async function getRevenueRealized(
  supabase: AdminSupabase,
  daysBack = 30,
): Promise<RevenueRealized> {
  const sinceIso = daysAgoIso(daysBack)

  const { data, error } = await supabase
    .from('mission_pricing_snapshots')
    .select('total_ht, total_ttc, status, status_updated_at, dossier_id, user_id, estimated_at')
    .eq('status', 'mission_done')
    .gte('status_updated_at', sinceIso)

  if (error) {
    throw new Error(`getRevenueRealized: ${error.message}`)
  }

  const rows = (data ?? []) as unknown as PricingSnapshotRow[]
  const realizedTtc = rows.reduce((acc, r) => acc + num(r.total_ttc), 0)
  const realizedHt = rows.reduce((acc, r) => acc + num(r.total_ht), 0)
  const count = rows.length
  const avgTicketTtc = count > 0 ? Math.round((realizedTtc / count) * 100) / 100 : 0

  return {
    realizedTtc: Math.round(realizedTtc * 100) / 100,
    realizedHt: Math.round(realizedHt * 100) / 100,
    count,
    avgTicketTtc,
    // V1 : pas de commission KOVAS → marge = 0
    // V2 (Phase 2 Cabinet) : commission % du CA des users
    marginEstimate: 0,
  }
}

// ============================================
// 3. Adoption des packs (PREDEFINED_PACKS instanciés par orgs)
// ============================================

export async function getPackAdoption(supabase: AdminSupabase): Promise<PackAdoptionRow[]> {
  const { data, error } = await supabase
    .from('user_pricing_packs')
    .select('predefined_pack_id, organization_id, is_active')
    .eq('is_active', true)
    .not('predefined_pack_id', 'is', null)

  if (error) {
    throw new Error(`getPackAdoption: ${error.message}`)
  }

  const rows = (data ?? []) as unknown as PricingPackRow[]

  const orgsByPack = new Map<string, Set<string>>()
  for (const r of rows) {
    if (!r.predefined_pack_id) continue
    const set = orgsByPack.get(r.predefined_pack_id) ?? new Set<string>()
    set.add(r.organization_id)
    orgsByPack.set(r.predefined_pack_id, set)
  }

  return PREDEFINED_PACKS.map((p) => ({
    packId: p.id,
    packName: p.name,
    orgsCount: orgsByPack.get(p.id)?.size ?? 0,
  })).sort((a, b) => b.orgsCount - a.orgsCount)
}

// ============================================
// 4. Comparaison pricing anonymisée
// ============================================

interface PricingConfigPayload {
  diagnostics?: Record<string, { basePrice?: number } | undefined>
}

export async function getPricingComparison(
  supabase: AdminSupabase,
  diagnostics: string[] = ['DPE', 'AMIANTE', 'PLOMB', 'GAZ', 'ELEC', 'TERMITES', 'CARREZ', 'ERP'],
): Promise<PricingComparison> {
  const { data, error } = await supabase
    .from('user_pricing_config')
    .select('user_id, pricing_config')
    .eq('has_configured', true)

  if (error) {
    throw new Error(`getPricingComparison: ${error.message}`)
  }

  const rows = (data ?? []) as unknown as PricingConfigRow[]
  if (rows.length === 0) {
    return { averages: {}, rows: [], diagnostics }
  }

  // Extraire basePrice pour chaque user × diag
  const userPrices: Array<{ userId: string; prices: Record<string, number | null> }> = []
  for (const row of rows) {
    const config = (row.pricing_config ?? {}) as PricingConfigPayload
    const prices: Record<string, number | null> = {}
    for (const diag of diagnostics) {
      const diagCfg = config.diagnostics?.[diag]
      const base = diagCfg?.basePrice
      prices[diag] = typeof base === 'number' && base > 0 ? base : null
    }
    userPrices.push({ userId: row.user_id, prices })
  }

  // Moyennes par diagnostic
  const averages: Record<string, number> = {}
  for (const diag of diagnostics) {
    const vals = userPrices
      .map((u) => u.prices[diag])
      .filter((v): v is number => typeof v === 'number')
    if (vals.length > 0) {
      const sum = vals.reduce((a, b) => a + b, 0)
      averages[diag] = Math.round((sum / vals.length) * 100) / 100
    } else {
      averages[diag] = 0
    }
  }

  // Détection outliers par user (≥ 20% écart sur au moins un diag)
  const rowsAnon: PricingComparisonRow[] = userPrices.map((u, idx) => {
    let outlier = false
    for (const diag of diagnostics) {
      const price = u.prices[diag]
      const avg = averages[diag] ?? 0
      if (price === null || avg === 0) continue
      const ratio = (price - avg) / avg
      if (ratio > 0.2 || ratio < -0.2) {
        outlier = true
        break
      }
    }
    return {
      anon: idx + 1,
      prices: u.prices,
      outlier,
    }
  })

  return {
    averages,
    rows: rowsAnon,
    diagnostics,
  }
}
