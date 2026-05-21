-- ============================================
-- KOVAS App — Module 8 : RPC RAG (recherche sémantique + full-text)
-- Date : 2026-05-25
--
-- Deux fonctions PL/pgSQL appelées par l'Edge Function `regulatory-ai-chat`
-- et le helper Node `apps/web/src/lib/regulatory/rag-search.ts`.
--
--   1. match_regulatory_documents(query_embedding, threshold, count)
--      → top-K documents réglementaires via similarité cosinus (pgvector)
--      → filtre : processed_at IS NOT NULL AND is_superseded = false
--                AND embedding IS NOT NULL
--
--   2. match_community_cases(query_text, count)
--      → top-K cas communauté via full-text français (to_tsvector + ts_rank)
--      → filtre : status = 'approved'
--
-- Sécurité : SECURITY INVOKER (par défaut) — RLS s'applique côté appelant.
-- Les politiques RLS sur regulatory_documents et community_cases autorisent
-- déjà la lecture publique authentifiée — l'Edge Function passe par le
-- service_role (bypass RLS) côté serveur uniquement.
--
-- Authority : CLAUDE.md §3 + §8 stack IA Anthropic + OpenAI.
-- ============================================

-- ============================================
-- 1. match_regulatory_documents
-- ============================================
CREATE OR REPLACE FUNCTION public.match_regulatory_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.65,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id              uuid,
  title           text,
  ai_summary      text,
  url             text,
  similarity      float,
  published_at    date,
  importance      text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rd.id,
    rd.title,
    rd.ai_summary,
    rd.url,
    (1 - (rd.embedding <=> query_embedding))::float AS similarity,
    rd.published_at,
    rd.importance
  FROM regulatory_documents rd
  WHERE rd.processed_at IS NOT NULL
    AND rd.is_superseded = false
    AND rd.embedding IS NOT NULL
    AND (1 - (rd.embedding <=> query_embedding)) > match_threshold
  ORDER BY rd.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.match_regulatory_documents(vector, float, int) IS
  'RAG : retourne les top-K documents réglementaires par similarité cosinus pgvector.
   Filtre processed_at IS NOT NULL + is_superseded=false + embedding NOT NULL.
   Seuil par défaut 0.65 (calibré V1). Appelée par Edge Function regulatory-ai-chat.';

-- ============================================
-- 2. match_community_cases
-- ============================================
CREATE OR REPLACE FUNCTION public.match_community_cases(
  query_text text,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id              uuid,
  title           text,
  question        text,
  decision_made   text,
  justification   text,
  upvotes         int,
  rank            real
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.title,
    cc.question,
    cc.decision_made,
    cc.justification,
    cc.upvotes_count AS upvotes,
    ts_rank(
      to_tsvector(
        'french',
        cc.title
          || ' ' || cc.question
          || ' ' || COALESCE(cc.decision_made, '')
          || ' ' || COALESCE(cc.justification, '')
      ),
      plainto_tsquery('french', query_text)
    ) AS rank
  FROM community_cases cc
  WHERE cc.status = 'approved'
    AND to_tsvector(
          'french',
          cc.title
            || ' ' || cc.question
            || ' ' || COALESCE(cc.decision_made, '')
            || ' ' || COALESCE(cc.justification, '')
        ) @@ plainto_tsquery('french', query_text)
  ORDER BY rank DESC, cc.upvotes_count DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.match_community_cases(text, int) IS
  'RAG : retourne les top-K cas communauté approuvés par pertinence full-text français
   (to_tsvector + ts_rank). Tiebreaker : upvotes_count. Appelée par Edge Function
   regulatory-ai-chat et helper Node rag-search.ts.';

-- ============================================
-- 3. Permissions
-- ============================================
GRANT EXECUTE ON FUNCTION public.match_regulatory_documents(vector, float, int)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_community_cases(text, int)
  TO authenticated;

-- service_role a déjà accès via ses droits étendus, mais on est explicite.
GRANT EXECUTE ON FUNCTION public.match_regulatory_documents(vector, float, int)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.match_community_cases(text, int)
  TO service_role;

-- ============================================
-- FIN MIGRATION rag_rpc
-- ============================================
