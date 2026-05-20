/**
 * Types partagés Section Paliers / OKRs / Roadmap (itération 9).
 *
 * Les 3 tables (`milestones`, `okrs`, `roadmap_items`) ont été créées par la
 * migration 20260521200000_admin_milestones_okrs.sql et ne figurent pas (encore)
 * dans le Database type généré — on type localement les rows et casts en
 * conséquence dans le calculator + routes API.
 */

// ============================================
// Milestones
// ============================================

export type MilestoneCategory = 'mrr' | 'users' | 'missions' | 'product' | 'business' | 'tech'

export interface MilestoneRow {
  id: string
  category: MilestoneCategory
  name: string
  description: string | null
  target_value: number
  unit: string | null
  current_value: number | null
  achieved: boolean
  achieved_at: string | null
  icon: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export interface MilestoneWithProgress extends MilestoneRow {
  /** 0-1 ratio (clamped). */
  progress: number
  /** Estimation linéaire ETA (ISO date) si tendance positive. Null sinon. */
  eta_iso: string | null
}

// ============================================
// OKRs
// ============================================

export type OkrStatus = 'draft' | 'active' | 'completed' | 'cancelled'

export interface KeyResult {
  name: string
  target: number
  current: number
  unit?: string | null
}

export interface OkrRow {
  id: string
  quarter: string
  objective: string
  key_results: KeyResult[]
  progress: number | null
  status: OkrStatus
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

// ============================================
// Roadmap
// ============================================

export type RoadmapCategory = 'feature' | 'bug' | 'tech_debt' | 'ux' | 'business'
export type RoadmapStatus = 'planned' | 'in_progress' | 'completed' | 'shipped' | 'cancelled'

export interface RoadmapItemRow {
  id: string
  title: string
  description: string | null
  category: RoadmapCategory | null
  status: RoadmapStatus
  priority: number
  target_version: string | null
  estimated_days: number | null
  created_at: string
  updated_at: string
  shipped_at: string | null
}

// ============================================
// Helpers
// ============================================

export const MILESTONE_CATEGORY_LABEL: Record<MilestoneCategory, string> = {
  mrr: 'MRR / Revenue',
  users: 'Utilisateurs',
  missions: 'Missions',
  product: 'Produit',
  business: 'Business',
  tech: 'Tech / Marge',
}

export const ROADMAP_STATUS_LABEL: Record<RoadmapStatus, string> = {
  planned: 'Planifié',
  in_progress: 'En cours',
  completed: 'Terminé',
  shipped: 'Livré',
  cancelled: 'Annulé',
}

export const ROADMAP_CATEGORY_LABEL: Record<RoadmapCategory, string> = {
  feature: 'Feature',
  bug: 'Bug',
  tech_debt: 'Tech debt',
  ux: 'UX',
  business: 'Business',
}

/** Compute current quarter key in format 'YYYY-QN'. */
export function currentQuarter(now: Date = new Date()): string {
  const year = now.getUTCFullYear()
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1
  return `${year}-Q${quarter}`
}

/** Next quarter helper for draft pre-fill. */
export function nextQuarter(now: Date = new Date()): string {
  const year = now.getUTCFullYear()
  const q = Math.floor(now.getUTCMonth() / 3) + 1
  if (q === 4) return `${year + 1}-Q1`
  return `${year}-Q${q + 1}`
}

/** Compute progress for a single key result (0-1 clamped). */
export function krProgress(kr: KeyResult): number {
  if (kr.target <= 0) return 0
  return Math.max(0, Math.min(1, kr.current / kr.target))
}

/** Compute global OKR progress = average of KR progresses (0-1). */
export function computeOkrProgress(keyResults: KeyResult[]): number {
  if (keyResults.length === 0) return 0
  const sum = keyResults.reduce((acc, kr) => acc + krProgress(kr), 0)
  return sum / keyResults.length
}
