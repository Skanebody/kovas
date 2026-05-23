-- ============================================================================
-- Veille Articles Draft — Pipeline IA d'articles SEO Amandine Bart
-- ============================================================================
-- Objectif : génération automatisée (Claude Haiku cron hebdo) d'articles
-- d'actualité réglementaire diagnostic immobilier (1500-3000 mots, méthode
-- Amandine Bart) avec scoring E-E-A-T et validation admin avant publication.
--
-- Distincte de la veille réglementaire existante (`regulatory_documents`),
-- qui aggrège des sources externes (Légifrance, ADEME) résumées par IA.
-- Ici on génère des articles éditoriaux longs orientés SEO Amandine Bart.
--
-- Tables :
--   - veille_articles_draft       : articles IA en attente de validation
--   - veille_articles_published   : vue projetée des articles publiés
--   - veille_keywords_priority    : keywords à cibler (alimente cron)
--
-- Fonctions :
--   - veille_articles_eeat_avg(uuid) : moyenne des 4 axes E-E-A-T
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. Table veille_articles_draft
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.veille_articles_draft (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic                       text NOT NULL,
  target_keyword              text NOT NULL,
  slug                        text UNIQUE NOT NULL,
  title                       text NOT NULL,
  meta_title                  text,
  meta_description            text,
  content_markdown            text NOT NULL,
  excerpt                     text,
  hero_image_url              text,

  -- Métadonnées IA
  ai_model                    text NOT NULL DEFAULT 'claude-haiku-4-5',
  ai_input_tokens             int NOT NULL DEFAULT 0,
  ai_output_tokens            int NOT NULL DEFAULT 0,
  ai_cost_eur                 numeric(8, 4) NOT NULL DEFAULT 0,
  ai_generated_at             timestamptz NOT NULL DEFAULT now(),

  -- Méthode Amandine Bart — scoring E-E-A-T (4 axes 0-100)
  eeat_experience             int NOT NULL DEFAULT 0,
  eeat_expertise              int NOT NULL DEFAULT 0,
  eeat_authoritativeness      int NOT NULL DEFAULT 0,
  eeat_trustworthiness        int NOT NULL DEFAULT 0,
  eeat_score                  int GENERATED ALWAYS AS (
    (eeat_experience + eeat_expertise + eeat_authoritativeness + eeat_trustworthiness) / 4
  ) STORED,

  -- Métriques structurelles méthode Amandine Bart
  word_count                  int NOT NULL DEFAULT 0,
  internal_links_count        int NOT NULL DEFAULT 0,
  source_citations_count      int NOT NULL DEFAULT 0,
  faq_questions_count         int NOT NULL DEFAULT 0,
  h2_count                    int NOT NULL DEFAULT 0,
  h3_count                    int NOT NULL DEFAULT 0,

  -- Workflow validation
  status                      text NOT NULL DEFAULT 'pending_review',
  reviewed_by                 uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at                 timestamptz,
  review_notes                text,
  rejected_reason             text,
  published_at                timestamptz,

  -- Catégorisation
  category                    text NOT NULL DEFAULT 'reglementaire',
  tags                        text[] NOT NULL DEFAULT '{}',

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'veille_articles_draft_status_check'
  ) THEN
    ALTER TABLE public.veille_articles_draft
      ADD CONSTRAINT veille_articles_draft_status_check
      CHECK (status IN ('pending_review', 'approved', 'published', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'veille_articles_draft_category_check'
  ) THEN
    ALTER TABLE public.veille_articles_draft
      ADD CONSTRAINT veille_articles_draft_category_check
      CHECK (category IN ('reglementaire', 'pratique', 'technique', 'marche', 'jurisprudence'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'veille_articles_draft_eeat_check'
  ) THEN
    ALTER TABLE public.veille_articles_draft
      ADD CONSTRAINT veille_articles_draft_eeat_check
      CHECK (
        eeat_experience BETWEEN 0 AND 100
        AND eeat_expertise BETWEEN 0 AND 100
        AND eeat_authoritativeness BETWEEN 0 AND 100
        AND eeat_trustworthiness BETWEEN 0 AND 100
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_veille_articles_draft_status
  ON public.veille_articles_draft (status, eeat_score DESC);
CREATE INDEX IF NOT EXISTS idx_veille_articles_draft_published_at
  ON public.veille_articles_draft (published_at DESC NULLS LAST)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_veille_articles_draft_category
  ON public.veille_articles_draft (category, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_veille_articles_draft_keyword
  ON public.veille_articles_draft (target_keyword);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.veille_articles_draft_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_veille_articles_draft_updated_at ON public.veille_articles_draft;
CREATE TRIGGER trg_veille_articles_draft_updated_at
  BEFORE UPDATE ON public.veille_articles_draft
  FOR EACH ROW
  EXECUTE FUNCTION public.veille_articles_draft_touch_updated_at();

-- ============================================================================
-- 2. Table veille_keywords_priority — liste des keywords à cibler
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.veille_keywords_priority (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword             text UNIQUE NOT NULL,
  topic               text NOT NULL,
  priority            int NOT NULL DEFAULT 50,
  category            text NOT NULL DEFAULT 'reglementaire',
  estimated_volume    int,
  last_generated_at   timestamptz,
  generation_count    int NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_veille_keywords_priority_score
  ON public.veille_keywords_priority (is_active, priority DESC, last_generated_at NULLS FIRST);

-- ============================================================================
-- 3. RLS — lecture publique sur articles publiés, écriture admin only
-- ============================================================================
ALTER TABLE public.veille_articles_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veille_keywords_priority ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS veille_articles_draft_select_published ON public.veille_articles_draft;
CREATE POLICY veille_articles_draft_select_published
  ON public.veille_articles_draft
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS veille_articles_draft_admin_all ON public.veille_articles_draft;
CREATE POLICY veille_articles_draft_admin_all
  ON public.veille_articles_draft
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS veille_keywords_priority_admin_all ON public.veille_keywords_priority;
CREATE POLICY veille_keywords_priority_admin_all
  ON public.veille_keywords_priority
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================================
-- 4. Seed keywords priorité (top 30 Amandine Bart)
-- ============================================================================
INSERT INTO public.veille_keywords_priority (keyword, topic, priority, category, estimated_volume)
VALUES
  ('DPE 2026 nouvelles règles', 'Évolutions réglementaires DPE 2026', 95, 'reglementaire', 8100),
  ('audit énergétique obligatoire 2026', 'Audit énergétique : périmètre élargi 2026', 92, 'reglementaire', 5400),
  ('passoire thermique vente 2026', 'Vente d''une passoire thermique : règles 2026', 90, 'reglementaire', 4400),
  ('diagnostic amiante avant 1997', 'Diagnostic amiante : périmètre, validité, obligations', 85, 'reglementaire', 3600),
  ('CREP plomb obligation location', 'CREP : obligations bailleurs et travaux', 82, 'reglementaire', 2900),
  ('diagnostic gaz validité durée', 'Diagnostic gaz : 15 ans, durée de validité', 80, 'pratique', 3300),
  ('diagnostic électrique tarif moyen', 'Diagnostic électrique : tarifs France 2026', 78, 'pratique', 2700),
  ('loi Carrez calcul surface', 'Loi Carrez : méthode de calcul et pièges', 76, 'technique', 4900),
  ('ERP état des risques pollutions', 'État des risques et pollutions : guide complet', 75, 'reglementaire', 6600),
  ('termites zone arrêté préfectoral', 'Diagnostic termites : zones obligatoires', 72, 'reglementaire', 1800),
  ('DPE collectif copropriété 2026', 'DPE collectif : copropriétés concernées', 88, 'reglementaire', 3100),
  ('décret tertiaire seuil 2026', 'Décret tertiaire : seuils et obligations', 70, 'reglementaire', 2400),
  ('audit énergétique prix 2026', 'Audit énergétique : tarifs et financement', 85, 'pratique', 4100),
  ('DPE opposable jurisprudence', 'DPE opposable : décisions récentes', 78, 'jurisprudence', 1500),
  ('diagnostiqueur certification COFRAC', 'Certification COFRAC : processus et coûts', 65, 'pratique', 1200),
  ('MaPrimeRénov audit énergétique', 'MaPrimeRénov audit : conditions 2026', 88, 'pratique', 5600),
  ('classe énergétique G interdit location', 'Interdiction location G : calendrier 2026', 93, 'reglementaire', 7200),
  ('DPE individuel maison ancienne', 'DPE maison ancienne : méthode 3CL', 75, 'technique', 2200),
  ('diagnostic amiante DTA copropriété', 'DTA copropriété : obligations syndic', 68, 'reglementaire', 1700),
  ('contrôle technique assainissement', 'Diagnostic assainissement non collectif', 62, 'reglementaire', 2100),
  ('diagnostic immobilier vente délai', 'Délais de réalisation des diagnostics avant vente', 80, 'pratique', 3800),
  ('responsabilité civile diagnostiqueur', 'RC pro diagnostiqueur : couverture 2026', 60, 'pratique', 800),
  ('audit énergétique scénarios travaux', 'Audit énergétique : 2 scénarios obligatoires', 78, 'technique', 1900),
  ('DPE neuf construction 2026', 'DPE pour construction neuve : RE2020', 72, 'reglementaire', 2600),
  ('diagnostic mérule obligation', 'Mérule : diagnostic et obligations bailleurs', 55, 'reglementaire', 900),
  ('observatoire DPE ADEME 2026', 'Observatoire DPE ADEME : chiffres clés', 68, 'marche', 1400),
  ('plan pluriannuel travaux PPT', 'PPT copropriété : déclenchement et contenu', 82, 'reglementaire', 3400),
  ('diagnostic radon obligatoire', 'Radon : zones et obligations diagnostic', 58, 'reglementaire', 1100),
  ('attestation Consuel équivalent diagnostic', 'Consuel ou diagnostic électrique : choisir', 65, 'pratique', 1500),
  ('rénovation énergétique éco PTZ', 'Éco-PTZ et rénovation énergétique 2026', 80, 'pratique', 4700)
ON CONFLICT (keyword) DO NOTHING;

-- ============================================================================
-- 5. Helper RPC : sélectionner les N prochains keywords à générer
-- ============================================================================
CREATE OR REPLACE FUNCTION public.veille_articles_pick_next_keywords(limit_count int DEFAULT 2)
RETURNS TABLE (
  id uuid,
  keyword text,
  topic text,
  priority int,
  category text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id, keyword, topic, priority, category
  FROM public.veille_keywords_priority
  WHERE is_active = true
  ORDER BY
    priority DESC,
    last_generated_at NULLS FIRST,
    generation_count ASC
  LIMIT GREATEST(limit_count, 1);
$$;

GRANT EXECUTE ON FUNCTION public.veille_articles_pick_next_keywords(int) TO service_role;

-- ============================================================================
-- COMMIT
-- ============================================================================
COMMENT ON TABLE public.veille_articles_draft IS
  'Articles SEO IA méthode Amandine Bart générés par cron hebdo. Workflow : pending_review → approved → published. Distinct de regulatory_documents (résumés sources externes).';

COMMENT ON TABLE public.veille_keywords_priority IS
  'Liste de keywords à cibler pour la génération automatique d''articles SEO Amandine Bart.';
