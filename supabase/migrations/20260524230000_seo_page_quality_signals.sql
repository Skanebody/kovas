-- KOVAS — Monitoring qualité des pages SEO programmatiques
-- Migration : 20260524230000_seo_page_quality_signals.sql
--
-- Objectif : tracker les signaux Google Core Update mai 2026 sur les pages
-- programmatiques (/trouver-un-diagnostiqueur/[dept]/[city], /diagnostic/*,
-- /prix/*) pour détecter les pages à refresh prioritaires.
--
-- Signaux trackés (helpful content) :
--  - bounce_rate : taux de rebond depuis PostHog ou GA4
--  - avg_time_on_page_sec : temps moyen sur page
--  - pogo_stick_count : nombre de "pogo-sticking" détectés
--    (utilisateur revient à Google après ouverture)
--  - has_real_diagnostician : page a-t-elle au moins 3 diagnostiqueurs réels
--  - has_local_data : page a-t-elle des stats locales vérifiées
--  - has_human_signature : signature humaine présente (par défaut TRUE car
--    AuthorBio est inclus dans le template canonique)
--
-- Usage admin : page /admin/seo/quality-monitor liste les pages à fort
-- bounce_rate (>70%) + faible avg_time_on_page (<30s) + pogo_stick_count > 5.

CREATE TABLE IF NOT EXISTS seo_page_quality_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_url text NOT NULL UNIQUE,
  page_type text, -- 'city', 'department', 'diagnostic-type', 'guide'
  city_slug text,
  dept_code text,
  bounce_rate numeric, -- 0.0 à 1.0
  avg_time_on_page_sec numeric,
  pogo_stick_count int NOT NULL DEFAULT 0,
  total_visits int NOT NULL DEFAULT 0,
  total_conversions int NOT NULL DEFAULT 0,
  has_real_diagnostician boolean NOT NULL DEFAULT false,
  has_local_data boolean NOT NULL DEFAULT false,
  has_human_signature boolean NOT NULL DEFAULT true,
  quality_score numeric, -- 0-100 calculé via formule helpful_content
  last_audited_at timestamptz NOT NULL DEFAULT now(),
  needs_refresh boolean NOT NULL DEFAULT false,
  refresh_reason text, -- 'high_bounce', 'low_time', 'pogo_stick', 'no_diag'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seo_pq_url_idx ON seo_page_quality_signals(page_url);
CREATE INDEX IF NOT EXISTS seo_pq_needs_refresh_idx
  ON seo_page_quality_signals(needs_refresh)
  WHERE needs_refresh = true;
CREATE INDEX IF NOT EXISTS seo_pq_page_type_idx ON seo_page_quality_signals(page_type);
CREATE INDEX IF NOT EXISTS seo_pq_dept_idx ON seo_page_quality_signals(dept_code);
CREATE INDEX IF NOT EXISTS seo_pq_quality_score_idx
  ON seo_page_quality_signals(quality_score DESC NULLS LAST);

-- Trigger updated_at auto
CREATE OR REPLACE FUNCTION update_seo_pq_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS seo_pq_updated_at_trigger ON seo_page_quality_signals;
CREATE TRIGGER seo_pq_updated_at_trigger
  BEFORE UPDATE ON seo_page_quality_signals
  FOR EACH ROW
  EXECUTE FUNCTION update_seo_pq_updated_at();

-- RLS : admin uniquement (gérée via policy admin_only)
ALTER TABLE seo_page_quality_signals ENABLE ROW LEVEL SECURITY;

-- Policy lecture admin
CREATE POLICY seo_pq_admin_read
  ON seo_page_quality_signals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.email IN ('benjaminbel@outlook.fr', 'contact@kovas.fr')
    )
  );

-- Policy écriture admin
CREATE POLICY seo_pq_admin_write
  ON seo_page_quality_signals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.email IN ('benjaminbel@outlook.fr', 'contact@kovas.fr')
    )
  );

-- Revoke des privilèges publics
REVOKE ALL ON seo_page_quality_signals FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON seo_page_quality_signals TO service_role;

COMMENT ON TABLE seo_page_quality_signals IS
  'Monitoring Core Update mai 2026 — tracking helpful content + pogo-sticking sur pages programmatiques';
COMMENT ON COLUMN seo_page_quality_signals.quality_score IS
  'Score 0-100 calculé : 30 % bounce + 30 % time_on_page + 20 % conversion + 20 % completeness (diag/data/signature)';
COMMENT ON COLUMN seo_page_quality_signals.refresh_reason IS
  'high_bounce (>70%), low_time (<30s), pogo_stick (>5), no_diag (pas de fiche réelle), stale (>90 jours)';
