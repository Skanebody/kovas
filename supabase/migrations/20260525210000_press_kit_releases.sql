-- ============================================================================
-- KOVAS — Press kit dynamique (Game Changer 5 acqui-target)
-- ============================================================================
-- Étend l'Observatoire mensuel avec un volet « communiqué presse » qui consomme
-- les rapports déjà générés par `observatoire-monthly-report` et les diffuse à
-- un fichier journalistes opt-in (`press_contacts`).
--
-- Trois tables :
--   1. public.press_contacts        — fichier journalistes opt-in CRM
--   2. public.press_releases        — versions communiqué (≈1500 mots) des
--                                     rapports observatoire (1 release par mois)
--   3. public.press_release_sends   — tracking individuel des envois
--
-- Authority : `docs/refonte-2026-05/REFONTE-ACQUI-TARGET-V2.md` §6.5 — Game
-- Changer 5 « Observatoire mensuel + presse automatisée » (P1, 40h estimé).
-- ============================================================================

-- 1. press_contacts — fichier journalistes opt-in
CREATE TABLE IF NOT EXISTS public.press_contacts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                   text NOT NULL,
  full_name               text NOT NULL,
  outlet                  text,                   -- Les Échos, Le Figaro Immobilier, etc.
  role                    text,                   -- Journaliste, Chef de service, etc.
  beats                   text[] NOT NULL DEFAULT '{}'::text[], -- ['immobilier', 'energie', 'reglementaire']
  phone                   text,
  city                    text,
  language               text NOT NULL DEFAULT 'fr',
  source                  text,                   -- 'manual', 'media_directory', 'reach_back'
  notes                   text,

  -- Consentement RGPD
  opt_in                  boolean NOT NULL DEFAULT true,
  opt_in_source           text,                   -- 'first_email', 'event_paris', 'manual_outreach'
  opted_in_at             timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at         timestamptz,
  unsubscribe_reason      text,

  -- Tracking
  emails_sent             int NOT NULL DEFAULT 0,
  emails_opened           int NOT NULL DEFAULT 0,
  emails_clicked          int NOT NULL DEFAULT 0,
  last_sent_at            timestamptz,
  last_opened_at          timestamptz,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_press_contacts_active
  ON public.press_contacts (opt_in, unsubscribed_at)
  WHERE opt_in = true AND unsubscribed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_press_contacts_beats
  ON public.press_contacts USING gin (beats);

ALTER TABLE public.press_contacts ENABLE ROW LEVEL SECURITY;

-- Admin only — pas d'accès anon (RGPD : fichier journalistes confidentiel)
DROP POLICY IF EXISTS press_contacts_admin_all ON public.press_contacts;
CREATE POLICY press_contacts_admin_all
  ON public.press_contacts
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

COMMENT ON TABLE public.press_contacts IS
  'Fichier journalistes opt-in pour diffusion des communiqués presse mensuels. RLS admin-only.';

-- 2. press_releases — versions communiqué des rapports observatoire
CREATE TABLE IF NOT EXISTS public.press_releases (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lien rapport observatoire source (optionnel : on peut aussi publier un
  -- communiqué hors cycle mensuel — ex. annonce levée, partenariat)
  observatoire_report_id  uuid REFERENCES public.observatoire_reports (id) ON DELETE SET NULL,

  -- Métadonnées éditoriales
  slug                    text NOT NULL,          -- 'observatoire-mai-2026' ou 'partenariat-cofrac'
  title                   text NOT NULL,
  subtitle                text,
  dateline                text,                   -- "Paris, le 5 juin 2026"
  embargo_until           timestamptz,            -- NULL = publication immédiate
  category                text NOT NULL DEFAULT 'observatoire',
  -- 'observatoire' | 'milestone' | 'partnership' | 'product_launch' | 'study'

  -- Contenu (Markdown)
  body_markdown           text NOT NULL,          -- 1200-1800 mots, structure communiqué AFP
  key_quotes              jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{author, role, quote}]
  key_figures             jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{label, value, source}]

  -- Assets
  pdf_url                 text,
  pdf_size_bytes          int,
  hero_image_url          text,
  press_kit_zip_url       text,

  -- Génération IA
  ai_model                text,
  ai_input_tokens         int NOT NULL DEFAULT 0,
  ai_output_tokens        int NOT NULL DEFAULT 0,
  ai_cost_eur             numeric(8, 4) NOT NULL DEFAULT 0,

  -- Workflow
  status                  text NOT NULL DEFAULT 'draft',
  -- 'draft' | 'pending_review' | 'approved' | 'sent' | 'archived'
  approved_by             uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at             timestamptz,

  -- Distribution tracking
  contacts_at_send        int NOT NULL DEFAULT 0,
  emails_sent             int NOT NULL DEFAULT 0,
  emails_failed           int NOT NULL DEFAULT 0,
  emails_opened           int NOT NULL DEFAULT 0,
  emails_clicked          int NOT NULL DEFAULT 0,
  sent_at                 timestamptz,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  UNIQUE (slug)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'press_releases_status_check'
  ) THEN
    ALTER TABLE public.press_releases
      ADD CONSTRAINT press_releases_status_check
      CHECK (status IN ('draft', 'pending_review', 'approved', 'sent', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'press_releases_category_check'
  ) THEN
    ALTER TABLE public.press_releases
      ADD CONSTRAINT press_releases_category_check
      CHECK (category IN ('observatoire', 'milestone', 'partnership', 'product_launch', 'study'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_press_releases_status_sent
  ON public.press_releases (status, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_press_releases_observatoire_report
  ON public.press_releases (observatoire_report_id)
  WHERE observatoire_report_id IS NOT NULL;

ALTER TABLE public.press_releases ENABLE ROW LEVEL SECURITY;

-- Lecture publique uniquement des communiqués envoyés (utilisé par /presse)
DROP POLICY IF EXISTS press_releases_select_public ON public.press_releases;
CREATE POLICY press_releases_select_public
  ON public.press_releases
  FOR SELECT
  TO anon, authenticated
  USING (status = 'sent' AND (embargo_until IS NULL OR embargo_until <= now()));

-- Admin all
DROP POLICY IF EXISTS press_releases_admin_all ON public.press_releases;
CREATE POLICY press_releases_admin_all
  ON public.press_releases
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

COMMENT ON TABLE public.press_releases IS
  'Communiqués de presse (1200-1800 mots). Publication : status=sent. RLS : public read sent, admin write.';

-- 3. press_release_sends — tracking individuel par envoi
CREATE TABLE IF NOT EXISTS public.press_release_sends (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  press_release_id        uuid NOT NULL REFERENCES public.press_releases (id) ON DELETE CASCADE,
  press_contact_id        uuid NOT NULL REFERENCES public.press_contacts (id) ON DELETE CASCADE,
  resend_message_id       text,                   -- id Resend pour réconcilier webhooks
  sent_at                 timestamptz NOT NULL DEFAULT now(),
  opened_at               timestamptz,
  clicked_at              timestamptz,
  bounced_at              timestamptz,
  bounce_reason           text,
  unsubscribed_at         timestamptz,

  UNIQUE (press_release_id, press_contact_id)
);

CREATE INDEX IF NOT EXISTS idx_press_release_sends_release
  ON public.press_release_sends (press_release_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_press_release_sends_contact
  ON public.press_release_sends (press_contact_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_press_release_sends_resend
  ON public.press_release_sends (resend_message_id)
  WHERE resend_message_id IS NOT NULL;

ALTER TABLE public.press_release_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS press_release_sends_admin_all ON public.press_release_sends;
CREATE POLICY press_release_sends_admin_all
  ON public.press_release_sends
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

COMMENT ON TABLE public.press_release_sends IS
  'Tracking individuel des envois de communiqués (1 row par contact x release). Alimente metrics ROI presse.';

-- 4. Vue publique consolidée — compteur mentions pour la page /presse
CREATE OR REPLACE VIEW public.v_press_mentions_stats
WITH (security_invoker = on)
AS
SELECT
  (SELECT count(*) FROM public.observatoire_press_citations WHERE status = 'verified')::int AS total_mentions,
  (SELECT count(DISTINCT media_slug) FROM public.observatoire_press_citations WHERE status = 'verified')::int AS unique_outlets,
  (SELECT count(*) FROM public.press_releases WHERE status = 'sent')::int AS total_releases_sent,
  (SELECT count(*) FROM public.press_contacts WHERE opt_in = true AND unsubscribed_at IS NULL)::int AS active_press_contacts,
  (SELECT max(published_at) FROM public.observatoire_press_citations WHERE status = 'verified') AS last_mention_at,
  (SELECT max(sent_at) FROM public.press_releases WHERE status = 'sent') AS last_release_sent_at;

COMMENT ON VIEW public.v_press_mentions_stats IS
  'Statistiques agrégées presse pour la page /presse (compteur mentions, outlets, releases).';

GRANT SELECT ON public.v_press_mentions_stats TO anon, authenticated;
