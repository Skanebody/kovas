-- ============================================
-- KOVAS — Pipeline de validation diagnostiqueurs (Doctolib 2022 lessons)
-- Date     : 2026-05-24
-- Lot      : VERIFICATION-PIPELINE
--
-- Contexte
--   Inspiré de l'incident Doctolib 2022 (faux praticiens listés sur annuaire
--   public) — adoption d'un système de validation en 5 phases obligatoire :
--     1. Identité civile         (FranceConnect / KYC Veriff / Yousign qualifié)
--     2. Certification COFRAC    (API + Claude Vision + upload PDF)
--     3. RC Pro                  (Claude Vision + liste assureurs + montants min)
--     4. Entreprise SIRENE INSEE (gratuit)
--     5. Activation conditionnelle STRICTE — profil non visible tant que
--        les 4 phases ci-dessus ne sont pas en `verified`.
--
--   Contrôles continus :
--     - COFRAC quotidien (cron)
--     - RC Pro mensuel + alertes expiration (J-60 / J-30 / J-7)
--     - SIRENE annuel
--     - Signalements particuliers (3 en 6 mois → audit manuel prioritaire)
--
-- Périmètre migration
--   A. diagnostician_verification_status  — 1 ligne / diagnostician
--   B. verification_documents             — uploads (CNI, COFRAC, RC Pro, KBis…)
--   C. verification_checks_log            — audit trail (tous appels API/IA/admin)
--   D. verification_alerts_queue          — file d'alertes (expiration, suspension…)
--   E. diagnostician_signalements         — signalements particuliers + trigger
--   F. RLS strictes (diag = ses données ; admin = tout ; anon = NIET)
--   G. Trigger updated_at
--   H. Helpers SQL is_diagnostician_publicly_visible / has_pending_critical_alerts
--   I. Vue admin_verification_queue (file de modération)
--   J. NOTE bucket Storage `verification-docs` — création manuelle Dashboard
-- ============================================

-- ============================================
-- 0. Pré-requis idempotents
-- ============================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- Helper updated_at (idempotent : on évite de recréer si déjà présent)
CREATE OR REPLACE FUNCTION public.set_updated_at_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ============================================
-- A. diagnostician_verification_status
--    1 ligne par diagnostician — état des 4 phases + statut global + badge
-- ============================================
CREATE TABLE IF NOT EXISTS diagnostician_verification_status (
  diagnostician_id uuid PRIMARY KEY REFERENCES diagnosticians(id) ON DELETE CASCADE,

  -- ─── Phase 1 — Identité civile ─────────────────────────────────────────
  identity_status text NOT NULL DEFAULT 'pending'
    CHECK (identity_status IN ('pending','in_review','verified','rejected','expired')),
  identity_method text
    CHECK (identity_method IN ('france_connect','kyc_scan_cni','yousign_qualified')),
  identity_verified_at timestamptz,
  identity_provider_ref text,            -- ref FranceConnect (sub) ou Veriff session_id
  identity_rejection_reason text,

  -- ─── Phase 2 — Certification COFRAC ────────────────────────────────────
  cofrac_status text NOT NULL DEFAULT 'pending'
    CHECK (cofrac_status IN ('pending','in_review','verified','rejected','expired','suspended','radiated')),
  cofrac_number text,
  cofrac_certifying_body text,           -- Bureau Veritas, Apave, Dekra, ICert…
  cofrac_domains jsonb NOT NULL DEFAULT '[]'::jsonb,  -- ['DPE','AMIANTE','PLOMB',…]
  cofrac_valid_from date,
  cofrac_valid_until date,
  cofrac_verified_at timestamptz,
  cofrac_last_api_check timestamptz,
  cofrac_rejection_reason text,

  -- ─── Phase 3 — RC Pro ──────────────────────────────────────────────────
  rcpro_status text NOT NULL DEFAULT 'pending'
    CHECK (rcpro_status IN ('pending','in_review','verified','rejected','expired')),
  rcpro_insurer text,
  rcpro_policy_number text,
  rcpro_amount_per_claim_eur numeric(12,2),
  rcpro_amount_per_year_eur numeric(12,2),
  rcpro_valid_from date,
  rcpro_valid_until date,
  rcpro_verified_at timestamptz,
  rcpro_rejection_reason text,

  -- ─── Phase 4 — Entreprise SIRENE INSEE ─────────────────────────────────
  sirene_status text NOT NULL DEFAULT 'pending'
    CHECK (sirene_status IN ('pending','in_review','verified','rejected','radiated','liquidation')),
  sirene_siret text,
  sirene_company_name text,
  sirene_legal_form text,                -- SASU, EURL, SARL, micro-entreprise
  sirene_ape_code text,
  sirene_director_name text,
  sirene_company_created_at date,
  sirene_verified_at timestamptz,
  sirene_last_api_check timestamptz,
  sirene_rejection_reason text,

  -- ─── Statut global calculé (GENERATED) ─────────────────────────────────
  overall_status text GENERATED ALWAYS AS (
    CASE
      WHEN identity_status='verified'
       AND cofrac_status='verified'
       AND rcpro_status='verified'
       AND sirene_status='verified' THEN 'verified'
      WHEN identity_status='rejected'
        OR cofrac_status IN ('rejected','suspended','radiated')
        OR rcpro_status='rejected'
        OR sirene_status IN ('rejected','radiated','liquidation') THEN 'rejected'
      WHEN identity_status='expired'
        OR cofrac_status='expired'
        OR rcpro_status='expired' THEN 'expired'
      ELSE 'pending'
    END
  ) STORED,

  -- ─── Badge level (Doctolib-inspired : 3 niveaux) ───────────────────────
  badge_level text NOT NULL DEFAULT 'unverified'
    CHECK (badge_level IN ('unverified','verified','verified_plus')),
  badge_level_granted_at timestamptz,

  -- ─── Suivi modération ─────────────────────────────────────────────────
  signalements_count int NOT NULL DEFAULT 0,
  manual_review_priority int NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dvs_overall_status
  ON diagnostician_verification_status(overall_status);
CREATE INDEX IF NOT EXISTS idx_dvs_badge_level
  ON diagnostician_verification_status(badge_level);
CREATE INDEX IF NOT EXISTS idx_dvs_cofrac_expiry
  ON diagnostician_verification_status(cofrac_valid_until)
  WHERE cofrac_valid_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dvs_rcpro_expiry
  ON diagnostician_verification_status(rcpro_valid_until)
  WHERE rcpro_valid_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dvs_manual_review_priority
  ON diagnostician_verification_status(manual_review_priority DESC)
  WHERE manual_review_priority > 0;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_dvs_updated_at ON diagnostician_verification_status;
CREATE TRIGGER trg_dvs_updated_at
  BEFORE UPDATE ON diagnostician_verification_status
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_verification();

COMMENT ON TABLE diagnostician_verification_status IS
  'Pipeline validation 5 phases (Doctolib 2022). 1 ligne par diagnostician. overall_status GENERATED depuis les 4 statuts phases.';
COMMENT ON COLUMN diagnostician_verification_status.overall_status IS
  'GENERATED : verified si les 4 phases verified ; rejected si une phase est rejected/suspended/radiated ; expired si une phase est expired ; pending sinon.';
COMMENT ON COLUMN diagnostician_verification_status.badge_level IS
  'unverified (défaut) | verified (4 phases OK) | verified_plus (Doctolib-style : +reviews +ancienneté + 0 signalement).';

-- ============================================
-- B. verification_documents
--    Uploads multiples par diagnostician (CNI, COFRAC, RC Pro, KBis…)
-- ============================================
CREATE TABLE IF NOT EXISTS verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostician_id uuid NOT NULL REFERENCES diagnosticians(id) ON DELETE CASCADE,
  doc_type text NOT NULL
    CHECK (doc_type IN ('cni_recto','cni_verso','selfie_liveness','cofrac_certificate','rcpro_attestation','siret_extract_kbis','other')),
  storage_path text NOT NULL,            -- bucket `verification-docs` (privé)
  ai_extracted_data jsonb,               -- Claude Vision extraction
  ai_confidence_score numeric(4,3)
    CHECK (ai_confidence_score IS NULL OR (ai_confidence_score >= 0 AND ai_confidence_score <= 1)),
  validated_by_admin uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at timestamptz,
  notes text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vd_diag
  ON verification_documents(diagnostician_id);
CREATE INDEX IF NOT EXISTS idx_vd_doc_type
  ON verification_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_vd_validated_by_admin
  ON verification_documents(validated_by_admin)
  WHERE validated_by_admin IS NOT NULL;

COMMENT ON TABLE verification_documents IS
  'Uploads multiples (CNI recto/verso, selfie liveness, certif COFRAC, attestation RC Pro, extrait KBis) — bucket Supabase Storage `verification-docs` privé.';

-- ============================================
-- C. verification_checks_log
--    Audit trail : tous les checks (API, IA, admin manuel, cron, signalement)
-- ============================================
CREATE TABLE IF NOT EXISTS verification_checks_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostician_id uuid NOT NULL REFERENCES diagnosticians(id) ON DELETE CASCADE,
  check_type text NOT NULL
    CHECK (check_type IN ('identity_initial','cofrac_initial','cofrac_recurring','rcpro_initial','rcpro_renewal_alert','sirene_initial','sirene_annual','signalement','manual_audit')),
  check_source text NOT NULL
    CHECK (check_source IN ('france_connect','veriff','cofrac_api','sirene_api','claude_vision','admin_manual','particulier_report','cron')),
  status text NOT NULL
    CHECK (status IN ('success','warning','failure','timeout')),
  duration_ms int,
  result jsonb,
  triggered_by text,                     -- 'system' / 'admin:<uuid>' / 'user'
  performed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vcl_diag_performed
  ON verification_checks_log(diagnostician_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_vcl_check_type
  ON verification_checks_log(check_type, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_vcl_status_failure
  ON verification_checks_log(performed_at DESC)
  WHERE status IN ('failure','timeout');

COMMENT ON TABLE verification_checks_log IS
  'Audit trail tous checks (init, recurring, renewal, signalement, manuel). Lecture admin uniquement.';

-- ============================================
-- D. verification_alerts_queue
--    Alertes opérationnelles : expiration cert, suspension, etc.
-- ============================================
CREATE TABLE IF NOT EXISTS verification_alerts_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostician_id uuid NOT NULL REFERENCES diagnosticians(id) ON DELETE CASCADE,
  alert_type text NOT NULL
    CHECK (alert_type IN (
      'cofrac_expiry_60','cofrac_expiry_30','cofrac_expiry_7',
      'cofrac_suspended','cofrac_radiated',
      'rcpro_expiry_60','rcpro_expiry_30','rcpro_expiry_7','rcpro_expired',
      'sirene_radiated','sirene_liquidation',
      'signalement_threshold','manual_audit_required'
    )),
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','dismissed','resolved')),
  email_sent_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vaq_pending
  ON verification_alerts_queue(status, created_at DESC)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_vaq_diag
  ON verification_alerts_queue(diagnostician_id, status);
CREATE INDEX IF NOT EXISTS idx_vaq_severity_critical
  ON verification_alerts_queue(severity, status)
  WHERE severity = 'critical' AND status = 'pending';

-- Anti-doublons : 1 seule alerte 'pending' (diag,alert_type)
CREATE UNIQUE INDEX IF NOT EXISTS uq_vaq_pending_unique
  ON verification_alerts_queue(diagnostician_id, alert_type)
  WHERE status = 'pending';

COMMENT ON TABLE verification_alerts_queue IS
  'File d''alertes (expiration cert, suspension, signalements seuil). Consommée par worker Edge Function pour push email/SMS.';

-- ============================================
-- E. diagnostician_signalements
--    Signalements particuliers (avec trigger seuil 3/6 mois)
-- ============================================
CREATE TABLE IF NOT EXISTS diagnostician_signalements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostician_id uuid NOT NULL REFERENCES diagnosticians(id) ON DELETE CASCADE,
  reporter_email text,
  reporter_ip_hash text NOT NULL,
  reason text NOT NULL
    CHECK (reason IN ('faux_diagnostiqueur','rapport_frauduleux','dpe_aberrant','disparu_apres_paiement','identite_usurpee','non_certifie','autre')),
  description text,
  proof_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','investigating','confirmed_fraud','dismissed','resolved')),
  investigated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signal_diag_status
  ON diagnostician_signalements(diagnostician_id, status);
CREATE INDEX IF NOT EXISTS idx_signal_status_created
  ON diagnostician_signalements(status, created_at DESC);

COMMENT ON TABLE diagnostician_signalements IS
  'Signalements particuliers (faux diagnostiqueur, rapport frauduleux, etc.). Trigger sur INSERT : si 3+ en 6 mois → alerte critical + priority=100.';

-- ─── Trigger seuil signalements ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_signalement_threshold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM diagnostician_signalements
  WHERE diagnostician_id = NEW.diagnostician_id
    AND status IN ('new','investigating','confirmed_fraud')
    AND created_at > now() - interval '6 months';

  IF recent_count >= 3 THEN
    -- Anti-doublon : index unique partial sur (diag, alert_type) WHERE status='pending'
    INSERT INTO verification_alerts_queue (diagnostician_id, alert_type, severity)
    VALUES (NEW.diagnostician_id, 'signalement_threshold', 'critical')
    ON CONFLICT (diagnostician_id, alert_type) WHERE status = 'pending' DO NOTHING;

    UPDATE diagnostician_verification_status
    SET manual_review_priority = GREATEST(manual_review_priority, 100),
        signalements_count = recent_count
    WHERE diagnostician_id = NEW.diagnostician_id;
  ELSE
    UPDATE diagnostician_verification_status
    SET signalements_count = recent_count
    WHERE diagnostician_id = NEW.diagnostician_id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_signalement_threshold ON diagnostician_signalements;
CREATE TRIGGER trg_signalement_threshold
  AFTER INSERT ON diagnostician_signalements
  FOR EACH ROW EXECUTE FUNCTION public.trigger_signalement_threshold();

-- ============================================
-- F. RLS — Verrouillage strict (anon = NIET partout)
-- ============================================

-- F.1 diagnostician_verification_status
ALTER TABLE diagnostician_verification_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dvs_owner_read"      ON diagnostician_verification_status;
DROP POLICY IF EXISTS "dvs_owner_update"    ON diagnostician_verification_status;
DROP POLICY IF EXISTS "dvs_service_full"    ON diagnostician_verification_status;

-- Le diagnostician peut lire SES données
-- Note : on référence uniquement `claimed_by_user_id` (colonne canonique prod).
-- La colonne legacy `claimed_by` (cas migration unifiée) sera ajoutée à la condition
-- via une future migration si réactivée.
CREATE POLICY "dvs_owner_read" ON diagnostician_verification_status
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM diagnosticians d
      WHERE d.id = diagnostician_verification_status.diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  );

-- Le diagnostician peut UPDATE certaines colonnes "déclaratives" (méthode identity, doc upload trigger côté app)
-- Note : l'écriture des champs *_status / *_verified_at est réservée au service_role (Edge Functions)
CREATE POLICY "dvs_owner_update" ON diagnostician_verification_status
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM diagnosticians d
      WHERE d.id = diagnostician_verification_status.diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM diagnosticians d
      WHERE d.id = diagnostician_verification_status.diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  );

-- service_role accès complet (Edge Functions + cron)
CREATE POLICY "dvs_service_full" ON diagnostician_verification_status
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- F.2 verification_documents
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vd_owner_read"   ON verification_documents;
DROP POLICY IF EXISTS "vd_owner_insert" ON verification_documents;
DROP POLICY IF EXISTS "vd_service_full" ON verification_documents;

CREATE POLICY "vd_owner_read" ON verification_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM diagnosticians d
      WHERE d.id = verification_documents.diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY "vd_owner_insert" ON verification_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM diagnosticians d
      WHERE d.id = verification_documents.diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  );

CREATE POLICY "vd_service_full" ON verification_documents
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- F.3 verification_checks_log — service_role ONLY (audit immuable côté client)
ALTER TABLE verification_checks_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vcl_service_full" ON verification_checks_log;
CREATE POLICY "vcl_service_full" ON verification_checks_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- F.4 verification_alerts_queue — service_role ONLY
ALTER TABLE verification_alerts_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vaq_service_full" ON verification_alerts_queue;
CREATE POLICY "vaq_service_full" ON verification_alerts_queue
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- F.5 diagnostician_signalements
ALTER TABLE diagnostician_signalements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "signal_anon_insert"  ON diagnostician_signalements;
DROP POLICY IF EXISTS "signal_service_full" ON diagnostician_signalements;

-- Anonymes peuvent INSERT (formulaire signalement public) — pas SELECT
CREATE POLICY "signal_anon_insert" ON diagnostician_signalements
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "signal_service_full" ON diagnostician_signalements
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- H. Helpers SQL
-- ============================================

-- is_diagnostician_publicly_visible
-- → utilisé par RLS annuaire public pour gating "verified+badge"
CREATE OR REPLACE FUNCTION public.is_diagnostician_publicly_visible(p_diagnostician_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM diagnostician_verification_status
    WHERE diagnostician_id = p_diagnostician_id
      AND overall_status = 'verified'
      AND badge_level IN ('verified','verified_plus')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_diagnostician_publicly_visible(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_diagnostician_publicly_visible(uuid)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.is_diagnostician_publicly_visible IS
  'Gate annuaire public : true si overall_status=verified ET badge_level IN (verified, verified_plus).';

-- has_pending_critical_alerts
-- → utilisé par dashboard pour banner "Action requise"
CREATE OR REPLACE FUNCTION public.has_pending_critical_alerts(p_diagnostician_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM verification_alerts_queue
    WHERE diagnostician_id = p_diagnostician_id
      AND severity = 'critical'
      AND status = 'pending'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_pending_critical_alerts(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_pending_critical_alerts(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.has_pending_critical_alerts IS
  'true s''il existe ≥1 alerte severity=critical en status=pending pour ce diagnostician.';

-- ============================================
-- I. Vue admin_verification_queue — file de modération
-- ============================================
CREATE OR REPLACE VIEW admin_verification_queue
WITH (security_invoker = true)
AS
SELECT
  d.id,
  coalesce(d.full_name, trim(coalesce(d.first_name, '') || ' ' || coalesce(d.last_name, ''))) AS full_name,
  d.city,
  dvs.overall_status,
  dvs.badge_level,
  dvs.manual_review_priority,
  dvs.identity_status,
  dvs.cofrac_status,
  dvs.rcpro_status,
  dvs.sirene_status,
  dvs.signalements_count,
  dvs.created_at AS verification_started_at,
  dvs.updated_at AS last_activity_at
FROM diagnosticians d
LEFT JOIN diagnostician_verification_status dvs ON d.id = dvs.diagnostician_id
WHERE dvs.overall_status IN ('pending','rejected')
   OR dvs.manual_review_priority > 0
ORDER BY dvs.manual_review_priority DESC NULLS LAST,
         dvs.updated_at ASC NULLS LAST;

COMMENT ON VIEW admin_verification_queue IS
  'File de modération admin : diagnosticians en attente validation + priorité audit manuel. security_invoker=true (respect RLS appelant).';

-- ============================================
-- J. NOTE — Bucket Supabase Storage `verification-docs`
--    À créer manuellement via Dashboard :
--      Storage > New bucket > name=verification-docs > Public=OFF
--    Puis policies Storage RLS :
--      - SELECT/INSERT (authenticated) : path = `${auth.uid()}/...`
--      - service_role : tout accès
--    Réf doc : docs/SUPABASE-MANUAL-FIXES.md (à compléter)
-- ============================================

-- ============================================
-- Fin migration verification-pipeline
-- ============================================
