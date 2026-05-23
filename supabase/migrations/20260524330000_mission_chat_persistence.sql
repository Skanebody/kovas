-- ============================================================================
-- KOVAS — Mode mission tchat IA : persistence conversation + captures (FIX-MM)
-- ============================================================================
-- Refonte du mode mission tchat avec IA conversationnelle Claude Haiku.
-- Stocke chaque échange utilisateur/assistant et les données structurées
-- capturées au fil de la conversation (pièces, équipements, observations,
-- photos, mesures) parsées depuis les blocs [CAPTURE: ...] générés par
-- l'IA en fin de réponse.
--
-- Authority : CLAUDE.md §3 features 1 (saisie vocale terrain) + 10 (offline).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. mission_chat_messages : un message par échange
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mission_chat_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL REFERENCES mission_sessions(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content          text NOT NULL,
  content_markdown text,
  metadata         jsonb,
  tokens_in        int,
  tokens_out       int,
  model            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcm_session
  ON mission_chat_messages (session_id, created_at);

COMMENT ON TABLE mission_chat_messages IS
  'Tchat IA mode mission : historique conversationnel par session + tokens + model + metadata captures/photos/suggestions. Cf. CLAUDE.md §3.';

ALTER TABLE mission_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mcm_own ON mission_chat_messages;
CREATE POLICY mcm_own ON mission_chat_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mission_sessions ms
      WHERE ms.id = mission_chat_messages.session_id
        AND public.is_member_of(ms.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mission_sessions ms
      WHERE ms.id = mission_chat_messages.session_id
        AND public.is_member_of(ms.organization_id)
    )
  );

-- ----------------------------------------------------------------------------
-- B. mission_session_captures : données structurées extraites de l'IA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mission_session_captures (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         uuid NOT NULL REFERENCES mission_sessions(id) ON DELETE CASCADE,
  capture_type       text NOT NULL CHECK (capture_type IN (
    'room', 'equipment', 'observation', 'photo_taken', 'measurement'
  )),
  data               jsonb NOT NULL,
  source_message_id  uuid REFERENCES mission_chat_messages(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msc_session_type
  ON mission_session_captures (session_id, capture_type);

COMMENT ON TABLE mission_session_captures IS
  'Tchat IA mode mission : captures structurées extraites des blocs [CAPTURE: type=... ...] générés par Claude en fin de réponse. Source = ligne markdown parsée côté serveur. Cf. CLAUDE.md §3.';

ALTER TABLE mission_session_captures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS msc_own ON mission_session_captures;
CREATE POLICY msc_own ON mission_session_captures
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mission_sessions ms
      WHERE ms.id = mission_session_captures.session_id
        AND public.is_member_of(ms.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mission_sessions ms
      WHERE ms.id = mission_session_captures.session_id
        AND public.is_member_of(ms.organization_id)
    )
  );

-- ----------------------------------------------------------------------------
-- C. captured_data jsonb cumulatif sur mission_sessions (compat existant)
-- ----------------------------------------------------------------------------
-- Colonne miroir agrégée pour reprise rapide côté UI sans rejoin captures.
ALTER TABLE mission_sessions
  ADD COLUMN IF NOT EXISTS captured_data jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN mission_sessions.captured_data IS
  'Tchat IA : snapshot cumulé des captures de la session (rooms[], equipment[], observations[], photos[], measurements[]). MAJ à chaque INSERT dans mission_session_captures via trigger.';
