-- ============================================================================
-- KOVAS Annuaire — Ajout colonnes pipeline verify-diagnosticians-daily
-- Date : 2026-05-24
-- Mission : aligner le schéma prod minimaliste (post-FIX-U seeding) avec ce que
--           consomme l'Edge Function verify-diagnosticians-daily.
--
-- Toutes les ALTER sont IF NOT EXISTS — idempotente, peut tourner 100x.
-- ============================================================================

-- ─── DHUP : timestamps de sync ───
ALTER TABLE public.diagnosticians ADD COLUMN IF NOT EXISTS dhup_imported_at      timestamptz;
ALTER TABLE public.diagnosticians ADD COLUMN IF NOT EXISTS dhup_last_synced_at   timestamptz;

-- ─── Activity score (calculé par pipeline) ───
ALTER TABLE public.diagnosticians ADD COLUMN IF NOT EXISTS activity_score              double precision;
ALTER TABLE public.diagnosticians ADD COLUMN IF NOT EXISTS activity_score_computed_at  timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnosticians_activity_score_range'
  ) THEN
    ALTER TABLE public.diagnosticians
      ADD CONSTRAINT diagnosticians_activity_score_range
      CHECK (activity_score IS NULL OR (activity_score >= 0 AND activity_score <= 1));
  END IF;
END $$;

-- ─── Validation status (workflow ghost lifecycle) ───
ALTER TABLE public.diagnosticians ADD COLUMN IF NOT EXISTS validation_status            text DEFAULT 'unverified';
ALTER TABLE public.diagnosticians ADD COLUMN IF NOT EXISTS validation_status_reason     text;
ALTER TABLE public.diagnosticians ADD COLUMN IF NOT EXISTS validation_status_changed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnosticians_validation_status_check'
  ) THEN
    ALTER TABLE public.diagnosticians
      ADD CONSTRAINT diagnosticians_validation_status_check
      CHECK (validation_status IS NULL OR validation_status IN ('unverified', 'verified', 'pending', 'suspended', 'ceased'));
  END IF;
END $$;

-- ─── Fraud flags (JSONB array de signaux détectés) ───
ALTER TABLE public.diagnosticians ADD COLUMN IF NOT EXISTS fraud_flags jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ─── GMB place_id (déjà rating/review_count présents en prod) ───
ALTER TABLE public.diagnosticians ADD COLUMN IF NOT EXISTS gmb_place_id text;

-- ─── First/last name (legacy bandit, NULLABLE pour compat) ───
ALTER TABLE public.diagnosticians ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.diagnosticians ADD COLUMN IF NOT EXISTS last_name  text;

-- ─── Sirene last_synced (déjà sirene_state + sirene_siret présents) ───
ALTER TABLE public.diagnosticians ADD COLUMN IF NOT EXISTS sirene_last_synced_at timestamptz;

-- ─── Indices de perf pour le pipeline ───
CREATE INDEX IF NOT EXISTS idx_diag_activity_score_computed
  ON public.diagnosticians (activity_score_computed_at ASC NULLS FIRST);

CREATE INDEX IF NOT EXISTS idx_diag_activity_score
  ON public.diagnosticians (activity_score)
  WHERE activity_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_diag_validation_status
  ON public.diagnosticians (validation_status)
  WHERE validation_status IS NOT NULL;

-- ─── Table d'audit cross-validation (si pas déjà créée) ───
CREATE TABLE IF NOT EXISTS public.diagnostician_cross_validation_logs (
  id              bigserial PRIMARY KEY,
  diagnostician_id uuid NOT NULL REFERENCES public.diagnosticians(id) ON DELETE CASCADE,
  source          text NOT NULL,  -- DHUP, SIRENE, INPI, BAN, GMB, ACTIVITY_SCORE, VERIFY_DAILY
  outcome         text NOT NULL,  -- matched, not_found, error, rate_limited, ceased, fraud_flag
  payload         jsonb,
  error_message   text,
  latency_ms      int,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xval_logs_diag_created
  ON public.diagnostician_cross_validation_logs (diagnostician_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_xval_logs_source_created
  ON public.diagnostician_cross_validation_logs (source, created_at DESC);

ALTER TABLE public.diagnostician_cross_validation_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'diagnostician_cross_validation_logs'
      AND policyname = 'xval_logs_service_only'
  ) THEN
    CREATE POLICY xval_logs_service_only
      ON public.diagnostician_cross_validation_logs
      FOR ALL
      USING (false)  -- aucune lecture publique
      WITH CHECK (false);
  END IF;
END $$;

COMMENT ON TABLE public.diagnostician_cross_validation_logs IS
  'Audit trail des appels de cross-validation (DHUP, Sirene, INPI, GMB, verify-daily). service_role only.';

-- ─── RLS : masquage public des fiches sous le seuil 0.5 ───
-- (RLS existante adaptée à inclure le filtre activity_score)
-- Note : la policy `diag_public_read_unified` est définie ailleurs ; cette
-- migration ajoute UNIQUEMENT les colonnes/indexes. La policy sera mise à jour
-- en place quand le schéma `validation_status` sera utilisé activement.

-- ─── Verdict ───
DO $$
BEGIN
  RAISE NOTICE 'Schema diagnosticians aligné pour verify-diagnosticians-daily : OK';
END $$;
