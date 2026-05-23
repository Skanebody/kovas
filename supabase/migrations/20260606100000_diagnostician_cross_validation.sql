-- ============================================
-- KOVAS Annuaire — Extension cross-validation diagnosticians
-- Date : 2026-06-06
-- Mission : enrichir les fiches DHUP avec signaux INSEE Sirene, INPI RNE,
--           BAN (géocodage), ADEME (activité DPE) ; normaliser les
--           certifications dans une table dédiée ; tracer chaque appel
--           externe pour audit/débogage.
--
-- Convention de naming : KOVAS Annuaire (annuaire B2C gratuit). Société
-- éditrice SASU NEXUS 1993 — cf. apps/web/src/lib/legal/company-identity.ts.
--
-- Idempotence : tous les ALTER / CREATE utilisent IF NOT EXISTS ou DO $$.
-- ============================================

-- ============================================
-- 1. Extension diagnosticians : signaux Sirene / INPI / BAN / ADEME
-- ============================================

-- 1.1 Sirene (INSEE) : raison sociale, forme juridique, capital, effectif…
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS sirene_denomination text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS sirene_legal_form text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS sirene_capital_eur numeric(12, 2);
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS sirene_employee_range text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS sirene_creation_date date;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS sirene_state text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS sirene_last_synced_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnosticians_sirene_state_check'
  ) THEN
    ALTER TABLE diagnosticians
      ADD CONSTRAINT diagnosticians_sirene_state_check
      CHECK (sirene_state IS NULL OR sirene_state IN ('active', 'ceased', 'unknown'));
  END IF;
END $$;

-- 1.2 INPI RNE : représentants légaux + capital libéré
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS inpi_legal_representatives jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS inpi_share_capital_paid numeric(12, 2);
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS inpi_last_synced_at timestamptz;

-- 1.3 BAN (Base Adresse Nationale) : précision géocodage + libellé normalisé
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS ban_accuracy text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS ban_label text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS ban_last_synced_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnosticians_ban_accuracy_check'
  ) THEN
    ALTER TABLE diagnosticians
      ADD CONSTRAINT diagnosticians_ban_accuracy_check
      CHECK (ban_accuracy IS NULL OR ban_accuracy IN ('housenumber', 'street', 'locality', 'municipality', 'unknown'));
  END IF;
END $$;

-- 1.4 ADEME (Open Data DPE) : signal d'activité publique
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS ademe_dpe_count_12mo int NOT NULL DEFAULT 0;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS ademe_last_dpe_at timestamptz;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS ademe_last_synced_at timestamptz;

-- 1.5 Score composite 0-100 (recalculé périodiquement par job batch)
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS activity_score int;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS activity_score_computed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnosticians_activity_score_check'
  ) THEN
    ALTER TABLE diagnosticians
      ADD CONSTRAINT diagnosticians_activity_score_check
      CHECK (activity_score IS NULL OR (activity_score BETWEEN 0 AND 100));
  END IF;
END $$;

-- 1.6 Statut de validation global (recoupement multi-sources)
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'unverified';
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS validation_status_reason text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS validation_status_changed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnosticians_validation_status_check'
  ) THEN
    ALTER TABLE diagnosticians
      ADD CONSTRAINT diagnosticians_validation_status_check
      CHECK (validation_status IN ('unverified', 'verified', 'suspended', 'ceased', 'pending'));
  END IF;
END $$;

-- ============================================
-- 2. Index additionnels sur diagnosticians
-- ============================================

-- Tri par score d'activité pour les diagnostiqueurs vérifiés (routage Annuaire)
CREATE INDEX IF NOT EXISTS idx_diag_activity_score
  ON diagnosticians (activity_score DESC NULLS LAST)
  WHERE validation_status = 'verified';

-- Lookup admin : files de validation en attente / suspensions récentes
CREATE INDEX IF NOT EXISTS idx_diag_validation_status
  ON diagnosticians (validation_status, validation_status_changed_at DESC);

-- État administratif Sirene (filtrage radiations)
CREATE INDEX IF NOT EXISTS idx_diag_sirene_state
  ON diagnosticians (sirene_state)
  WHERE sirene_state IS NOT NULL;

-- ============================================
-- 3. Table diagnostician_certifications
-- ============================================
-- Extraction normalisée du JSONB diagnosticians.certifications.
-- Permet jointures performantes (routage par type de diagnostic) et
-- requêtes SQL natives sur validité (valid_until, status).

CREATE TABLE IF NOT EXISTS diagnostician_certifications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostician_id      uuid NOT NULL REFERENCES diagnosticians(id) ON DELETE CASCADE,
  certification_type    text NOT NULL,
  organism              text NOT NULL,
  certification_number  text NOT NULL,
  valid_from            date,
  valid_until           date,
  status                text NOT NULL DEFAULT 'valid',
  source                text NOT NULL,
  last_verified_at      timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Check constraints (idempotents)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diag_cert_type_check'
  ) THEN
    ALTER TABLE diagnostician_certifications
      ADD CONSTRAINT diag_cert_type_check
      CHECK (certification_type IN ('DPE', 'AMIANTE', 'PLOMB', 'GAZ', 'ELECTRICITE', 'TERMITES', 'CARREZ', 'ERP'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diag_cert_status_check'
  ) THEN
    ALTER TABLE diagnostician_certifications
      ADD CONSTRAINT diag_cert_status_check
      CHECK (status IN ('valid', 'expired', 'suspended', 'revoked'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diag_cert_source_check'
  ) THEN
    ALTER TABLE diagnostician_certifications
      ADD CONSTRAINT diag_cert_source_check
      CHECK (source IN ('DHUP', 'MANUAL', 'SELF_DECLARED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diag_cert_unique'
  ) THEN
    ALTER TABLE diagnostician_certifications
      ADD CONSTRAINT diag_cert_unique
      UNIQUE (diagnostician_id, certification_type, organism, certification_number);
  END IF;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_diag_cert_diag_status
  ON diagnostician_certifications (diagnostician_id, status);

CREATE INDEX IF NOT EXISTS idx_diag_cert_type_status_validity
  ON diagnostician_certifications (certification_type, status, valid_until);

-- RLS
ALTER TABLE diagnostician_certifications ENABLE ROW LEVEL SECURITY;

-- Lecture publique : uniquement les certifications valides
DROP POLICY IF EXISTS "public read valid certifications" ON diagnostician_certifications;
CREATE POLICY "public read valid certifications"
  ON diagnostician_certifications
  FOR SELECT
  TO anon, authenticated
  USING (status = 'valid');

-- Owner (utilisateur ayant réclamé la fiche) : accès complet à ses certifs
DROP POLICY IF EXISTS "owner full access on certifications" ON diagnostician_certifications;
CREATE POLICY "owner full access on certifications"
  ON diagnostician_certifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM diagnosticians d
      WHERE d.id = diagnostician_certifications.diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM diagnosticians d
      WHERE d.id = diagnostician_certifications.diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_diagnostician_certifications_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_diag_certifications_updated_at ON diagnostician_certifications;
CREATE TRIGGER trg_diag_certifications_updated_at
  BEFORE UPDATE ON diagnostician_certifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_diagnostician_certifications_updated_at();

-- ============================================
-- 4. Table diagnostician_cross_validation_logs
-- ============================================
-- Audit trail des appels externes (Sirene, INPI, BAN, ADEME, DHUP).
-- Sert au monitoring, au rate-limiting et au débogage post-mortem.
-- Lecture restreinte au service_role (pas de policy publique).

CREATE TABLE IF NOT EXISTS diagnostician_cross_validation_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostician_id  uuid NOT NULL REFERENCES diagnosticians(id) ON DELETE CASCADE,
  source            text NOT NULL,
  outcome           text NOT NULL,
  payload           jsonb,
  error_message     text,
  latency_ms        int,
  created_at        timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diag_xval_source_check'
  ) THEN
    -- Patch idempotent : étend la liste pour inclure les sources legacy
    -- (VERIFY_DAILY déjà présent en prod via cron pré-existant)
    ALTER TABLE diagnostician_cross_validation_logs
      ADD CONSTRAINT diag_xval_source_check
      CHECK (source IN ('SIRENE', 'INPI', 'BAN', 'ADEME', 'DHUP', 'VERIFY_DAILY', 'MANUAL'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diag_xval_outcome_check'
  ) THEN
    ALTER TABLE diagnostician_cross_validation_logs
      ADD CONSTRAINT diag_xval_outcome_check
      CHECK (outcome IN ('matched', 'not_found', 'partial', 'error', 'rate_limited'));
  END IF;
END $$;

-- Index : timeline par fiche + source, et monitoring global par source/outcome
CREATE INDEX IF NOT EXISTS idx_diag_xval_diag_source_time
  ON diagnostician_cross_validation_logs (diagnostician_id, source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_diag_xval_source_outcome_time
  ON diagnostician_cross_validation_logs (source, outcome, created_at DESC);

-- RLS : table verrouillée (service_role uniquement)
ALTER TABLE diagnostician_cross_validation_logs ENABLE ROW LEVEL SECURITY;
-- Aucune policy : lecture/écriture réservées au service_role (bypass RLS).

-- ============================================
-- 5. Commentaires (documentation in-DB)
-- ============================================
COMMENT ON COLUMN diagnosticians.sirene_state IS
  'Etat administratif Sirene : active | ceased | unknown — déclenche validation_status=ceased si "ceased".';
COMMENT ON COLUMN diagnosticians.inpi_legal_representatives IS
  'JSONB array depuis RNE : [{ fullName, role, since }]. Permet cross-check identité du claim.';
COMMENT ON COLUMN diagnosticians.ban_accuracy IS
  'Precision du géocodage BAN : housenumber (idéal) < street < locality < municipality < unknown.';
COMMENT ON COLUMN diagnosticians.ademe_dpe_count_12mo IS
  'Nombre de DPE publiés à l''Open Data ADEME sur les 12 derniers mois — signal d''activité réelle.';
COMMENT ON COLUMN diagnosticians.activity_score IS
  'Score composite 0-100 calculé à partir des signaux Sirene + ADEME + INPI + ancienneté + reviews.';
COMMENT ON COLUMN diagnosticians.validation_status IS
  'unverified (défaut) | verified (multi-sources OK) | suspended (anomalie) | ceased (Sirene radié) | pending (en cours).';

COMMENT ON TABLE diagnostician_certifications IS
  'Certifications normalisées (extraction du JSONB diagnosticians.certifications) — routage par type de diagnostic.';
COMMENT ON TABLE diagnostician_cross_validation_logs IS
  'Audit trail des appels API externes (Sirene/INPI/BAN/ADEME/DHUP) — lecture service_role uniquement.';

-- ============================================
-- 6. RPC recompute_diagnostician_activity_score
-- ============================================
-- Recalcule activity_score (formule 30+25+25+10+10) et applique auto-promotion
-- validation_status pour un diagnosticien donné OU pour un batch (max p_limit fiches
-- les plus anciennes). Appelé par l'Edge Function compute-diagnostician-activity-score.
CREATE OR REPLACE FUNCTION public.recompute_diagnostician_activity_score(
  p_diagnostician_id uuid DEFAULT NULL,
  p_limit int DEFAULT 5000
)
RETURNS TABLE (
  processed int,
  verified int,
  ceased int,
  pending int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_ids uuid[];
  v_verified int := 0;
  v_ceased int := 0;
  v_pending int := 0;
BEGIN
  -- Sélection du périmètre (single OR batch des fiches les plus stale)
  WITH targets AS (
    SELECT id FROM diagnosticians d
    WHERE (p_diagnostician_id IS NOT NULL AND d.id = p_diagnostician_id)
       OR (p_diagnostician_id IS NULL AND (
              d.activity_score IS NULL
           OR d.activity_score_computed_at < now() - interval '24 hours'))
    ORDER BY d.activity_score_computed_at NULLS FIRST
    LIMIT CASE WHEN p_diagnostician_id IS NOT NULL THEN 1 ELSE p_limit END
  )
  SELECT array_agg(id) INTO v_target_ids FROM targets;

  IF v_target_ids IS NULL OR cardinality(v_target_ids) = 0 THEN
    processed := 0; verified := 0; ceased := 0; pending := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 1) Recalcul activity_score (idempotent, clamp 0-100)
  UPDATE diagnosticians d SET
    activity_score = LEAST(100, GREATEST(0,
        (CASE WHEN d.dhup_imported_at IS NOT NULL THEN 30 ELSE 0 END)
      + (CASE WHEN d.sirene_last_synced_at IS NOT NULL AND d.sirene_state = 'active' THEN 25 ELSE 0 END)
      + (CASE WHEN d.ademe_last_dpe_at IS NOT NULL AND d.ademe_last_dpe_at >= (now() - interval '12 months') THEN 25 ELSE 0 END)
      + (CASE WHEN d.ban_accuracy IN ('housenumber','street') THEN 10 ELSE 0 END)
      + (CASE WHEN d.inpi_last_synced_at IS NOT NULL THEN 10 ELSE 0 END))),
    activity_score_computed_at = now()
  WHERE d.id = ANY(v_target_ids);

  -- 2) Auto-promotion validation_status : ceased (terminal) OU verified (score >= 70 + sources OK)
  UPDATE diagnosticians d SET
    validation_status = CASE
      WHEN d.sirene_state = 'ceased' THEN 'ceased'
      WHEN d.activity_score >= 70
           AND d.sirene_state = 'active'
           AND d.ban_accuracy IN ('housenumber','street')
           AND d.validation_status = 'unverified'
        THEN 'verified'
      ELSE d.validation_status
    END,
    validation_status_changed_at = CASE
      WHEN d.sirene_state = 'ceased' AND d.validation_status <> 'ceased' THEN now()
      WHEN d.activity_score >= 70
           AND d.sirene_state = 'active'
           AND d.ban_accuracy IN ('housenumber','street')
           AND d.validation_status = 'unverified' THEN now()
      ELSE d.validation_status_changed_at
    END,
    validation_status_reason = CASE
      WHEN d.sirene_state = 'ceased' AND d.validation_status <> 'ceased' THEN 'auto: sirene ceased'
      WHEN d.activity_score >= 70
           AND d.sirene_state = 'active'
           AND d.ban_accuracy IN ('housenumber','street')
           AND d.validation_status = 'unverified' THEN 'auto: score >= 70'
      ELSE d.validation_status_reason
    END
  WHERE d.id = ANY(v_target_ids);

  -- 3) Comptage final pour reporting
  SELECT
    count(*) FILTER (WHERE validation_status = 'verified'),
    count(*) FILTER (WHERE validation_status = 'ceased'),
    count(*) FILTER (WHERE validation_status = 'pending')
  INTO v_verified, v_ceased, v_pending
  FROM diagnosticians WHERE id = ANY(v_target_ids);

  processed := cardinality(v_target_ids);
  verified := v_verified;
  ceased := v_ceased;
  pending := v_pending;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_diagnostician_activity_score(uuid, int)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.recompute_diagnostician_activity_score IS
  'Recalcule activity_score (formule DHUP 30 + Sirene 25 + ADEME 25 + BAN 10 + INPI 10) et applique auto-promotion validation_status. Appelé par l''Edge Function compute-diagnostician-activity-score (mode single ou batch).';
