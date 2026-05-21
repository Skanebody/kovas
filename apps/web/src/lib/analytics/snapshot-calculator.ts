/**
 * KOVAS — Module 9 — Calcul des snapshots Business Analytics.
 *
 * Helpers purs (sans dépendance Supabase forte) consommés par
 * l'Edge Function `business-analytics-snapshot` (cron mensuel).
 *
 * Métriques calculées :
 *
 *   - revenue_ht_cents / revenue_ttc_cents (depuis invoices.status='paid'|'issued')
 *   - missions_total / completed / exported / cancelled (depuis missions)
 *   - diagnostic_mix (groupby missions.type)
 *   - avg_mission_value_cents (revenue / missions_completed)
 *   - conversion_rate (devis acceptés / devis envoyés)
 *   - repeat_client_rate (clients > 1 mission / clients distincts)
 *   - health_score (composite 0-100)
 *
 * Source d'autorité : CLAUDE.md §7 (économie réaliste).
 */

// ============================================================
// Types entrée (rows DB minimales).
// ============================================================

export interface MissionRow {
  id: string
  type: string
  status: string
  exported_at: string | null
  completed_at: string | null
  created_at: string
}

export interface DossierRow {
  id: string
  client_id: string | null
  status: string
  scheduled_at: string | null
  completed_at: string | null
  created_at: string
}

export interface InvoiceRow {
  id: string
  client_id: string | null
  status: string
  amount_ht: number | string
  amount_ttc: number | string
  paid_at: string | null
  issued_at: string | null
  created_at: string
}

export interface QuoteRow {
  id: string
  status: string
  created_at: string
  accepted_at: string | null
}

// ============================================================
// Types sortie (mappés sur business_analytics_snapshots schema).
// ============================================================

export interface AnalyticsSnapshot {
  organization_id: string
  snapshot_period: string // YYYY-MM-01
  period_type: 'month'
  // Volume
  missions_total: number
  missions_completed: number
  missions_exported: number
  missions_cancelled: number
  diagnostic_mix: Record<string, number>
  // CA (centimes)
  revenue_ht_cents: number
  revenue_ttc_cents: number
  avg_mission_value_cents: number
  // Marge (V1 : ai_cost_eur cumulé seulement, gross_margin = revenue - cost)
  ai_cost_cents: number
  variable_cost_cents: number
  gross_margin_cents: number
  gross_margin_ratio: number | null
  // Vélocité
  avg_time_to_export_seconds: number | null
  // Clients
  unique_clients: number
  recurring_clients: number
  // Composite
  metadata: {
    conversion_rate: number | null
    repeat_client_rate: number | null
    health_score: number | null
    diversity_index: number | null
    computed_at: string
  }
}

// ============================================================
// Helpers période.
// ============================================================

/**
 * Renvoie la première et la dernière date d'un mois donné (UTC).
 */
export function monthBounds(period: string): { from: string; to: string } {
  // period attendu format YYYY-MM-01
  const [y, m] = period.split('-').map((p) => Number.parseInt(p, 10))
  if (typeof y !== 'number' || Number.isNaN(y) || typeof m !== 'number' || Number.isNaN(m)) {
    throw new Error(`invalid period: ${period}`)
  }
  const fromDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
  const toDate = new Date(Date.UTC(y, m, 1, 0, 0, 0))
  return { from: fromDate.toISOString(), to: toDate.toISOString() }
}

/**
 * Mois précédent au mois donné (référence : today UTC).
 */
export function previousMonth(today: Date = new Date()): string {
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth() // 0-indexed
  // mois précédent
  const target = new Date(Date.UTC(y, m - 1, 1))
  const ty = target.getUTCFullYear()
  const tm = (target.getUTCMonth() + 1).toString().padStart(2, '0')
  return `${ty}-${tm}-01`
}

// ============================================================
// Convertisseurs montants → centimes integer.
// ============================================================

function eurosToCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

// ============================================================
// Calculs métriques unitaires.
// ============================================================

export function computeRevenueMonth(invoices: InvoiceRow[]): {
  revenue_ht_cents: number
  revenue_ttc_cents: number
} {
  let ht = 0
  let ttc = 0
  for (const inv of invoices) {
    // Compte les invoices émises (issued, paid, partial, overdue) — pas les drafts/cancelled.
    if (inv.status === 'draft' || inv.status === 'cancelled') continue
    ht += eurosToCents(inv.amount_ht)
    ttc += eurosToCents(inv.amount_ttc)
  }
  return { revenue_ht_cents: ht, revenue_ttc_cents: ttc }
}

export function computeConversionRate(quotes: QuoteRow[]): number | null {
  // sent = (sent, accepted, refused, expired) — toute la cohorte ayant atteint au moins l'envoi
  const sent = quotes.filter((q) => ['sent', 'accepted', 'refused', 'expired'].includes(q.status))
  if (sent.length === 0) return null
  const accepted = sent.filter((q) => q.status === 'accepted').length
  return Number((accepted / sent.length).toFixed(4))
}

export function computeRepeatClientRate(missionsByClient: Map<string, number>): number | null {
  if (missionsByClient.size === 0) return null
  let recurring = 0
  for (const count of missionsByClient.values()) {
    if (count > 1) recurring += 1
  }
  return Number((recurring / missionsByClient.size).toFixed(4))
}

/**
 * Indice de Shannon normalisé (0-1) sur la diversité des diagnostics réalisés.
 * 1 = parfaite répartition entre N types ; 0 = un seul type représenté.
 */
export function computeDiversityIndex(mix: Record<string, number>): number | null {
  const counts = Object.values(mix)
  const total = counts.reduce((a, b) => a + b, 0)
  if (total === 0 || counts.length === 0) return null
  if (counts.length === 1) return 0
  let h = 0
  for (const c of counts) {
    if (c === 0) continue
    const p = c / total
    h += -p * Math.log(p)
  }
  const hMax = Math.log(counts.length)
  if (hMax === 0) return 0
  return Number((h / hMax).toFixed(4))
}

/**
 * Score santé composite (0-100). Pondération :
 *   - 30% revenue (vs cible mensuelle 5000€ HT)
 *   - 20% conversion (vs cible 0.5)
 *   - 20% diversity (vs cible 0.7)
 *   - 30% growth (cf. computeGrowth — défaut 0 si non disponible)
 */
export interface HealthScoreInput {
  revenue_ht_cents: number
  conversion_rate: number | null
  diversity_index: number | null
  growth_ratio: number | null
}

export function computeHealthScore(input: HealthScoreInput): number {
  const revenueTarget = 5_000_00 // 5000€ en cents
  const revenueScore = Math.min(input.revenue_ht_cents / revenueTarget, 1) * 30
  const conversionTarget = 0.5
  const conversionScore =
    input.conversion_rate !== null ? Math.min(input.conversion_rate / conversionTarget, 1) * 20 : 0
  const diversityTarget = 0.7
  const diversityScore =
    input.diversity_index !== null ? Math.min(input.diversity_index / diversityTarget, 1) * 20 : 0
  const growthScore =
    input.growth_ratio !== null ? Math.max(0, Math.min(input.growth_ratio + 1, 2) / 2) * 30 : 0
  return Number((revenueScore + conversionScore + diversityScore + growthScore).toFixed(2))
}

// ============================================================
// Agrégat principal.
// ============================================================

export interface SnapshotComputationInput {
  organizationId: string
  period: string // YYYY-MM-01
  missions: MissionRow[]
  dossiers: DossierRow[]
  invoices: InvoiceRow[]
  quotes: QuoteRow[]
  previousRevenueCents?: number | null // pour growth ratio
  aiCostCents?: number
}

export function computeSnapshot(input: SnapshotComputationInput): AnalyticsSnapshot {
  const { missions, dossiers, invoices, quotes } = input

  // 1. Mix diagnostics
  const mix: Record<string, number> = {}
  for (const m of missions) {
    mix[m.type] = (mix[m.type] ?? 0) + 1
  }

  // 2. Status counts
  let completed = 0
  let exported = 0
  let cancelled = 0
  for (const m of missions) {
    if (m.status === 'completed' || m.status === 'done') completed += 1
    if (m.exported_at) exported += 1
    if (m.status === 'cancelled') cancelled += 1
  }

  // 3. Revenue
  const { revenue_ht_cents, revenue_ttc_cents } = computeRevenueMonth(invoices)
  const avgValue = completed > 0 ? Math.round(revenue_ht_cents / completed) : 0

  // 4. Conversion
  const conversion = computeConversionRate(quotes)

  // 5. Repeat clients (basé sur dossiers — un dossier = un client)
  const byClient = new Map<string, number>()
  for (const d of dossiers) {
    if (!d.client_id) continue
    byClient.set(d.client_id, (byClient.get(d.client_id) ?? 0) + 1)
  }
  const repeat = computeRepeatClientRate(byClient)

  // 6. Diversity
  const diversity = computeDiversityIndex(mix)

  // 7. Growth ratio (mois N vs mois N-1)
  const prev = input.previousRevenueCents ?? null
  let growthRatio: number | null = null
  if (prev !== null && prev > 0) {
    growthRatio = (revenue_ht_cents - prev) / prev
  }

  // 8. Health score composite
  const health = computeHealthScore({
    revenue_ht_cents,
    conversion_rate: conversion,
    diversity_index: diversity,
    growth_ratio: growthRatio,
  })

  // 9. Variable cost & margin
  const aiCostCents = input.aiCostCents ?? 0
  // Coûts variables V1 : on prend uniquement le coût IA (futur : ajouter stockage par seuil, Whisper minutes).
  const variableCost = aiCostCents
  const grossMargin = revenue_ht_cents - variableCost
  const grossMarginRatio =
    revenue_ht_cents > 0 ? Number((grossMargin / revenue_ht_cents).toFixed(4)) : null

  return {
    organization_id: input.organizationId,
    snapshot_period: input.period,
    period_type: 'month',
    missions_total: missions.length,
    missions_completed: completed,
    missions_exported: exported,
    missions_cancelled: cancelled,
    diagnostic_mix: mix,
    revenue_ht_cents,
    revenue_ttc_cents,
    avg_mission_value_cents: avgValue,
    ai_cost_cents: aiCostCents,
    variable_cost_cents: variableCost,
    gross_margin_cents: grossMargin,
    gross_margin_ratio: grossMarginRatio,
    avg_time_to_export_seconds: null,
    unique_clients: byClient.size,
    recurring_clients: Array.from(byClient.values()).filter((c) => c > 1).length,
    metadata: {
      conversion_rate: conversion,
      repeat_client_rate: repeat,
      health_score: health,
      diversity_index: diversity,
      computed_at: new Date().toISOString(),
    },
  }
}
