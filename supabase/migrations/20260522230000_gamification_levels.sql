-- ============================================
-- KOVAS — Système de progression 7 niveaux (gamification SOBRE PRO)
-- Cf. CLAUDE.md §21bis Gain Tracker + docs/avatar-client.md
--
-- Format diplôme professionnel : Utilisateur Pro · Confirmé · Sénior ·
-- Premium · Ambassadeur · Fidèle · Expert.
--
-- AUCUN avantage tarifaire — uniquement reconnaissance de l'engagement.
-- ============================================

-- ============================================
-- user_progression : état courant calculé
-- ============================================
CREATE TABLE IF NOT EXISTS user_progression (
  user_id                       uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_level                 int NOT NULL DEFAULT 1 CHECK (current_level BETWEEN 1 AND 7),
  current_level_unlocked_at     timestamptz NOT NULL DEFAULT now(),
  total_missions                int NOT NULL DEFAULT 0,
  total_referrals_paid          int NOT NULL DEFAULT 0,
  subscription_age_days         int NOT NULL DEFAULT 0,
  ademe_export_score            numeric(4,3), -- 0..1 (NULL si pas encore mesuré)
  last_recomputed_at            timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- user_level_history : journal des déblocages
-- ============================================
CREATE TABLE IF NOT EXISTS user_level_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_level  int NOT NULL CHECK (from_level BETWEEN 1 AND 7),
  to_level    int NOT NULL CHECK (to_level BETWEEN 1 AND 7),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  reason      text, -- ex: "Atteint 10 missions", "6 mois d'usage continu"
  CHECK (to_level > from_level)
);

CREATE INDEX IF NOT EXISTS idx_user_level_history_user
  ON user_level_history (user_id, unlocked_at DESC);

-- ============================================
-- RLS — lecture par le propriétaire uniquement
-- ============================================
ALTER TABLE user_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_level_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_progression: owner read" ON user_progression;
CREATE POLICY "user_progression: owner read"
  ON user_progression FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_level_history: owner read" ON user_level_history;
CREATE POLICY "user_level_history: owner read"
  ON user_level_history FOR SELECT
  USING (user_id = auth.uid());

COMMENT ON TABLE user_progression IS 'Niveau professionnel courant (1..7). Recalculé au login + après chaque mission complétée + cron hebdo.';
COMMENT ON TABLE user_level_history IS 'Journal des déblocages successifs (audit + page progression).';
