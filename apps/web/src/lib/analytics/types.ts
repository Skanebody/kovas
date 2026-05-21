/**
 * Types partagés Analytics Business — snapshots + benchmarks anonymisés.
 *
 * Source : migrations
 *   - 20260525190000_business_analytics_snapshots.sql
 *   - 20260525191000_anonymous_benchmarks.sql
 */

export type AnalyticsPeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface BusinessAnalyticsSnapshotRow {
  id: string
  organization_id: string
  snapshot_period: string // date YYYY-MM-DD
  period_type: AnalyticsPeriodType
  missions_total: number
  missions_completed: number
  missions_exported: number
  missions_cancelled: number
  diagnostic_mix: Record<string, number>
  revenue_ht_cents: number
  revenue_ttc_cents: number
  avg_mission_value_cents: number
  ai_cost_cents: number
  variable_cost_cents: number
  gross_margin_cents: number
  gross_margin_ratio: number | null
  avg_time_to_export_seconds: number | null
  avg_voice_seconds_per_mission: number | null
  avg_photos_per_mission: number | null
  by_day_of_week: Record<string, number> | null
  by_hour_of_day: Record<string, number> | null
  unique_clients: number
  recurring_clients: number
  top_client_share_pct: number | null
  top_departments: Array<{ code: string; count: number }> | null
  estimated_time_saved_seconds: number
  created_at: string
  updated_at: string
}

export type BenchmarkScope = 'national' | 'region' | 'department' | 'custom'
export type CabinetSegment = 'all' | 'solo' | 'small' | 'medium' | 'large' | 'founders'

export interface AnonymousBenchmarkRow {
  id: string
  snapshot_period: string
  period_type: 'month' | 'quarter' | 'year'
  scope: BenchmarkScope
  scope_code: string | null
  cabinet_segment: CabinetSegment
  diagnostic_kind: string | null
  cabinets_count: number
  missions_count: number
  k_anonymity_threshold: number
  median_missions_per_cabinet: number | null
  p25_missions_per_cabinet: number | null
  p75_missions_per_cabinet: number | null
  median_time_to_export_seconds: number | null
  p25_time_to_export_seconds: number | null
  p75_time_to_export_seconds: number | null
  diagnostic_mix_pct: Record<string, number>
  median_mission_value_cents: number | null
  p25_mission_value_cents: number | null
  p75_mission_value_cents: number | null
  median_gross_margin_ratio: number | null
  median_time_saved_seconds_per_mission: number | null
  created_at: string
  updated_at: string
}

/**
 * Tiers accessibles aux analytics business. Cohérent avec
 * docs CLAUDE.md §4 : "standard", "volume" et toutes les variantes (founder, complet…).
 *
 * Cible : tout tier qui contient "standard" / "volume" / "cabinet" en sous-chaîne.
 * Le tier "decouverte" et l'absence d'abonnement sont gated.
 */
const ALLOWED_TIER_KEYWORDS = ['standard', 'volume', 'cabinet'] as const

export function isAnalyticsEnabled(tier: string | null | undefined): boolean {
  if (!tier) return false
  const lower = tier.toLowerCase()
  return ALLOWED_TIER_KEYWORDS.some((kw) => lower.includes(kw))
}

/** Seuil k-anonymity côté UI : on n'affiche jamais < 5 cabinets. */
export const BENCHMARK_MIN_SAMPLE_SIZE = 5

export function isBenchmarkSafe(row: Pick<AnonymousBenchmarkRow, 'cabinets_count'>): boolean {
  return row.cabinets_count >= BENCHMARK_MIN_SAMPLE_SIZE
}

/**
 * Health score composite 0-100 :
 *   revenue       (30%) — CA mois / objectif normalisé
 *   conversion    (20%) — devis signés / envoyés
 *   diversity     (20%) — diversité prescripteurs (inverse Herfindahl)
 *   growth        (30%) — variation mois-1 vs mois-2
 */
export interface HealthScoreInputs {
  /** CA HT du mois en cents (>= 0). */
  revenueCents: number
  /** Objectif normalisé : 8 000 € HT/mois solopreneur (référence Standard). */
  revenueTargetCents?: number
  /** Ratio 0..1 — null si aucun devis envoyé. */
  conversionRatio: number | null
  /** Score diversity 0..1 — 1 = parfaitement diversifié. */
  diversityScore: number | null
  /** Variation % mois actuel vs mois précédent (-1 à +∞). */
  growthRatio: number | null
}

export interface HealthScoreBreakdown {
  total: number // 0..100
  revenue: number
  conversion: number
  diversity: number
  growth: number
}

export function computeHealthScore(inputs: HealthScoreInputs): HealthScoreBreakdown {
  const target = inputs.revenueTargetCents ?? 8_000_00
  const revenueRaw = target > 0 ? Math.min(inputs.revenueCents / target, 1) : 0
  const revenue = Math.round(revenueRaw * 100)

  const conversion = inputs.conversionRatio == null ? 50 : Math.round(inputs.conversionRatio * 100)
  const diversity = inputs.diversityScore == null ? 50 : Math.round(inputs.diversityScore * 100)
  // growth -1 → 0, 0 → 50, +1 → 100 (clamped)
  const growth =
    inputs.growthRatio == null
      ? 50
      : Math.max(0, Math.min(100, Math.round((inputs.growthRatio + 1) * 50)))

  const total = Math.round(revenue * 0.3 + conversion * 0.2 + diversity * 0.2 + growth * 0.3)

  return { total, revenue, conversion, diversity, growth }
}

export type HealthScoreColor = 'red' | 'yellow' | 'green'

export function healthScoreColor(total: number): HealthScoreColor {
  if (total < 40) return 'red'
  if (total < 70) return 'yellow'
  return 'green'
}

/** Diversité prescripteurs : 1 - HHI (Herfindahl-Hirschman normalisé). */
export function diversityFromShares(shares: number[]): number | null {
  if (shares.length === 0) return null
  const total = shares.reduce((s, v) => s + v, 0)
  if (total <= 0) return null
  const normalized = shares.map((v) => v / total)
  const hhi = normalized.reduce((acc, p) => acc + p * p, 0)
  // Normalize so that 1 partner -> 0 (mono dépendance), N partners equal -> 1
  // Max HHI = 1 (mono), Min HHI = 1/N
  if (normalized.length === 1) return 0
  const minHhi = 1 / normalized.length
  return 1 - (hhi - minHhi) / (1 - minHhi)
}
