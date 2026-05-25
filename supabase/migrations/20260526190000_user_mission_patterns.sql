-- ============================================================================
-- KOVAS — Lot B61 : Pattern learning runtime (table de persistance graph)
-- ============================================================================
-- Table `data.user_mission_patterns` qui stocke le knowledge graph sémantique
-- par diagnostiqueur (1 ligne par diag, PK = diagnostician_id). Le graph est
-- (re)construit par l'Edge Function `rebuild-user-patterns` hebdomadaire qui
-- consomme les 50 dernières missions du user via `buildKnowledgeGraph()`.
--
-- Logique pure-fn : `apps/web/src/lib/learning/user-knowledge-graph.ts` (Lot B59)
--   - buildKnowledgeGraph(missions, now?) → UserKnowledgeGraph JSONB-friendly
--   - predictFromGraph(graph, input?)     → MissionPredictions (+ confidence)
--   - computeDelta(predictions, actual)   → { changeRatio, deltaFields }
--   - routeAnalysisStrategy(delta)        → reuse_full | incremental | full_analysis
--
-- Usage prod (orchestrateur lit le graph avant un appel Claude) :
--   * SELECT graph FROM data.user_mission_patterns WHERE diagnostician_id = ?
--   * Si graph absent (cold start)               → full_analysis
--   * Si delta < 10%                             → reuse_full  (économie 100%)
--   * Si delta < 30%                             → incremental (économie 70%)
--   * Sinon                                      → full_analysis
--
-- Économie projetée à scale (cf. docs/refonte-2026-05/AI_ECONOMICS.md §10) :
--   -60-70% sur user mature M6+. À M24 sur 1000 missions/mois × 2000 users :
--   ~30k€/an d'économie plateforme.
--
-- Sécurité (RLS) :
--   * Aucune écriture user-facing : SEUL le service_role (Edge Function +
--     route handlers) peut UPSERT/UPDATE/DELETE.
--   * Lecture authenticated : un user voit UNIQUEMENT le graph du
--     diagnosticien qu'il a claimé (jointure via diagnosticians.claimed_by_user_id
--     ou diagnosticians.claimed_by). Jamais le graph d'un autre.
--   * Pas de RPC SECURITY DEFINER exposée — la lecture côté serveur utilise
--     le client service_role.
--
-- Anti-collision avec la migration existante 20260526120000_module_trials.sql
-- → ce fichier utilise le timestamp 20260526190000 (slot libre vérifié).
--
-- Authority : docs/refonte-2026-05/AI_ECONOMICS.md Technique 10.
-- ============================================================================

-- 1. Schéma data déjà créé par 20260525170000_data_lake_schemas.sql
--    (CREATE SCHEMA IF NOT EXISTS data + GRANT USAGE TO authenticated, service_role, anon)

-- 2. Table principale --------------------------------------------------------
CREATE TABLE IF NOT EXISTS data.user_mission_patterns (
  diagnostician_id  uuid PRIMARY KEY
                    REFERENCES public.diagnosticians(id) ON DELETE CASCADE,
  graph             jsonb NOT NULL DEFAULT '{}'::jsonb,
  sample_size       int NOT NULL DEFAULT 0
                    CHECK (sample_size >= 0),
  last_rebuilt_at   timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE data.user_mission_patterns IS
  'Lot B61 — knowledge graph sémantique par diagnostiqueur (1 ligne par diag, rebuild hebdomadaire). Consommé par l''orchestrateur d''analyse Claude pour basculer entre reuse_full / incremental / full_analysis (économie -60-70%). Voir lib/learning/user-knowledge-graph.ts (B59) et docs/refonte-2026-05/AI_ECONOMICS.md §10.';

COMMENT ON COLUMN data.user_mission_patterns.graph IS
  'UserKnowledgeGraph sérialisé (cf. lib/learning/user-knowledge-graph.ts). Cible <4 KiB JSONB compressé.';

COMMENT ON COLUMN data.user_mission_patterns.sample_size IS
  'Nombre de missions agrégées pour ce graph (cap 50 par convention rebuild). <10 = cold_start côté predictFromGraph.';

COMMENT ON COLUMN data.user_mission_patterns.last_rebuilt_at IS
  'Timestamp du dernier rebuild — utilisé par l''Edge Function pour cibler les graphs périmés (> 7 jours).';

-- 3. Index pour cibler les graphs à rebuild ----------------------------------
CREATE INDEX IF NOT EXISTS idx_user_patterns_updated_at
  ON data.user_mission_patterns (last_rebuilt_at);

COMMENT ON INDEX data.idx_user_patterns_updated_at IS
  'Lot B61 — accélère le WHERE last_rebuilt_at < now() - interval ''7 days'' de l''Edge Function rebuild hebdomadaire.';

-- 4. RLS ---------------------------------------------------------------------
ALTER TABLE data.user_mission_patterns ENABLE ROW LEVEL SECURITY;

-- 4.1 SELECT : un user authenticated voit le graph SI il a claimé le diag
--     (jointure via diagnosticians.claimed_by_user_id OU diagnosticians.claimed_by,
--     les deux colonnes existent depuis 20260524110000_diagnosticians_unified.sql).
DROP POLICY IF EXISTS user_patterns_select_own ON data.user_mission_patterns;
CREATE POLICY user_patterns_select_own
  ON data.user_mission_patterns
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.diagnosticians d
      WHERE d.id = data.user_mission_patterns.diagnostician_id
        AND (d.claimed_by_user_id = auth.uid() OR d.claimed_by = auth.uid())
    )
  );

-- 4.2 Pas de policy INSERT / UPDATE / DELETE pour authenticated → écritures
--     réservées au service_role (Edge Function rebuild + futurs route handlers
--     admin). Le service_role bypass RLS par design Supabase.

-- 4.3 anon : aucun accès (pas de policy → tout refusé même en lecture).

COMMENT ON POLICY user_patterns_select_own ON data.user_mission_patterns IS
  'Lot B61 — un utilisateur authentifié ne peut lire QUE le graph du diagnostiqueur qu''il a claimé (claimed_by_user_id ou claimed_by). Jamais le graph d''un autre.';

-- 5. Grants ------------------------------------------------------------------
GRANT SELECT ON data.user_mission_patterns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON data.user_mission_patterns TO service_role;
-- anon : aucun grant (cohérent avec absence de policy)
