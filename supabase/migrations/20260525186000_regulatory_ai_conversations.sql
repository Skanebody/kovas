-- ============================================
-- KOVAS App — Module 8 : Conversations IA (chatbot RAG sur la veille)
-- Date : 2026-05-25
-- L'utilisateur pose une question métier ; Claude répond en s'appuyant sur le RAG
-- (regulatory_documents.embedding). Stocké pour audit + amélioration continue.
-- ============================================

CREATE TABLE regulatory_ai_conversations (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id            uuid NOT NULL, -- groupe les messages d'une même conversation
  -- Rôle du message dans la conversation.
  role                  text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content               text NOT NULL,
  -- RAG : documents cités dans la réponse de l'assistant.
  cited_document_ids    uuid[] DEFAULT '{}',
  -- Retrieval params (debug / amélioration).
  retrieval_query       text,
  retrieval_top_k       int,
  retrieval_scores      numeric[] DEFAULT '{}',
  -- Coût / latence (côté assistant uniquement).
  ai_provider           text,    -- 'anthropic'
  ai_model              text,    -- 'claude-haiku-4-5' / 'claude-sonnet-4-6'
  input_tokens          int,
  output_tokens         int,
  cached_tokens         int,
  cost_eur              numeric(10,6),
  latency_ms            int,
  -- Feedback utilisateur (apprentissage).
  user_feedback         smallint CHECK (user_feedback IN (-1, 1)),
  feedback_note         text,
  -- Métadonnées libres (feature flags, contexte mission, etc.).
  metadata              jsonb DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reg_ai_conv_session ON regulatory_ai_conversations (user_id, session_id, created_at);
CREATE INDEX idx_reg_ai_conv_org ON regulatory_ai_conversations (organization_id, created_at DESC);
CREATE INDEX idx_reg_ai_conv_feedback ON regulatory_ai_conversations (user_feedback, created_at DESC)
  WHERE user_feedback IS NOT NULL;
CREATE INDEX idx_reg_ai_conv_cited ON regulatory_ai_conversations USING gin (cited_document_ids);

COMMENT ON TABLE regulatory_ai_conversations IS
  'Conversations chatbot RAG (questions réglementaires). Audit + amélioration RAG. Scope organization_id.';

-- ============================================
-- RLS
-- ============================================
ALTER TABLE regulatory_ai_conversations ENABLE ROW LEVEL SECURITY;

-- SELECT : membres de l'org (l'audit reste cabinet-scoped).
CREATE POLICY "reg_ai_conv_member_read"
  ON regulatory_ai_conversations FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

-- INSERT : l'utilisateur insère ses propres messages 'user' ; le worker (service_role)
-- insère les 'assistant' / 'system' / 'tool'.
CREATE POLICY "reg_ai_conv_user_insert"
  ON regulatory_ai_conversations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_member_of(organization_id)
  );

-- UPDATE : seulement le feedback utilisateur sur ses propres messages.
CREATE POLICY "reg_ai_conv_user_update_feedback"
  ON regulatory_ai_conversations FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND public.is_member_of(organization_id))
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_member_of(organization_id));

-- ============================================
-- FIN MIGRATION regulatory_ai_conversations
-- ============================================
