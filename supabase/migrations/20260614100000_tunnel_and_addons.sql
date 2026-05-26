-- ============================================
-- KOVAS — Vague TUGAN-5 — Tunnel signup Tugan v3.0 + Addons (7 upsells)
-- Date : 2026-06-14
--
-- Pose les fondations DB pour :
--   - Le tunnel signup en 6 étapes (qualify → recommendation → account → billing → welcome → onboarding)
--   - Les 7 upsells Tugan (premium_reports, pipeline_maprimerenov, bouclier_conformite,
--     observatoire_local, auto_reponse_avis, newsletter_clients, cockpit_cabinet)
--   - L'order bump "Audit Rétroactif" 99 € one-time
--   - Le Lifetime Deal Partenaire Fondateur (compteur 10 spots, backing pricing-plans.ts)
--
-- 11 tables au total :
--   1.  tunnel_signup_state           — état du tunnel par user (étape courante, quiz, UTM)
--   2.  user_addon_subscriptions      — abonnement aux upsells (1 ligne par addon souscrit)
--   3.  audit_retroactif_reports      — rapport order bump 99 € one-time
--   4.  premium_reports_generated     — PDFs client premium (1 par mission)
--   5.  automated_email_sequences     — séquences emails (MaPrimeRénov, trial Tugan, signup)
--   6.  audit_conformite_reports      — rapport mensuel Bouclier Conformité
--   7.  observatoire_local_reports    — rapport mensuel Observatoire Local
--   8.  google_review_replies         — réponses Auto-Réponse Avis
--   9.  newsletter_campaigns          — campagnes Newsletter Clients
--   10. cabinet_reports               — Cockpit Cabinet (Cabinet+ exclusif)
--   11. lifetime_deal_purchases       — backing compteur Partenaire Fondateur 10 spots
--
-- + Helper RPC `public.lifetime_deal_spots_remaining()` (SECURITY DEFINER)
-- + Vue publique `public.lifetime_deal_public_stats` (lisible par anon)
--
-- Conventions :
--   - Montants en centimes integer (jamais float)
--   - Toutes les colonnes temporelles en `timestamptz`
--   - RLS strict multi-tenant via auth.uid() ou public.is_member_of()
--   - search_path pinned sur public, extensions pour les RPC
--   - Indexes sur toutes les FK et colonnes triées
-- ============================================

-- ============================================
-- 1. tunnel_signup_state
-- ============================================
CREATE TABLE IF NOT EXISTS tunnel_signup_state (
  user_id                       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Étape courante du tunnel (6 étapes Tugan v3.0)
  current_step                  text NOT NULL CHECK (
    current_step IN ('qualify', 'recommendation', 'account', 'billing', 'welcome', 'onboarding')
  ),

  -- Réponses au quiz de qualification (étape 1)
  quiz_team_size                text,
  quiz_monthly_missions         integer,
  quiz_current_editor           text,

  -- Recommandation calculée (étape 2)
  recommended_plan              text,

  -- Order bump "Audit Rétroactif" (étape 4 billing)
  order_bump_audit_retro        boolean NOT NULL DEFAULT false,
  audit_retroactif_purchased    boolean NOT NULL DEFAULT false,

  -- Attribution marketing
  utm_source                    text,
  utm_medium                    text,
  utm_campaign                  text,
  referrer                      text,

  -- Niveau de prise de conscience prospect (Eugène Schwartz : 1=unaware → 5=most aware)
  awareness_level               integer CHECK (awareness_level BETWEEN 1 AND 5),

  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tunnel_signup_state_current_step
  ON tunnel_signup_state (current_step);
CREATE INDEX IF NOT EXISTS idx_tunnel_signup_state_updated_at
  ON tunnel_signup_state (updated_at DESC);

COMMENT ON TABLE tunnel_signup_state IS
  'État du tunnel signup Tugan v3.0 (6 étapes). 1 ligne par user. Persiste les réponses quiz + recommandation + order bump + UTM + niveau d''awareness Eugène Schwartz.';
COMMENT ON COLUMN tunnel_signup_state.awareness_level IS
  'Niveau de prise de conscience Eugène Schwartz : 1=unaware, 2=problem-aware, 3=solution-aware, 4=product-aware, 5=most aware.';

-- ============================================
-- 2. user_addon_subscriptions
-- ============================================
-- 7 upsells Tugan + 4 addons legacy V1 (cf. pricing-plans.ts)
CREATE TABLE IF NOT EXISTS user_addon_subscriptions (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Slug technique de l'addon (cf. docs Tugan §6 + pricing-plans.ts ADDONS)
  addon_slug                    text NOT NULL,

  -- Référence Stripe
  stripe_subscription_item_id   text NOT NULL,

  -- Statut miroir de Stripe Subscription
  status                        text NOT NULL CHECK (
    status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')
  ),

  trial_ends_at                 timestamptz,
  current_period_start          timestamptz NOT NULL,
  current_period_end            timestamptz NOT NULL,
  cancelled_at                  timestamptz,

  created_at                    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, addon_slug)
);

CREATE INDEX IF NOT EXISTS idx_user_addon_subs_user
  ON user_addon_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_addon_subs_status_period
  ON user_addon_subscriptions (status, current_period_end);
CREATE INDEX IF NOT EXISTS idx_user_addon_subs_slug
  ON user_addon_subscriptions (addon_slug);

COMMENT ON TABLE user_addon_subscriptions IS
  'Abonnements aux upsells/addons (1 ligne par addon souscrit). 7 upsells Tugan : premium_reports, pipeline_maprimerenov, bouclier_conformite, observatoire_local, auto_reponse_avis, newsletter_clients, cockpit_cabinet (+ 4 legacy V1). Miroir des Stripe Subscription Items.';
COMMENT ON COLUMN user_addon_subscriptions.addon_slug IS
  'Slug technique : premium_reports | pipeline_maprimerenov | bouclier_conformite | observatoire_local | auto_reponse_avis | newsletter_clients | cockpit_cabinet | + legacy.';

-- ============================================
-- 3. audit_retroactif_reports
-- ============================================
CREATE TABLE IF NOT EXISTS audit_retroactif_reports (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Métriques de l'audit
  missions_imported_count       integer,
  f_g_missions_count            integer,
  high_risk_missions_count      integer,

  pdf_url                       text,

  -- Coût IA généré pour cet audit (Claude tokens)
  ai_cost_eur                   numeric(10, 6),

  status                        text NOT NULL DEFAULT 'processing' CHECK (
    status IN ('processing', 'completed', 'failed')
  ),

  completed_at                  timestamptz,
  created_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_retro_user
  ON audit_retroactif_reports (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_retro_status
  ON audit_retroactif_reports (status);

COMMENT ON TABLE audit_retroactif_reports IS
  'Rapport order bump "Audit Rétroactif" (99 € one-time) commandé pendant le tunnel signup. Analyse les missions historiques importées et identifie F/G + high-risk.';

-- ============================================
-- 4. premium_reports_generated
-- ============================================
CREATE TABLE IF NOT EXISTS premium_reports_generated (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id                    uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  user_id                       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  pdf_url                       text NOT NULL,
  ai_cost_eur                   numeric(10, 6),

  sent_to_client_at             timestamptz,
  opened_by_client_at           timestamptz,
  generated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_premium_reports_user
  ON premium_reports_generated (user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_premium_reports_mission
  ON premium_reports_generated (mission_id);
CREATE INDEX IF NOT EXISTS idx_premium_reports_opened
  ON premium_reports_generated (opened_by_client_at)
  WHERE opened_by_client_at IS NOT NULL;

COMMENT ON TABLE premium_reports_generated IS
  'PDFs premium générés pour le client final (upsell Premium Reports). 1 PDF par mission. Tracking ouverture pour mesurer engagement client.';

-- ============================================
-- 5. automated_email_sequences
-- ============================================
CREATE TABLE IF NOT EXISTS automated_email_sequences (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type de séquence (trial Tugan 30j, MaPrimeRénov pipeline, etc.)
  sequence_type                 text NOT NULL CHECK (
    sequence_type IN ('trial_tugan', 'maprimerenov', 'reactivation', 'retention')
  ),

  target_email                  text NOT NULL,
  mission_id                    uuid REFERENCES missions(id) ON DELETE SET NULL,
  user_id                       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Position dans la séquence (1, 2, 3, …)
  step                          integer NOT NULL DEFAULT 1,

  status                        text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'failed', 'cancelled')
  ),

  next_send_at                  timestamptz NOT NULL,
  last_sent_at                  timestamptz,
  completed_at                  timestamptz,

  created_at                    timestamptz NOT NULL DEFAULT now()
);

-- Index critique : utilisé par le cron `process-email-sequences`
CREATE INDEX IF NOT EXISTS idx_email_sequences_pending_next
  ON automated_email_sequences (status, next_send_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_sequences_user
  ON automated_email_sequences (user_id);
CREATE INDEX IF NOT EXISTS idx_email_sequences_mission
  ON automated_email_sequences (mission_id);

COMMENT ON TABLE automated_email_sequences IS
  'File d''attente des emails automatiques (séquences trial Tugan 30j, pipeline MaPrimeRénov, réactivation, rétention). Le cron `process-email-sequences` poll cet index toutes les 5 min.';

-- ============================================
-- 6. audit_conformite_reports
-- ============================================
CREATE TABLE IF NOT EXISTS audit_conformite_reports (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Format YYYY-MM
  month_year                    text NOT NULL CHECK (month_year ~ '^[0-9]{4}-[0-9]{2}$'),

  score_global                  numeric(4, 1),
  missions_count                integer,
  high_risk_missions            jsonb,

  pdf_url                       text,
  ai_cost_eur                   numeric(10, 6),

  generated_at                  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_audit_conf_user_month
  ON audit_conformite_reports (user_id, month_year DESC);

COMMENT ON TABLE audit_conformite_reports IS
  'Rapport mensuel "Bouclier Conformité" (upsell). Score global pondéré + missions à risque listées en JSONB. 1 rapport par user par mois.';

-- ============================================
-- 7. observatoire_local_reports
-- ============================================
CREATE TABLE IF NOT EXISTS observatoire_local_reports (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  month_year                    text NOT NULL CHECK (month_year ~ '^[0-9]{4}-[0-9]{2}$'),
  zone_slug                     text NOT NULL,

  pdf_url                       text,
  ai_cost_eur                   numeric(10, 6),

  generated_at                  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, month_year, zone_slug)
);

CREATE INDEX IF NOT EXISTS idx_observatoire_user_month
  ON observatoire_local_reports (user_id, month_year DESC);
CREATE INDEX IF NOT EXISTS idx_observatoire_zone
  ON observatoire_local_reports (zone_slug, month_year DESC);

COMMENT ON TABLE observatoire_local_reports IS
  'Rapport mensuel "Observatoire Local" (upsell). Statistiques DPE par zone géographique (commune/dpt/région). 1 rapport par user par mois par zone.';

-- ============================================
-- 8. google_review_replies
-- ============================================
CREATE TABLE IF NOT EXISTS google_review_replies (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ID de l'avis Google Places
  review_id                     text NOT NULL,
  review_rating                 integer CHECK (review_rating BETWEEN 1 AND 5),
  review_text                   text,
  reply_text                    text,

  ai_generated                  boolean NOT NULL DEFAULT true,
  published_at                  timestamptz,
  ai_cost_eur                   numeric(10, 6),

  created_at                    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, review_id)
);

CREATE INDEX IF NOT EXISTS idx_google_review_replies_user
  ON google_review_replies (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_review_replies_published
  ON google_review_replies (published_at)
  WHERE published_at IS NOT NULL;

COMMENT ON TABLE google_review_replies IS
  'Réponses générées par IA aux avis Google Places (upsell Auto-Réponse Avis). 1 ligne par avis traité. UNIQUE(user_id, review_id) pour éviter doublons.';

-- ============================================
-- 9. newsletter_campaigns
-- ============================================
CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  month_year                    text NOT NULL CHECK (month_year ~ '^[0-9]{4}-[0-9]{2}$'),

  brevo_campaign_id             text,
  subject                       text,
  recipients_count              integer,
  open_rate                     numeric(5, 2),
  click_rate                    numeric(5, 2),
  leads_generated               integer NOT NULL DEFAULT 0,

  ai_cost_eur                   numeric(10, 6),
  sent_at                       timestamptz,

  UNIQUE (user_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_user_month
  ON newsletter_campaigns (user_id, month_year DESC);

COMMENT ON TABLE newsletter_campaigns IS
  'Campagnes Newsletter Clients (upsell). 1 campagne par user par mois. Métriques Brevo (open/click) + leads générés (conversion).';

-- ============================================
-- 10. cabinet_reports
-- ============================================
CREATE TABLE IF NOT EXISTS cabinet_reports (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- = organization_id de la table organizations existante
  cabinet_id                    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  month_year                    text NOT NULL CHECK (month_year ~ '^[0-9]{4}-[0-9]{2}$'),

  pdf_url                       text,
  pdf_short_url                 text,

  -- CA, marge, ARPU, cost_per_mission, productivité par diag, etc.
  key_metrics                   jsonb,

  ai_model_used                 text,
  ai_cost_eur                   numeric(10, 6),

  generated_at                  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (cabinet_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_cabinet_reports_cabinet_month
  ON cabinet_reports (cabinet_id, month_year DESC);

COMMENT ON TABLE cabinet_reports IS
  'Rapport mensuel "Cockpit Cabinet" (upsell Cabinet+ exclusif). Métriques business agrégées du cabinet (CA, marge, ARPU, productivité par diag) en JSONB. 1 rapport par cabinet par mois.';

-- ============================================
-- 11. lifetime_deal_purchases
-- ============================================
-- Backing du compteur statique LIFETIME_DEAL dans apps/web/src/lib/pricing-plans.ts.
-- 10 spots max ouverts H1 2026. 1 achat lifetime par user max.
CREATE TABLE IF NOT EXISTS lifetime_deal_purchases (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  stripe_payment_intent_id      text NOT NULL UNIQUE,

  -- Montant en centimes (200 000 = 2 000 €)
  amount_cents                  integer NOT NULL DEFAULT 200000,

  -- Date d'expiration de l'accès Cabinet inclus (3 ans après l'achat)
  cabinet_access_expires_at     timestamptz NOT NULL,

  -- Opt-in pour mention publique sur kovas.fr (témoignage Partenaire Fondateur)
  display_publicly              boolean NOT NULL DEFAULT true,

  purchased_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lifetime_deal_purchased_at
  ON lifetime_deal_purchases (purchased_at DESC);

COMMENT ON TABLE lifetime_deal_purchases IS
  'Backing du compteur "Partenaire Fondateur" (10 spots max H1 2026). 1 achat lifetime par user max. Insertion via webhook Stripe service_role uniquement. Source de vérité pour LIFETIME_DEAL dans pricing-plans.ts.';
COMMENT ON COLUMN lifetime_deal_purchases.cabinet_access_expires_at IS
  'Date d''expiration de l''accès Cabinet inclus (3 ans après purchased_at).';
COMMENT ON COLUMN lifetime_deal_purchases.display_publicly IS
  'Opt-in pour mention publique sur kovas.fr (témoignage Partenaire Fondateur). Default true (incité au moment de l''achat).';

-- ============================================
-- Vue publique : public.lifetime_deal_public_stats
-- ============================================
-- Expose UNIQUEMENT les compteurs agrégés (anonyme). Lisible par anon pour
-- afficher le compteur "X/10 spots restants" sur kovas.fr.
CREATE OR REPLACE VIEW public.lifetime_deal_public_stats
WITH (security_invoker = true) AS
SELECT
  GREATEST(0, 10 - COUNT(*)::int) AS spots_remaining,
  COUNT(*)::int                   AS purchases_count
FROM lifetime_deal_purchases;

COMMENT ON VIEW public.lifetime_deal_public_stats IS
  'Compteurs agrégés Lifetime Deal exposés publiquement (sans PII). Lisible par anon pour afficher "X/10 spots restants" sur kovas.fr. Aucune donnée user-identifiable.';

GRANT SELECT ON public.lifetime_deal_public_stats TO anon, authenticated;

-- ============================================
-- Helper RPC : public.lifetime_deal_spots_remaining()
-- ============================================
CREATE OR REPLACE FUNCTION public.lifetime_deal_spots_remaining()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT GREATEST(0, 10 - COUNT(*)::int)
  FROM lifetime_deal_purchases;
$$;

REVOKE EXECUTE ON FUNCTION public.lifetime_deal_spots_remaining() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lifetime_deal_spots_remaining() TO authenticated, service_role;

COMMENT ON FUNCTION public.lifetime_deal_spots_remaining() IS
  'Retourne le nombre de spots Lifetime Deal restants sur 10. SECURITY DEFINER pour contourner RLS de lifetime_deal_purchases. Restreint à authenticated + service_role (anon utilise la vue publique).';

-- ============================================================================
-- RLS — Activation + policies
-- ============================================================================

-- ============================================
-- RLS — tunnel_signup_state (1 ligne par user, self-service)
-- ============================================
ALTER TABLE tunnel_signup_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own tunnel_signup_state" ON tunnel_signup_state;
CREATE POLICY "users read own tunnel_signup_state"
  ON tunnel_signup_state FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users insert own tunnel_signup_state" ON tunnel_signup_state;
CREATE POLICY "users insert own tunnel_signup_state"
  ON tunnel_signup_state FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users update own tunnel_signup_state" ON tunnel_signup_state;
CREATE POLICY "users update own tunnel_signup_state"
  ON tunnel_signup_state FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- RLS — user_addon_subscriptions
-- (INSERT/UPDATE/DELETE réservés au service_role via webhook Stripe)
-- ============================================
ALTER TABLE user_addon_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own addon_subscriptions" ON user_addon_subscriptions;
CREATE POLICY "users read own addon_subscriptions"
  ON user_addon_subscriptions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================
-- RLS — audit_retroactif_reports
-- (Insertion via worker IA en service_role uniquement)
-- ============================================
ALTER TABLE audit_retroactif_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own audit_retroactif" ON audit_retroactif_reports;
CREATE POLICY "users read own audit_retroactif"
  ON audit_retroactif_reports FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================
-- RLS — premium_reports_generated
-- (Insertion via Edge Function en service_role)
-- ============================================
ALTER TABLE premium_reports_generated ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own premium_reports" ON premium_reports_generated;
CREATE POLICY "users read own premium_reports"
  ON premium_reports_generated FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users update own premium_reports" ON premium_reports_generated;
CREATE POLICY "users update own premium_reports"
  ON premium_reports_generated FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- RLS — automated_email_sequences
-- (Insertion + traitement via cron service_role uniquement)
-- ============================================
ALTER TABLE automated_email_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own email_sequences" ON automated_email_sequences;
CREATE POLICY "users read own email_sequences"
  ON automated_email_sequences FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================
-- RLS — audit_conformite_reports
-- ============================================
ALTER TABLE audit_conformite_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own audit_conformite" ON audit_conformite_reports;
CREATE POLICY "users read own audit_conformite"
  ON audit_conformite_reports FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================
-- RLS — observatoire_local_reports
-- ============================================
ALTER TABLE observatoire_local_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own observatoire_local" ON observatoire_local_reports;
CREATE POLICY "users read own observatoire_local"
  ON observatoire_local_reports FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================
-- RLS — google_review_replies
-- (UPDATE/INSERT autorisés au user pour édition manuelle de la réponse IA avant publication)
-- ============================================
ALTER TABLE google_review_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own google_review_replies" ON google_review_replies;
CREATE POLICY "users read own google_review_replies"
  ON google_review_replies FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users update own google_review_replies" ON google_review_replies;
CREATE POLICY "users update own google_review_replies"
  ON google_review_replies FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- RLS — newsletter_campaigns
-- ============================================
ALTER TABLE newsletter_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own newsletter_campaigns" ON newsletter_campaigns;
CREATE POLICY "users read own newsletter_campaigns"
  ON newsletter_campaigns FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================
-- RLS — cabinet_reports (multi-tenant via is_member_of)
-- ============================================
ALTER TABLE cabinet_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read cabinet_reports" ON cabinet_reports;
CREATE POLICY "members read cabinet_reports"
  ON cabinet_reports FOR SELECT TO authenticated
  USING (public.is_member_of(cabinet_id));

-- ============================================
-- RLS — lifetime_deal_purchases
-- (SELECT propre user uniquement ; INSERT/UPDATE/DELETE service_role via webhook Stripe)
-- (Le compteur public passe par la vue lifetime_deal_public_stats agrégée)
-- ============================================
ALTER TABLE lifetime_deal_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own lifetime_deal" ON lifetime_deal_purchases;
CREATE POLICY "users read own lifetime_deal"
  ON lifetime_deal_purchases FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================
-- Trigger updated_at pour tunnel_signup_state
-- ============================================
CREATE OR REPLACE FUNCTION public.tunnel_signup_state_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tunnel_signup_state_set_updated_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tunnel_signup_state_set_updated_at() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_tunnel_signup_state_updated_at ON tunnel_signup_state;
CREATE TRIGGER trg_tunnel_signup_state_updated_at
  BEFORE UPDATE ON tunnel_signup_state
  FOR EACH ROW
  EXECUTE FUNCTION public.tunnel_signup_state_set_updated_at();

COMMENT ON FUNCTION public.tunnel_signup_state_set_updated_at() IS
  'Trigger BEFORE UPDATE pour maintenir updated_at sur tunnel_signup_state. SECURITY DEFINER + search_path pin.';
