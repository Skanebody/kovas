/**
 * KOVAS — Loader Supabase pour le moteur de risque ADEME (Node).
 *
 * Implémente `RiskContextLoader` (cf. `risk-calculator.ts`) côté API route
 * Next.js, en miroir des requêtes inline de l'Edge Function `ademe-prevalidate`.
 * La logique pure (scoring) reste dans `risk-calculator.ts` — ici on ne fait
 * que charger le contexte DB.
 */

import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdemeDpe } from './ademe-api'
import type { LatestSnapshot, RiskContextLoader, UserHistoryAggregate } from './risk-calculator'
import type { CoherenceRule } from './rule-evaluator'

interface SnapshotMeta {
  dpe_count_12m?: number
  dpe_count_today?: number
  ratio_fg?: number
}

export function createSupabaseRiskLoader(
  supabase: SupabaseClient<Database>,
  orgId: string,
): RiskContextLoader {
  return {
    async loadLatestSnapshot(): Promise<LatestSnapshot | null> {
      const { data } = await supabase
        .from('ademe_kpi_snapshots')
        .select('snapshot_date, metadata')
        .eq('organization_id', orgId)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!data) return null
      const row = data as { snapshot_date: string; metadata: SnapshotMeta | null }
      const meta = row.metadata ?? {}
      return {
        snapshot_date: row.snapshot_date,
        dpe_count_12m: meta.dpe_count_12m ?? 0,
        dpe_count_today: meta.dpe_count_today ?? 0,
        ratio_fg: meta.ratio_fg ?? 0,
      }
    },

    async loadLastDpe(): Promise<AdemeDpe | null> {
      const { data } = await supabase
        .from('ademe_dpe_cache')
        .select('latitude, longitude')
        .eq('organization_id', orgId)
        .order('date_etablissement', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      if (!data) return null
      const row = data as { latitude: number | null; longitude: number | null }
      // Le moteur lit `Latitude`/`Longitude` (forme AdemeDpe).
      return {
        Latitude: row.latitude ?? undefined,
        Longitude: row.longitude ?? undefined,
      } as AdemeDpe
    },

    async loadCoherenceRules(): Promise<CoherenceRule[]> {
      const { data } = await supabase
        .from('ademe_coherence_rules')
        .select(
          'id, rule_code, title, description, severity, rule_logic, suggested_fix, diagnostic_types, enabled',
        )
        .eq('enabled', true)
      return (data ?? []) as unknown as CoherenceRule[]
    },

    async loadUserHistory(): Promise<UserHistoryAggregate | null> {
      // V1 : l'axe "history" pèse 0 dans le score global (cf. WEIGHTS.history).
      // On évite une requête coûteuse tant que l'axe n'est pas rebaseliné (V2).
      return null
    },
  }
}
