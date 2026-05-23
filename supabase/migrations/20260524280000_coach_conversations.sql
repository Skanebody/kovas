-- ============================================================
-- KOVAS — Coach IA (assistant conversationnel personnel)
--
-- 3 tables :
--   - coach_conversations : 1 fil par session de chat utilisateur
--   - coach_messages       : messages user/assistant/system
--   - coach_recommendations: recos IA extraites des conversations
--                             (proposées au tableau de bord)
--
-- Sécurité : RLS strict — chaque utilisateur ne voit QUE
-- ses propres conversations / messages / recos.
--
-- Modèle utilisé : claude-haiku-4-5 (chat, default).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coach_conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_conv_user_updated
  ON public.coach_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.coach_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.coach_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         text NOT NULL,
  tokens_in       integer,
  tokens_out      integer,
  model           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_messages_conv
  ON public.coach_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS public.coach_recommendations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_conversation_id uuid REFERENCES public.coach_conversations(id) ON DELETE SET NULL,
  title                  text NOT NULL,
  summary                text,
  action_url             text,                -- ex /dashboard/dossiers/new
  status                 text NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'resolved', 'ignored', 'expired')),
  priority               integer NOT NULL DEFAULT 5,
  expires_at             timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  resolved_at            timestamptz
);

CREATE INDEX IF NOT EXISTS idx_coach_reco_user_status
  ON public.coach_recommendations(user_id, status, created_at DESC);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.coach_conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_recommendations  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_conv_owner ON public.coach_conversations;
CREATE POLICY coach_conv_owner ON public.coach_conversations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS coach_msg_owner ON public.coach_messages;
CREATE POLICY coach_msg_owner ON public.coach_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.coach_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS coach_reco_owner ON public.coach_recommendations;
CREATE POLICY coach_reco_owner ON public.coach_recommendations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Trigger updated_at sur coach_conversations
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_coach_conversation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coach_conv_updated_at ON public.coach_conversations;
CREATE TRIGGER trg_coach_conv_updated_at
  BEFORE UPDATE ON public.coach_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_coach_conversation_updated_at();

COMMENT ON TABLE public.coach_conversations IS
  'Coach IA — sessions de chat utilisateur (1 ligne par fil)';
COMMENT ON TABLE public.coach_messages IS
  'Coach IA — messages individuels (role : user / assistant / system)';
COMMENT ON TABLE public.coach_recommendations IS
  'Coach IA — recommandations actionnables extraites des conversations';
