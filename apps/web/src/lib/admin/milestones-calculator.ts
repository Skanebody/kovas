/**
 * Milestones calculator : auto-update du `current_value` selon la catégorie.
 *
 * - mrr      → MRR actuel via finance-calculator.calculateMRR
 * - users    → count profiles (proxy "payants" = subscriptions active)
 * - missions → count missions (cumul OU mois courant si target ≤ 5000)
 * - tech     → marge brute % (CA / coûts mois courant)
 * - autres   → valeur stockée (saisie manuelle)
 *
 * Les tables `milestones`/`okrs`/`roadmap_items` n'étant pas dans le Database
 * type généré (migration 2026-05-21 200000), on caste les builders supabase-js.
 */

import { calculateMRR, calculateMonthCosts } from '@/lib/admin/finance-calculator'
import type {
  KeyResult,
  MilestoneRow,
  MilestoneWithProgress,
  OkrRow,
  OkrStatus,
  RoadmapItemRow,
} from '@/lib/admin/milestones-types'
import { computeOkrProgress } from '@/lib/admin/milestones-types'
import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type AdminSupabase = SupabaseClient<Database>

// ============================================
// Helpers cast (tables hors Database type)
// ============================================

interface MilestoneSelect {
  select: (cols: string) => {
    order: (
      col: string,
      opts: { ascending: boolean },
    ) => Promise<{
      data: MilestoneRow[] | null
      error: { message: string } | null
    }>
  }
}

interface OkrSelect {
  select: (cols: string) => {
    order: (
      col: string,
      opts: { ascending: boolean },
    ) => Promise<{
      data: OkrRow[] | null
      error: { message: string } | null
    }>
  }
}

interface RoadmapSelect {
  select: (cols: string) => {
    order: (
      col: string,
      opts: { ascending: boolean },
    ) => {
      order: (
        col: string,
        opts: { ascending: boolean },
      ) => Promise<{
        data: RoadmapItemRow[] | null
        error: { message: string } | null
      }>
    }
  }
}

interface MilestoneUpdate {
  update: (v: { current_value?: number; updated_at?: string }) => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
}

// ============================================
// 1. Auto-update current_value selon category
// ============================================

interface AggregatedActuals {
  mrr: number
  users: number
  missionsCumulative: number
  missionsThisMonth: number
  grossMarginPct: number
}

async function computeActuals(supabase: AdminSupabase): Promise<AggregatedActuals> {
  // MRR actuel
  const mrrSnap = await calculateMRR(supabase)

  // Users payants : subscriptions actives → uniques orgs
  const subsRes = await supabase
    .from('subscriptions')
    .select('organization_id, status')
    .eq('status', 'active')
  const activeOrgs = new Set<string>()
  for (const s of (subsRes.data ?? []) as { organization_id: string }[]) {
    activeOrgs.add(s.organization_id)
  }

  // Missions cumulatives + mois
  const now = new Date()
  const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const [cumRes, monthRes] = await Promise.all([
    supabase.from('missions').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase
      .from('missions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStartIso)
      .is('deleted_at', null),
  ])

  // Marge brute % mois courant
  const costs = await calculateMonthCosts(supabase, now)
  const revenue = mrrSnap.total
  const grossMarginPct = revenue > 0 ? ((revenue - costs.total) / revenue) * 100 : 0

  return {
    mrr: mrrSnap.total,
    users: activeOrgs.size,
    missionsCumulative: cumRes.count ?? 0,
    missionsThisMonth: monthRes.count ?? 0,
    grossMarginPct,
  }
}

/**
 * Pour un milestone donné, retourne la valeur "actuelle" automatiquement
 * dérivée (ou null si la catégorie n'a pas d'auto-update).
 */
function autoCurrentValue(milestone: MilestoneRow, actuals: AggregatedActuals): number | null {
  switch (milestone.category) {
    case 'mrr':
      return actuals.mrr
    case 'users':
      return actuals.users
    case 'missions': {
      // Cible ≤ 5000 → mensuel ; sinon cumulatif
      if (milestone.target_value <= 5000) return actuals.missionsThisMonth
      return actuals.missionsCumulative
    }
    case 'tech': {
      // Si l'unit est '%' on stocke en ratio 0-1, sinon brut.
      // Pour le seed "Marge brute > 85%" la target est 0.85 → on garde ratio.
      if (milestone.target_value <= 1) return actuals.grossMarginPct / 100
      return actuals.grossMarginPct
    }
    default:
      return null
  }
}

// ============================================
// 2. Linear ETA estimation (very rough)
// ============================================

/**
 * Estimation ETA simple : si current/target progresse à `rate` par mois
 * (delta MRR ou +N users par mois sur 1-3 mois récents), combien de mois
 * pour atteindre la cible ?
 *
 * V1 : on n'a pas (encore) d'historique mensuel détaillé en BDD → on renvoie
 * null tant que `rate` n'est pas calculable. Pour MRR seul on peut utiliser
 * la croissance MoM via finance-calculator, mais le risque de mauvaise
 * estimation est élevé → on laisse `null` pour V1, à compléter V2.
 */
function estimateEta(_milestone: MilestoneRow, _current: number): string | null {
  return null
}

// ============================================
// 3. Public API
// ============================================

export async function loadMilestonesWithProgress(
  supabase: AdminSupabase,
): Promise<MilestoneWithProgress[]> {
  const { data, error } = await (supabase.from('milestones') as unknown as MilestoneSelect)
    .select('*')
    .order('display_order', { ascending: true })

  if (error) {
    throw new Error(`loadMilestonesWithProgress: ${error.message}`)
  }

  const rows = data ?? []
  if (rows.length === 0) return []

  const actuals = await computeActuals(supabase)

  // Optionnel : sync current_value en BDD pour les catégories auto.
  // V1 : on update silencieusement seulement si la valeur stockée diffère
  //      de plus de 1% pour éviter trop d'écritures.
  const updates: Promise<unknown>[] = []

  const enriched: MilestoneWithProgress[] = rows.map((m) => {
    const auto = autoCurrentValue(m, actuals)
    const current = auto !== null ? auto : (m.current_value ?? 0)
    const progress = m.target_value > 0 ? Math.max(0, Math.min(1, current / m.target_value)) : 0
    const eta = m.achieved ? null : estimateEta(m, current)

    if (auto !== null) {
      const stored = m.current_value ?? 0
      const delta = Math.abs(auto - stored)
      const threshold = Math.max(1, m.target_value * 0.01)
      if (delta >= threshold) {
        const upd = (supabase.from('milestones') as unknown as MilestoneUpdate)
          .update({ current_value: auto, updated_at: new Date().toISOString() })
          .eq('id', m.id)
        updates.push(upd)
      }
    }

    return {
      ...m,
      current_value: current,
      progress,
      eta_iso: eta,
    }
  })

  // Best-effort : fire-and-forget les updates (on ne bloque pas le rendu)
  if (updates.length > 0) {
    Promise.all(updates).catch((err) => {
      console.error('[milestones-calculator] background updates failed', err)
    })
  }

  return enriched
}

export async function loadOkrs(supabase: AdminSupabase): Promise<OkrRow[]> {
  const { data, error } = await (supabase.from('okrs') as unknown as OkrSelect)
    .select('*')
    .order('quarter', { ascending: false })

  if (error) {
    throw new Error(`loadOkrs: ${error.message}`)
  }

  // Recompute progress runtime (au cas où key_results aurait changé sans recalc)
  return (data ?? []).map((okr) => ({
    ...okr,
    key_results: Array.isArray(okr.key_results) ? (okr.key_results as KeyResult[]) : [],
    progress:
      okr.progress ??
      computeOkrProgress(Array.isArray(okr.key_results) ? (okr.key_results as KeyResult[]) : []),
  }))
}

export async function loadRoadmapItems(supabase: AdminSupabase): Promise<RoadmapItemRow[]> {
  const { data, error } = await (supabase.from('roadmap_items') as unknown as RoadmapSelect)
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`loadRoadmapItems: ${error.message}`)
  }

  return data ?? []
}

// ============================================
// 4. Tri / regroupement helpers utilisés par la page
// ============================================

export function splitMilestonesByAchievement(milestones: MilestoneWithProgress[]): {
  achieved: MilestoneWithProgress[]
  inProgress: MilestoneWithProgress[]
} {
  const achieved: MilestoneWithProgress[] = []
  const inProgress: MilestoneWithProgress[] = []
  for (const m of milestones) {
    if (m.achieved) achieved.push(m)
    else inProgress.push(m)
  }
  // achieved sorted by achieved_at DESC
  achieved.sort((a, b) => {
    const ta = a.achieved_at ?? a.updated_at
    const tb = b.achieved_at ?? b.updated_at
    return tb.localeCompare(ta)
  })
  // inProgress sorted by progress DESC then display_order ASC
  inProgress.sort((a, b) => {
    if (Math.abs(a.progress - b.progress) > 0.01) return b.progress - a.progress
    return a.display_order - b.display_order
  })
  return { achieved, inProgress }
}

export function groupRoadmapByVersion(
  items: RoadmapItemRow[],
): Array<{ version: string; items: RoadmapItemRow[] }> {
  const groups = new Map<string, RoadmapItemRow[]>()
  for (const it of items) {
    const v = it.target_version ?? 'Non assigné'
    const arr = groups.get(v) ?? []
    arr.push(it)
    groups.set(v, arr)
  }
  // Ordre canonique des versions (V1, V1.5, V2, Phase 2, ...) → tri lexico par défaut
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([version, list]) => ({ version, items: list }))
}

export function groupOkrsByStatus(okrs: OkrRow[]): Record<OkrStatus, OkrRow[]> {
  const acc: Record<OkrStatus, OkrRow[]> = {
    active: [],
    draft: [],
    completed: [],
    cancelled: [],
  }
  for (const o of okrs) acc[o.status].push(o)
  return acc
}
