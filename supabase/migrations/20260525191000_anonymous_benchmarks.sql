-- ============================================
-- KOVAS App — Module 9 : Benchmarks anonymisés inter-cabinets
-- Date : 2026-05-25
-- Agrégats nationaux/régionaux pour comparer un cabinet à la population.
-- AUCUN organization_id : les données sont totalement agrégées (RGPD-friendly).
-- ============================================

CREATE TABLE anonymous_benchmarks (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Périmètre d'agrégation.
  snapshot_period           date NOT NULL,
  period_type               text NOT NULL
    CHECK (period_type IN ('month','quarter','year')),
  scope                     text NOT NULL DEFAULT 'national'
    CHECK (scope IN ('national','region','department','custom')),
  scope_code                text, -- ex : '76' (Seine-Maritime) ou code région INSEE
  -- Segmentation.
  cabinet_segment           text NOT NULL DEFAULT 'all'
    CHECK (cabinet_segment IN ('all','solo','small','medium','large','founders')),
  diagnostic_kind           text, -- 'dpe' | 'amiante' | ... | NULL = tous
  -- Échantillon (k-anonymity : on ne publie pas si < 5 cabinets).
  cabinets_count            int NOT NULL,
  missions_count            int NOT NULL,
  k_anonymity_threshold     int NOT NULL DEFAULT 5,
  -- Volume.
  median_missions_per_cabinet     numeric(10,2),
  p25_missions_per_cabinet        numeric(10,2),
  p75_missions_per_cabinet        numeric(10,2),
  -- Vélocité.
  median_time_to_export_seconds   int,
  p25_time_to_export_seconds      int,
  p75_time_to_export_seconds      int,
  -- Mix diagnostics (parts en pourcentage, somme = 100).
  diagnostic_mix_pct        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Tarif moyen (centimes integer).
  median_mission_value_cents      bigint,
  p25_mission_value_cents         bigint,
  p75_mission_value_cents         bigint,
  -- Marge brute (ratio).
  median_gross_margin_ratio       numeric(5,4),
  -- Gain Tracker comparatif.
  median_time_saved_seconds_per_mission int,
  -- Métadonnées.
  computed_by               text NOT NULL DEFAULT 'worker_benchmarks_v1',
  metadata                  jsonb DEFAULT '{}'::jsonb,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_period, period_type, scope, scope_code, cabinet_segment, diagnostic_kind)
);

CREATE INDEX idx_benchmarks_period_scope
  ON anonymous_benchmarks (period_type, snapshot_period DESC, scope, scope_code);
CREATE INDEX idx_benchmarks_segment
  ON anonymous_benchmarks (cabinet_segment, period_type, snapshot_period DESC);
CREATE INDEX idx_benchmarks_kind
  ON anonymous_benchmarks (diagnostic_kind, period_type, snapshot_period DESC)
  WHERE diagnostic_kind IS NOT NULL;

COMMENT ON TABLE anonymous_benchmarks IS
  'Benchmarks anonymisés inter-cabinets (k-anonymity >= 5). Aucune donnée nominative. Lecture publique authentifiée.';

CREATE TRIGGER trg_benchmarks_updated BEFORE UPDATE ON anonymous_benchmarks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE anonymous_benchmarks ENABLE ROW LEVEL SECURITY;

-- SELECT public : tout user authentifié peut consulter les benchmarks.
CREATE POLICY "anonymous_benchmarks_public_read"
  ON anonymous_benchmarks FOR SELECT TO authenticated
  USING (true);

-- INSERT : worker (service_role bypass RLS). Aucune policy INSERT pour role authenticated
-- = personne ne peut insérer via API client. UPDATE même logique (service_role only).
-- NB : on évite explicitement la policy admin ici pour empêcher toute pollution manuelle
-- du référentiel anonymisé. Si un admin doit injecter, il passe par service_role.

-- ============================================
-- FIN MIGRATION anonymous_benchmarks
-- ============================================
