-- ============================================
-- KOVAS — Admin broadcasts + email templates (itérations 10+11)
-- Date : 2026-05-21
-- Cf. CLAUDE.md §22 (admin dashboard, prompt itérations 10+11)
--
-- Tables admin GLOBALES :
--   - broadcast_history     : envois emails de masse (audit + tracking)
--   - email_templates       : templates réutilisables (seed initial)
--
-- RLS strictes : tout réservé aux admins via public.is_admin(auth.uid()).
-- ============================================

-- ============================================
-- 1. broadcast_history — historique des envois de masse
-- ============================================
CREATE TABLE broadcast_history (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject            text NOT NULL,
  body_html          text NOT NULL,
  body_text          text,
  -- Audience
  audience_filter    jsonb NOT NULL,  -- { plan, status, custom_segments }
  recipients_count   int NOT NULL DEFAULT 0,
  -- Status
  status             text NOT NULL CHECK (status IN ('draft', 'sending', 'sent', 'failed', 'cancelled')) DEFAULT 'draft',
  sent_at            timestamptz,
  -- Tracking
  delivered_count    int NOT NULL DEFAULT 0,
  opened_count       int NOT NULL DEFAULT 0,
  clicked_count      int NOT NULL DEFAULT 0,
  error_count        int NOT NULL DEFAULT 0,
  -- Audit
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_broadcast_status ON broadcast_history(status, created_at DESC);

-- ============================================
-- 2. email_templates — templates réutilisables
-- ============================================
CREATE TABLE email_templates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key                text UNIQUE NOT NULL,  -- 'welcome', 'onboarding-day-3', 'churn-prevention', etc.
  name               text NOT NULL,
  subject            text NOT NULL,
  body_html          text NOT NULL,
  body_text          text,
  -- Variables disponibles : ['{{name}}', '{{plan}}', '{{custom_message}}']
  variables          jsonb DEFAULT '[]'::jsonb,
  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 3. RLS — verrouillage admin only
-- ============================================
ALTER TABLE broadcast_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broadcast_all" ON broadcast_history
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "templates_all" ON email_templates
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================
-- 4. Seed — templates initiaux
-- ============================================
INSERT INTO email_templates (key, name, subject, body_html, variables) VALUES
  ('welcome', 'Welcome après signup', 'Bienvenue sur KOVAS, {{name}} !',
   '<p>Bienvenue {{name}}, ravis de vous compter parmi nous.</p><p>Première étape : créez votre premier dossier en moins de 2 minutes.</p>',
   '["name"]'::jsonb),
  ('churn-prevention', 'Prevention churn', 'Tu nous manques sur KOVAS',
   '<p>Bonjour {{name}}, on a remarqué que vous n''êtes pas revenu depuis {{last_login_days_ago}} jours.</p><p>Tout va bien ? Un petit retour d''expérience nous aiderait.</p>',
   '["name", "last_login_days_ago"]'::jsonb),
  ('upgrade-suggestion', 'Suggestion upgrade plan', '{{name}}, prêt à passer au plan supérieur ?',
   '<p>{{name}}, tu utilises {{usage_pct}}% de ton plan {{plan}}.</p><p>Un upgrade vous coûterait moins en surplus mensuel.</p>',
   '["name", "plan", "usage_pct"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
