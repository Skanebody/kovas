-- ============================================================================
-- Observatoire — Rapports mensuels auto-générés
-- ============================================================================
-- Étend `observatoire_subscribers` (Lot #144) avec le tracking des rapports
-- envoyés, et crée la table `observatoire_reports` qui archive chaque rapport
-- généré (PDF + métadonnées + stats agrégées du mois).
--
-- Le cron Edge Function `observatoire-monthly-report` tourne le 1er du mois
-- à 6h CET, génère le PDF du mois écoulé, l'archive ici, l'envoie aux
-- subscribers, et le stocke dans public/observatoire/rapport-YYYY-MM.pdf
-- pour téléchargement direct.
-- ============================================================================

-- 1. Extension subscribers : track des opens email (via Resend webhooks)
ALTER TABLE public.observatoire_subscribers
  ADD COLUMN IF NOT EXISTS opens_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_name text;

-- 2. Table archive des rapports mensuels générés
CREATE TABLE IF NOT EXISTS public.observatoire_reports (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_year             int NOT NULL,
  period_month            int NOT NULL,
  pdf_url                 text NOT NULL,
  pdf_size_bytes          int,
  cover_title             text NOT NULL,
  executive_summary       text NOT NULL,

  -- Statistiques agrégées du mois (JSON pour flexibilité)
  stats_payload           jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Méthodologie + rédaction IA
  ai_model                text,
  ai_input_tokens         int NOT NULL DEFAULT 0,
  ai_output_tokens        int NOT NULL DEFAULT 0,
  ai_cost_eur             numeric(8, 4) NOT NULL DEFAULT 0,

  -- Distribution
  subscribers_at_send     int NOT NULL DEFAULT 0,
  emails_sent             int NOT NULL DEFAULT 0,
  emails_failed           int NOT NULL DEFAULT 0,
  emails_opened           int NOT NULL DEFAULT 0,
  downloads_direct        int NOT NULL DEFAULT 0,

  status                  text NOT NULL DEFAULT 'draft',
  generated_at            timestamptz NOT NULL DEFAULT now(),
  sent_at                 timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),

  UNIQUE (period_year, period_month)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'observatoire_reports_period_check'
  ) THEN
    ALTER TABLE public.observatoire_reports
      ADD CONSTRAINT observatoire_reports_period_check
      CHECK (period_month BETWEEN 1 AND 12 AND period_year BETWEEN 2024 AND 2100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'observatoire_reports_status_check'
  ) THEN
    ALTER TABLE public.observatoire_reports
      ADD CONSTRAINT observatoire_reports_status_check
      CHECK (status IN ('draft', 'sent', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_observatoire_reports_period
  ON public.observatoire_reports (period_year DESC, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_observatoire_reports_status
  ON public.observatoire_reports (status, generated_at DESC);

ALTER TABLE public.observatoire_reports ENABLE ROW LEVEL SECURITY;

-- Lecture publique des rapports envoyés (pour la page /observatoire/rapports)
DROP POLICY IF EXISTS observatoire_reports_select_public ON public.observatoire_reports;
CREATE POLICY observatoire_reports_select_public
  ON public.observatoire_reports
  FOR SELECT
  TO anon, authenticated
  USING (status = 'sent');

-- Écriture admin only
DROP POLICY IF EXISTS observatoire_reports_admin_all ON public.observatoire_reports;
CREATE POLICY observatoire_reports_admin_all
  ON public.observatoire_reports
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

COMMENT ON TABLE public.observatoire_reports IS
  'Archive des rapports mensuels Observatoire KOVAS générés par cron. Status sent = visible publiquement.';
