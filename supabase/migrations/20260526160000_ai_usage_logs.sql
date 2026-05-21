-- ============================================
-- KOVAS — AI usage logs (tracking détaillé Claude/Whisper/Deepgram/Embeddings)
-- ============================================
-- 1 ligne par appel IA (chatbot, voice transcription, vision, embeddings...).
-- Centralise tokens + coût pour :
--   1. Dashboard admin (€/jour, top-N orgs cost)
--   2. Suivi marge brute IA (CLAUDE.md §7bis)
--   3. Audit RGPD / debugging (relation table+id)
--   4. Détection abus (latence, retry, cost spikes)
--
-- Coût calculé côté worker (Edge Function ai-usage-tracker) selon la grille
-- tarifaire Anthropic + OpenAI + Deepgram, multiplié par USD_TO_EUR_RATE.
--
-- RLS :
--   - SELECT : membres org (lecture transparence usage personnel)
--   - INSERT : service_role uniquement (Edge Function)
--   - UPDATE/DELETE : interdit (audit immuable)
-- ============================================

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Classification
  feature             text NOT NULL,
  -- Ex : 'voice_transcribe' | 'voice_structure' | 'vision_photo_classify'
  --    | 'chatbot_methodo'  | 'document_extract' | 'consolidation'
  --    | 'embeddings'       | 'inbound_email_extract' | 'community_anonymize'
  --    | 'regulatory_chat'  | 'parameter_suggest'
  provider            text NOT NULL CHECK (provider IN ('anthropic','openai','deepgram')),
  model_used          text NOT NULL,
  -- Ex Anthropic : 'claude-haiku-4-5' | 'claude-sonnet-4-6' | 'claude-opus-4-7'
  -- Ex OpenAI : 'gpt-4o-mini-transcribe' | 'text-embedding-3-small'
  -- Ex Deepgram : 'nova-3'

  -- Tokens (Anthropic/OpenAI text)
  input_tokens                int NOT NULL DEFAULT 0,
  output_tokens               int NOT NULL DEFAULT 0,
  cached_input_tokens         int NOT NULL DEFAULT 0,
  cache_write_tokens          int NOT NULL DEFAULT 0,

  -- Audio (Whisper/Deepgram)
  audio_minutes               numeric(8,3),

  -- Coût (cents EUR pour intégration centimes integer CLAUDE.md §10)
  estimated_cost_eur_cents    int NOT NULL DEFAULT 0,

  -- Perf
  latency_ms                  int,

  -- Relation source (audit / debug)
  related_table               text,
  related_id                  uuid,

  -- Métadonnées libres (request_id, retry_count, cache_hit_rate...)
  metadata                    jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_usage_logs IS
  'Journal des appels IA (Claude/Whisper/Deepgram/Embeddings). Coût en centimes EUR. Audit immuable (pas d''UPDATE/DELETE policy).';
COMMENT ON COLUMN public.ai_usage_logs.estimated_cost_eur_cents IS
  'Centimes EUR (intent : intégration directe avec compteurs cost dans subscriptions / org).';

CREATE INDEX IF NOT EXISTS idx_ai_logs_org_created
  ON public.ai_usage_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_logs_feature_created
  ON public.ai_usage_logs (feature, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_logs_provider_model
  ON public.ai_usage_logs (provider, model_used, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_logs_related
  ON public.ai_usage_logs (related_table, related_id)
  WHERE related_table IS NOT NULL AND related_id IS NOT NULL;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_logs: org members read" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs: org members read"
  ON public.ai_usage_logs FOR SELECT
  USING (public.is_member_of(organization_id));

-- INSERT exclusivement via service_role (worker Edge Function ai-usage-tracker).
-- Audit immuable : pas de policy UPDATE/DELETE (bloqué pour tout sauf bypass).
