-- ============================================
-- KOVAS App — Module 7 : Référentiel partagé (Communauté)
-- Date : 2026-05-25
-- Cas anonymisés publiés globalement (pas de organization_id, l'org est expurgée).
-- L'anonymisation effective sera assurée par une Edge Function dédiée — ici on installe
-- un stub `anonymize_community_case` à brancher plus tard via trigger BEFORE INSERT.
-- ============================================

-- ============================================
-- 1. community_cases — référentiel public de cas (anonymisés)
-- ============================================
CREATE TABLE community_cases (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Auteur conservé (modération / contestation) — JAMAIS exposé en SELECT public.
  author_user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Métadonnées descriptives (non identifiantes).
  title                 text NOT NULL,
  building_type         text, -- 'maison' | 'appartement' | 'immeuble' | 'local_commercial' | 'bureau' | 'autre'
  year_built_range      text, -- '<1949' | '1949-1974' | '1975-1990' | '1991-2005' | '>2005'
  surface_range         text, -- '<50' | '50-80' | '80-120' | '120-200' | '>200' (m²)
  diagnostic_kinds      text[] DEFAULT '{}', -- ['dpe','amiante',...]
  region_anonymised     text, -- ex. 'Hauts-de-France', JAMAIS le code postal exact
  -- Contenu du cas (texte rédigé par l'auteur PUIS anonymisé par Edge Function).
  context_description   text NOT NULL,
  question              text NOT NULL,
  decision_made         text,
  justification         text,
  -- Modération.
  status                text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','archived')),
  moderation_notes      text,
  moderated_by          uuid REFERENCES auth.users(id),
  moderated_at          timestamptz,
  -- Statistiques (dénormalisées par triggers ailleurs).
  upvotes_count         int NOT NULL DEFAULT 0,
  downvotes_count       int NOT NULL DEFAULT 0,
  responses_count       int NOT NULL DEFAULT 0,
  views_count           int NOT NULL DEFAULT 0,
  -- Tags libres (regroupés admin pour faciliter la recherche).
  tags                  text[] DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_community_cases_status ON community_cases (status);
CREATE INDEX idx_community_cases_building_type ON community_cases (building_type)
  WHERE status = 'approved';
CREATE INDEX idx_community_cases_created ON community_cases (created_at DESC)
  WHERE status = 'approved';
CREATE INDEX idx_community_cases_tags ON community_cases USING gin (tags)
  WHERE status = 'approved';
CREATE INDEX idx_community_cases_author ON community_cases (author_user_id);

COMMENT ON TABLE community_cases IS
  'Référentiel partagé de cas anonymisés. Visibles publiquement (authentifiés) UNIQUEMENT après approbation modération. Anonymisation Edge Function avant publication.';

-- ============================================
-- 2. Anonymisation : stub V1 + trigger commenté (à activer Edge Function)
-- ============================================
-- TODO Edge Function : appeler `anonymize_community_case_text` côté worker AVANT INSERT
-- pour expurger noms, adresses, numéros (NER + regex). En V1 on garde le passe-plat.
CREATE OR REPLACE FUNCTION public.anonymize_community_case(
  p_context text,
  p_question text,
  p_decision text,
  p_justification text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RAISE NOTICE 'anonymize_community_case stub V1 : aucune transformation appliquée (Edge Function attendue).';
  RETURN jsonb_build_object(
    'context_description', p_context,
    'question',            p_question,
    'decision_made',       p_decision,
    'justification',       p_justification
  );
END $$;

COMMENT ON FUNCTION public.anonymize_community_case(text, text, text, text) IS
  'Stub V1 : retourne les textes inchangés. À remplacer par Edge Function NER + regex avant publication.';

-- TODO V1+ : décommenter ce trigger lorsque l'Edge Function d'anonymisation sera prête.
-- CREATE OR REPLACE FUNCTION public.trg_community_cases_anonymise()
-- RETURNS trigger LANGUAGE plpgsql AS $$
-- DECLARE
--   v_payload jsonb;
-- BEGIN
--   v_payload := public.anonymize_community_case(
--     NEW.context_description,
--     NEW.question,
--     NEW.decision_made,
--     NEW.justification
--   );
--   NEW.context_description := v_payload->>'context_description';
--   NEW.question             := v_payload->>'question';
--   NEW.decision_made        := v_payload->>'decision_made';
--   NEW.justification        := v_payload->>'justification';
--   RETURN NEW;
-- END $$;
-- CREATE TRIGGER trg_community_cases_anonymise_before_insert
--   BEFORE INSERT ON community_cases
--   FOR EACH ROW EXECUTE FUNCTION public.trg_community_cases_anonymise();

-- ============================================
-- 3. updated_at trigger
-- ============================================
CREATE TRIGGER trg_community_cases_updated BEFORE UPDATE ON community_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 4. RLS
-- ============================================
ALTER TABLE community_cases ENABLE ROW LEVEL SECURITY;

-- SELECT public (tout authentifié) UNIQUEMENT pour les cas approuvés.
CREATE POLICY "community_cases_public_read_approved"
  ON community_cases FOR SELECT TO authenticated
  USING (status = 'approved');

-- L'auteur peut lire ses propres cas quel que soit le status (suivi modération).
CREATE POLICY "community_cases_author_read_own"
  ON community_cases FOR SELECT TO authenticated
  USING (author_user_id = (SELECT auth.uid()));

-- Admin peut tout lire (modération).
CREATE POLICY "community_cases_admin_read_all"
  ON community_cases FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

-- INSERT : user authentifié = auteur (status forcé 'pending' côté API/Edge Function).
CREATE POLICY "community_cases_author_insert"
  ON community_cases FOR INSERT TO authenticated
  WITH CHECK (author_user_id = (SELECT auth.uid()));

-- UPDATE auteur : limité aux brouillons 'pending' (pas après modération).
CREATE POLICY "community_cases_author_update_pending"
  ON community_cases FOR UPDATE TO authenticated
  USING (author_user_id = (SELECT auth.uid()) AND status = 'pending')
  WITH CHECK (author_user_id = (SELECT auth.uid()) AND status = 'pending');

-- UPDATE admin : modération.
CREATE POLICY "community_cases_admin_update"
  ON community_cases FOR UPDATE TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

-- ============================================
-- FIN MIGRATION community_cases
-- ============================================
