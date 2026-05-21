-- ============================================
-- KOVAS App — Module 7 : Votes et réponses sur les cas communautaires
-- Date : 2026-05-25
-- ============================================

-- ============================================
-- 1. community_case_votes — upvote/downvote (1 vote par user et par cas)
-- ============================================
CREATE TABLE community_case_votes (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id     uuid NOT NULL REFERENCES community_cases(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value       smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, user_id)
);

CREATE INDEX idx_community_votes_case ON community_case_votes (case_id);
CREATE INDEX idx_community_votes_user ON community_case_votes (user_id);

COMMENT ON TABLE community_case_votes IS
  'Vote (+1 / -1) d''un user sur un cas approuvé du référentiel partagé. Unique par (case, user).';

CREATE TRIGGER trg_community_votes_updated BEFORE UPDATE ON community_case_votes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 2. community_case_responses — réponses / commentaires métier
-- ============================================
CREATE TABLE community_case_responses (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         uuid NOT NULL REFERENCES community_cases(id) ON DELETE CASCADE,
  author_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body            text NOT NULL,
  status          text NOT NULL DEFAULT 'published'
    CHECK (status IN ('published','flagged','hidden','deleted')),
  upvotes_count   int NOT NULL DEFAULT 0,
  downvotes_count int NOT NULL DEFAULT 0,
  moderation_notes text,
  moderated_by    uuid REFERENCES auth.users(id),
  moderated_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_community_responses_case ON community_case_responses (case_id, created_at DESC);
CREATE INDEX idx_community_responses_author ON community_case_responses (author_user_id);
CREATE INDEX idx_community_responses_status ON community_case_responses (status);

COMMENT ON TABLE community_case_responses IS
  'Réponses métier publiques sur un cas approuvé. Statut par défaut "published"; admin peut "flagged"/"hidden".';

CREATE TRIGGER trg_community_responses_updated BEFORE UPDATE ON community_case_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 3. RLS — votes
-- ============================================
ALTER TABLE community_case_votes ENABLE ROW LEVEL SECURITY;

-- SELECT public uniquement sur cas approuvé.
CREATE POLICY "community_votes_public_read"
  ON community_case_votes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM community_cases c
    WHERE c.id = case_id AND c.status = 'approved'
  ));

-- INSERT : tout user authentifié sur cas approuvé, et vote en son nom.
CREATE POLICY "community_votes_insert_self"
  ON community_case_votes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM community_cases c
      WHERE c.id = case_id AND c.status = 'approved'
    )
  );

-- UPDATE : seulement son propre vote (changer +1 -> -1 par exemple).
CREATE POLICY "community_votes_update_self"
  ON community_case_votes FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- DELETE : son propre vote.
CREATE POLICY "community_votes_delete_self"
  ON community_case_votes FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================
-- 4. RLS — réponses
-- ============================================
ALTER TABLE community_case_responses ENABLE ROW LEVEL SECURITY;

-- SELECT public : réponses 'published' sur cas 'approved'.
CREATE POLICY "community_responses_public_read"
  ON community_case_responses FOR SELECT TO authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM community_cases c
      WHERE c.id = case_id AND c.status = 'approved'
    )
  );

-- Author : peut toujours lire ses propres réponses (même flagged/hidden).
CREATE POLICY "community_responses_author_read_own"
  ON community_case_responses FOR SELECT TO authenticated
  USING (author_user_id = (SELECT auth.uid()));

-- Admin : tout voir.
CREATE POLICY "community_responses_admin_read_all"
  ON community_case_responses FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

-- INSERT : tout user authentifié sur cas approuvé.
CREATE POLICY "community_responses_insert"
  ON community_case_responses FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM community_cases c
      WHERE c.id = case_id AND c.status = 'approved'
    )
  );

-- UPDATE auteur : son propre contenu si encore 'published'.
CREATE POLICY "community_responses_update_self"
  ON community_case_responses FOR UPDATE TO authenticated
  USING (author_user_id = (SELECT auth.uid()) AND status = 'published')
  WITH CHECK (author_user_id = (SELECT auth.uid()) AND status = 'published');

-- UPDATE admin : modération.
CREATE POLICY "community_responses_admin_update"
  ON community_case_responses FOR UPDATE TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

-- ============================================
-- FIN MIGRATION community_votes_responses
-- ============================================
