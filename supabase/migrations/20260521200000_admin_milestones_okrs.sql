-- ============================================
-- KOVAS — Admin Paliers / OKRs / Roadmap (itération 9/N)
-- Date : 2026-05-21
-- Cf. CLAUDE.md §22 / prompt itération 9
--
-- Ajoute :
--   1. milestones      : paliers atteints + cibles (MRR, users, missions, etc.)
--   2. okrs            : objectifs trimestriels + key results JSON
--   3. roadmap_items   : feature roadmap V2/V3 (planned/in_progress/shipped)
--
-- RLS : `public.is_admin(auth.uid())` sur les 3 tables (toutes opérations).
-- Seed initial : 14 milestones canoniques (KOVAS roadmap CLAUDE.md sec 7).
-- ============================================

-- 1. milestones — paliers business / produit
CREATE TABLE IF NOT EXISTS milestones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category        text NOT NULL CHECK (category IN ('mrr', 'users', 'missions', 'product', 'business', 'tech')),
  name            text NOT NULL,
  description     text,
  target_value    numeric NOT NULL,
  unit            text,
  current_value   numeric DEFAULT 0,
  achieved        boolean NOT NULL DEFAULT false,
  achieved_at     timestamptz,
  -- Affichage
  icon            text,
  display_order   int DEFAULT 0,
  -- Tracking
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_milestones_achieved
  ON milestones (achieved, display_order);

-- 2. okrs — objectifs trimestriels
CREATE TABLE IF NOT EXISTS okrs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quarter         text NOT NULL,  -- ex '2026-Q4', '2027-Q1'
  objective       text NOT NULL,
  -- key_results : array d'objets { name, target, current, unit }
  key_results     jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Progress moyen calculé côté app (0-1)
  progress        numeric,
  -- Lifecycle
  status          text NOT NULL CHECK (status IN ('draft', 'active', 'completed', 'cancelled')) DEFAULT 'draft',
  started_at      timestamptz,
  completed_at    timestamptz,
  -- Tracking
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_okrs_quarter_status
  ON okrs (quarter, status);

-- 3. roadmap_items — features prévues / livrées
CREATE TABLE IF NOT EXISTS roadmap_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  category        text CHECK (category IN ('feature', 'bug', 'tech_debt', 'ux', 'business')),
  status          text NOT NULL CHECK (status IN ('planned', 'in_progress', 'completed', 'shipped', 'cancelled')) DEFAULT 'planned',
  priority        int DEFAULT 0,
  target_version  text,        -- 'V1', 'V1.5', 'V2', 'Phase 2', etc.
  estimated_days  int,
  -- Tracking
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  shipped_at      timestamptz,
  created_by      uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_roadmap_status_priority
  ON roadmap_items (status, priority DESC);

-- RLS — toutes opérations réservées admins
ALTER TABLE milestones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE okrs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_items   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "milestones_all" ON milestones;
CREATE POLICY "milestones_all" ON milestones
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "okrs_all" ON okrs;
CREATE POLICY "okrs_all" ON okrs
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "roadmap_all" ON roadmap_items;
CREATE POLICY "roadmap_all" ON roadmap_items
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Seed initial — 14 milestones canoniques (KOVAS roadmap CLAUDE.md §7)
-- ON CONFLICT DO NOTHING via WHERE NOT EXISTS (PK uuid auto → on filtre par name).
INSERT INTO milestones (category, name, description, target_value, unit, icon, display_order)
SELECT * FROM (VALUES
  ('mrr',       'MRR 1k€',             'Premier palier économique',       1000::numeric,  '€',           '💰', 1),
  ('mrr',       'MRR 5k€',             'Validation marché',               5000::numeric,  '€',           '💰', 2),
  ('mrr',       'MRR 10k€',            'Sortir du startup',               10000::numeric, '€',           '💰', 3),
  ('mrr',       'MRR 25k€',            '300k€ ARR',                       25000::numeric, '€',           '💰', 4),
  ('mrr',       'ARR 1M€',             'Objectif M24',                    83333::numeric, '€',           '🎯', 5),
  ('users',     '50 bêta-testeurs',    'Founders M6-M9',                  50::numeric,    'users',       '👥', 10),
  ('users',     '100 payants',         'Premier 100',                     100::numeric,   'users',       '👥', 11),
  ('users',     '500 payants',         'Croissance M12',                  500::numeric,   'users',       '👥', 12),
  ('users',     '2000 payants',        'Cible M24',                       2000::numeric,  'users',       '👥', 13),
  ('missions',  '1000 missions/mois',  'Volume validation',               1000::numeric,  'missions',    '📊', 20),
  ('missions',  '10k missions cumulées','Maturité produit',               10000::numeric, 'missions',    '📊', 21),
  ('product',   '8 diagnostics V1',    '92% volume FR',                   8::numeric,     'diagnostics', '✅', 30),
  ('business',  'Premier client cabinet','Phase 2 validée',               1::numeric,     'cabinet',     '🏢', 40),
  ('tech',      'Marge brute > 85%',   'Optims IA Phase 2',               0.85::numeric,  '%',           '📈', 50)
) AS v(category, name, description, target_value, unit, icon, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM milestones m WHERE m.name = v.name
);
