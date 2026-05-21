-- ============================================
-- KOVAS App — Module 8 : Activation pgvector pour RAG réglementaire
-- Date : 2026-05-25
-- ============================================
-- Idempotent : déjà activé dans 20260518000000_init_schema.sql, on confirme ici.
-- Sert au RAG sur regulatory_documents (embeddings text-embedding-3-small, dim 1536).
-- Lists ivfflat=100 cible 10k-100k vecteurs ; à augmenter à 1000+ au-delà du million.
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

COMMENT ON EXTENSION vector IS
  'pgvector — embeddings RAG (regulatory_documents) + auto-apprentissage (vision_corrections future).';
