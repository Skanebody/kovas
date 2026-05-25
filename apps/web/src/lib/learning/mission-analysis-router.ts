/**
 * KOVAS — Lot B61 : Orchestrateur runtime du pattern learning.
 *
 * Helper côté route handler / Edge Function qui :
 *   1. Lit le `data.user_mission_patterns.graph` du diagnostiqueur courant
 *      (via client Supabase service_role — RLS bypass).
 *   2. Si graph absent (cold start) → renvoie `full_analysis` directement.
 *   3. Sinon, appelle `predictFromGraph` + `computeDelta` + `routeAnalysisStrategy`
 *      des helpers pure-fn du Lot B59 et retourne la décision + les prédictions.
 *
 * Économie projetée (cf. AI_ECONOMICS.md §10) :
 *   - `reuse_full`     → skip Claude entièrement (économie ~100%, ~0,001€/mission)
 *   - `incremental`    → mini-prompt delta uniquement (économie ~70%, ~0,012€/mission)
 *   - `full_analysis`  → comportement actuel (~0,075€/mission, économie 0%)
 *
 * Pure-ish : le fetch DB est isolé dans `loadGraph` qu'on peut mocker. Le
 * cœur décisionnel `decideStrategy` est pure-fn et c'est ce qu'on teste.
 *
 * **Branchement futur (non fait dans ce lot)** : insérer
 * `decideStrategy(graph, missionInput, actualHints)` AVANT chaque appel
 * Claude dans :
 *   - apps/web/src/app/api/missions/[id]/consolidate/route.ts
 *   - apps/web/src/app/api/mission/[dossierId]/finalize-analysis/route.ts
 *   - apps/web/src/app/api/dossier/ai-chat/route.ts (cas streaming, plus subtil)
 *
 * Le route handler `prevalidation-score` (B52) n'appelle PAS Claude pour
 * l'instant (compute local via `computeConformityScore`), il n'est donc PAS
 * un candidat évident — on attendra l'évolution Phase 2.
 *
 * Authority : docs/refonte-2026-05/AI_ECONOMICS.md §10 + Lot B61.
 */

import {
  type AnalysisStrategy,
  type DeltaResult,
  type MissionLite,
  type MissionPredictions,
  type UserKnowledgeGraph,
  computeDelta,
  predictFromGraph,
  routeAnalysisStrategy,
} from './user-knowledge-graph'

/**
 * Shape minimale du client Supabase utilisé ici. On évite d'importer le type
 * `SupabaseClient` complet pour rester testable sans bootstrapper le SDK.
 */
export interface SupabaseLike {
  schema(name: string): {
    from(table: string): {
      select(cols: string): {
        eq(
          col: string,
          val: string,
        ): {
          maybeSingle(): Promise<{
            data: { graph: UserKnowledgeGraph; sample_size: number } | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
}

/**
 * Décision finale retournée à l'orchestrateur d'analyse. `predictions` est
 * peuplé si on a un graph exploitable (utile pour `reuse_full` qui renverra
 * les valeurs prédites au client sans appeler Claude).
 */
export interface AnalysisRoutingDecision {
  readonly strategy: AnalysisStrategy
  readonly estimated_cost_eur: number
  readonly cold_start: boolean
  /** Présent si graph exploitable, null si cold start ou graph absent */
  readonly predictions: MissionPredictions | null
  /** Présent si on a comparé predictions vs actual (computeDelta) */
  readonly delta: DeltaResult | null
  /** Source debug : 'no_graph' | 'cold_start' | 'delta_computed' */
  readonly reason: 'no_graph' | 'cold_start' | 'delta_computed'
}

/**
 * Coût d'une full_analysis Claude (fallback constant). Aligné avec
 * COST_FULL_EUR du module B59. À surcharger via tests si besoin.
 */
const COST_FULL_EUR_DEFAULT = 0.075

/**
 * Lit le graph d'un diagnostiqueur depuis `data.user_mission_patterns`.
 * Renvoie null si pas de graph (cold start absolu côté DB).
 *
 * **NE PAS** appeler depuis un client browser — utilise un client
 * service_role server-side (l'écriture est restreinte aux Edge Functions
 * et le client browser n'a pas accès au schéma `data` en write).
 */
export async function loadUserGraph(
  supabase: SupabaseLike,
  diagnosticianId: string,
): Promise<{ graph: UserKnowledgeGraph; sample_size: number } | null> {
  const { data, error } = await supabase
    .schema('data')
    .from('user_mission_patterns')
    .select('graph, sample_size')
    .eq('diagnostician_id', diagnosticianId)
    .maybeSingle()
  if (error) {
    // On loggue mais on dégrade en full_analysis (mieux qu'un 500 sur erreur DB)
    console.warn(`[mission-analysis-router] loadUserGraph DB error: ${error.message}`)
    return null
  }
  return data
}

/**
 * Décision pure-fn. À appeler dans le route handler en lui passant le graph
 * récupéré + l'input + (optionnellement) la mission réelle si on a déjà
 * commencé à la saisir (ex : code postal seul connu).
 *
 * Si `actualHints` est vide ou absent, on ne peut pas calculer de delta —
 * on retourne quand même les prédictions et on route en `full_analysis`
 * (l'utilisateur est trop tôt dans le funnel pour qu'on tranche).
 */
export function decideStrategy(
  graph: UserKnowledgeGraph | null,
  missionInput: Partial<MissionLite> = {},
  actualHints: Partial<MissionLite> | null = null,
): AnalysisRoutingDecision {
  // Cas 1 : pas de graph en DB → full_analysis
  if (!graph) {
    return {
      strategy: 'full_analysis',
      estimated_cost_eur: COST_FULL_EUR_DEFAULT,
      cold_start: true,
      predictions: null,
      delta: null,
      reason: 'no_graph',
    }
  }

  // Cas 2 : graph présent mais cold start (< 10 missions agrégées)
  const predictions = predictFromGraph(graph, missionInput)
  if (predictions.cold_start) {
    return {
      strategy: 'full_analysis',
      estimated_cost_eur: COST_FULL_EUR_DEFAULT,
      cold_start: true,
      predictions,
      delta: null,
      reason: 'cold_start',
    }
  }

  // Cas 3 : graph mature mais on ne sait pas encore comparer (pas de hints)
  if (!actualHints) {
    return {
      strategy: 'full_analysis',
      estimated_cost_eur: COST_FULL_EUR_DEFAULT,
      cold_start: false,
      predictions,
      delta: null,
      reason: 'cold_start',
    }
  }

  // Cas 4 : compare predictions vs actual → strategy via routeAnalysisStrategy
  const actualAsLite: MissionLite = {
    id: actualHints.id ?? 'pending',
    created_at: actualHints.created_at ?? new Date().toISOString(),
    postal_code: actualHints.postal_code ?? null,
    property_type: actualHints.property_type ?? null,
    year_built: actualHints.year_built ?? null,
    surface_m2: actualHints.surface_m2 ?? null,
    dpe_class: actualHints.dpe_class ?? null,
    equipment_brands: actualHints.equipment_brands ?? null,
    anomaly_patterns: actualHints.anomaly_patterns ?? null,
  }
  const delta = computeDelta(predictions, actualAsLite)
  const decision = routeAnalysisStrategy(delta)

  return {
    strategy: decision.strategy,
    estimated_cost_eur: decision.estimated_cost_eur,
    cold_start: false,
    predictions,
    delta,
    reason: 'delta_computed',
  }
}

/**
 * Helper composite : lit le graph + décide en un seul call. Sucre syntaxique
 * pour les route handlers (ils peuvent rester sur 1 ligne).
 */
export async function routeMissionAnalysis(
  supabase: SupabaseLike,
  diagnosticianId: string,
  missionInput: Partial<MissionLite> = {},
  actualHints: Partial<MissionLite> | null = null,
): Promise<AnalysisRoutingDecision> {
  const loaded = await loadUserGraph(supabase, diagnosticianId)
  return decideStrategy(loaded?.graph ?? null, missionInput, actualHints)
}
