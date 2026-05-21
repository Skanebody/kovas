-- ============================================
-- KOVAS — Rapports mensuels Gain Tracker (CLAUDE.md §21bis V1.5)
--
-- Système d'envoi automatique du rapport mensuel d'activité chaque 1er du mois
-- via cron Vercel + Resend. Ton SOBRE PROFESSIONNEL (avatar diagnostiqueur).
--
-- Tables :
--   - monthly_reports         : 1 ligne par (org, year, month), tracking envoi email
--   - user_preferences.monthly_report_email_enabled : opt-out par utilisateur
--
-- Function :
--   - compute_monthly_report(org_id, year, month) : agrège missions + upsert ligne
-- ============================================

-- ============================================
-- A. Table monthly_reports
-- ============================================
CREATE TABLE IF NOT EXISTS monthly_reports (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Destinataire principal (founder/owner de l'org pour V1, multi-recipient V2)
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_year           integer NOT NULL,
  period_month          integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  missions_count        integer NOT NULL DEFAULT 0,
  -- Temps économisé estimé : missions × 90 minutes (cf. CLAUDE.md "promesse 1h30/mission")
  time_saved_minutes    integer NOT NULL DEFAULT 0,
  -- Valeur générée : temps × 50€/h (tarif horaire moyen diagnostiqueur)
  value_generated_cents integer NOT NULL DEFAULT 0,
  -- Type de diagnostic majoritaire du mois (DPE / AMIANTE / etc.)
  top_diagnostic_type   text,
  -- Tracking envoi Resend
  sent_at               timestamptz,
  email_status          text NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending','sent','failed','bounced','skipped')),
  email_message_id      text,
  email_error           text,
  retry_count           integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_reports_status
  ON monthly_reports (sent_at, email_status);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_user
  ON monthly_reports (user_id, period_year DESC, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_org
  ON monthly_reports (organization_id, period_year DESC, period_month DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.monthly_reports_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS monthly_reports_set_updated_at_trg ON monthly_reports;
CREATE TRIGGER monthly_reports_set_updated_at_trg
  BEFORE UPDATE ON monthly_reports
  FOR EACH ROW EXECUTE FUNCTION public.monthly_reports_set_updated_at();

-- ============================================
-- B. RLS — lecture user concerné + admin (service_role bypass)
-- ============================================
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_reports: self read" ON monthly_reports;
CREATE POLICY "monthly_reports: self read"
  ON monthly_reports FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_member_of(organization_id)
  );

-- INSERT/UPDATE/DELETE uniquement via service_role (cron + admin)
-- Pas de policy ouverte côté user — toute mutation passe par le cron job.

-- ============================================
-- C. Extension user_preferences : opt-out rapport mensuel
-- ============================================
-- user_preferences existe déjà (créée 20260520180000_capture_first_mode.sql).
-- On ajoute uniquement la colonne d'opt-out, default true (opt-in par défaut).
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS monthly_report_email_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN user_preferences.monthly_report_email_enabled IS
  'Si false, l''utilisateur ne reçoit pas le rapport mensuel d''activité par email. Réglage exposé sur /app/account.';

-- ============================================
-- D. Function compute_monthly_report(org_id, year, month)
--
-- Agrège les missions terminées du mois pour l'org et fait un upsert dans
-- monthly_reports (sans envoyer l'email — ça c'est la route /api/cron).
-- Retourne la ligne monthly_reports.
--
-- Critère missions : status IN ('done','exported','archived') ET completed_at
-- dans le mois (fallback created_at si completed_at NULL). deleted_at IS NULL.
-- ============================================
CREATE OR REPLACE FUNCTION public.compute_monthly_report(
  p_org_id uuid,
  p_year integer,
  p_month integer
)
RETURNS monthly_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end   timestamptz;
  v_missions_count int;
  v_time_saved_minutes int;
  v_value_generated_cents int;
  v_top_type text;
  v_owner_user_id uuid;
  v_row monthly_reports;
BEGIN
  IF p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'compute_monthly_report: month doit être entre 1 et 12 (reçu %)', p_month;
  END IF;

  -- Bornes du mois en Europe/Paris (mais stockage UTC ISO)
  v_period_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'Europe/Paris');
  v_period_end   := (v_period_start + interval '1 month');

  -- Founder/owner de l'org = première membership role='owner' active
  -- Fallback : default_org_id du premier profile (peu probable).
  SELECT m.user_id INTO v_owner_user_id
  FROM memberships m
  WHERE m.organization_id = p_org_id
    AND m.role = 'owner'
    AND m.status = 'active'
  ORDER BY m.created_at ASC
  LIMIT 1;

  IF v_owner_user_id IS NULL THEN
    -- Pas d'owner identifié → on prend n'importe quel membre actif
    SELECT m.user_id INTO v_owner_user_id
    FROM memberships m
    WHERE m.organization_id = p_org_id
      AND m.status = 'active'
    ORDER BY m.created_at ASC
    LIMIT 1;
  END IF;

  IF v_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'compute_monthly_report: aucun membre actif trouvé pour org %', p_org_id;
  END IF;

  -- Agrégation missions du mois
  SELECT
    COUNT(*)::int,
    (COUNT(*) * 90)::int,                              -- 90 min économisées / mission
    (COUNT(*) * 90 * 100 / 60 * 50)::int               -- (min × 50€/h en cents)
  INTO v_missions_count, v_time_saved_minutes, v_value_generated_cents
  FROM missions
  WHERE organization_id = p_org_id
    AND deleted_at IS NULL
    AND status IN ('done','exported','archived')
    AND COALESCE(completed_at, created_at) >= v_period_start
    AND COALESCE(completed_at, created_at) <  v_period_end;

  -- Top diagnostic type (mode statistique simple)
  SELECT type::text INTO v_top_type
  FROM missions
  WHERE organization_id = p_org_id
    AND deleted_at IS NULL
    AND status IN ('done','exported','archived')
    AND COALESCE(completed_at, created_at) >= v_period_start
    AND COALESCE(completed_at, created_at) <  v_period_end
  GROUP BY type
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Upsert ligne monthly_reports
  INSERT INTO monthly_reports (
    organization_id, user_id, period_year, period_month,
    missions_count, time_saved_minutes, value_generated_cents, top_diagnostic_type,
    email_status
  ) VALUES (
    p_org_id, v_owner_user_id, p_year, p_month,
    COALESCE(v_missions_count, 0),
    COALESCE(v_time_saved_minutes, 0),
    COALESCE(v_value_generated_cents, 0),
    v_top_type,
    'pending'
  )
  ON CONFLICT (organization_id, period_year, period_month)
  DO UPDATE SET
    user_id               = EXCLUDED.user_id,
    missions_count        = EXCLUDED.missions_count,
    time_saved_minutes    = EXCLUDED.time_saved_minutes,
    value_generated_cents = EXCLUDED.value_generated_cents,
    top_diagnostic_type   = EXCLUDED.top_diagnostic_type,
    -- on garde sent_at / email_status / message_id si déjà 'sent'
    email_status = CASE
      WHEN monthly_reports.email_status = 'sent' THEN monthly_reports.email_status
      ELSE EXCLUDED.email_status
    END,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.compute_monthly_report(uuid, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.compute_monthly_report(uuid, integer, integer) TO service_role;
