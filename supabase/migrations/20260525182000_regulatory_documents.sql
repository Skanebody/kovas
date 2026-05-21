-- ============================================
-- KOVAS App — Module 8 : Documents réglementaires + embeddings RAG
-- Date : 2026-05-25
-- Stockage du texte intégral + chunks pour RAG (OpenAI text-embedding-3-small, dim 1536).
-- ============================================

CREATE TABLE regulatory_documents (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id             uuid NOT NULL REFERENCES regulatory_sources(id) ON DELETE CASCADE,
  external_id           text, -- ID natif côté source (numéro JO, ref ADEME, ...) pour idempotence
  doc_type              text NOT NULL
    CHECK (doc_type IN ('arrete','decret','loi','circulaire','guide','norme','faq','autre')),
  title                 text NOT NULL,
  url                   text NOT NULL,
  published_at          date,
  effective_at          date,
  jurisdiction          text NOT NULL DEFAULT 'FR',
  -- Contenu.
  raw_html              text,
  raw_text              text NOT NULL,
  ai_summary            text, -- résumé Claude 1-2 paragraphes pour aperçu rapide
  ai_summary_model      text,
  ai_summary_cost_eur   numeric(10,6),
  -- Embeddings (text-embedding-3-small, 1536 dimensions).
  embedding             vector(1536),         -- sur le contenu (raw_text tronqué/chunké côté worker)
  ai_summary_embedding  vector(1536),         -- sur ai_summary, pour recherche sémantique rapide
  -- Métadonnées extraites par parser/IA.
  topics                text[] DEFAULT '{}',  -- ['dpe','amiante','plomb',...]
  diagnostic_kinds      text[] DEFAULT '{}',  -- mapping vers mission_type
  applies_to            text[] DEFAULT '{}',  -- ['diagnostiqueur','proprietaire','locataire','notaire']
  importance            text NOT NULL DEFAULT 'normal'
    CHECK (importance IN ('low','normal','high','critical')),
  -- Hash de contenu pour détecter les modifications upstream.
  content_hash          text NOT NULL,
  -- Workflow d'ingestion.
  processed_at          timestamptz,
  embedding_generated_at timestamptz,
  is_superseded         boolean NOT NULL DEFAULT false,
  superseded_by         uuid REFERENCES regulatory_documents(id),
  metadata              jsonb DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id),
  UNIQUE (source_id, content_hash)
);

CREATE INDEX idx_reg_docs_source ON regulatory_documents (source_id, published_at DESC);
CREATE INDEX idx_reg_docs_published ON regulatory_documents (published_at DESC)
  WHERE is_superseded = false;
CREATE INDEX idx_reg_docs_topics ON regulatory_documents USING gin (topics);
CREATE INDEX idx_reg_docs_diagnostic_kinds ON regulatory_documents USING gin (diagnostic_kinds);
CREATE INDEX idx_reg_docs_importance ON regulatory_documents (importance, published_at DESC)
  WHERE importance IN ('high','critical') AND is_superseded = false;
CREATE INDEX idx_reg_docs_external ON regulatory_documents (source_id, external_id);

-- Index ivfflat pour recherche sémantique (lists=100 — bon compromis 10k-100k vecteurs).
-- À porter à 1000+ si > 1M documents (à terme : Phase 2/3).
CREATE INDEX idx_regdoc_embedding ON regulatory_documents
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_regdoc_summary_embedding ON regulatory_documents
  USING ivfflat (ai_summary_embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE regulatory_documents IS
  'Documents réglementaires ingérés (texte intégral + embeddings RAG). Lecture publique, écriture worker (service_role) ou admin.';

CREATE TRIGGER trg_reg_documents_updated BEFORE UPDATE ON regulatory_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE regulatory_documents ENABLE ROW LEVEL SECURITY;

-- SELECT public (tout authentifié) — la veille est un asset partagé.
CREATE POLICY "regulatory_documents_public_read"
  ON regulatory_documents FOR SELECT TO authenticated
  USING (true);

-- INSERT : worker (service_role bypass RLS) ou admin.
CREATE POLICY "regulatory_documents_admin_insert"
  ON regulatory_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_admin((SELECT auth.uid())));

-- UPDATE : worker (service_role) ou admin.
CREATE POLICY "regulatory_documents_admin_update"
  ON regulatory_documents FOR UPDATE TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE POLICY "regulatory_documents_admin_delete"
  ON regulatory_documents FOR DELETE TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

-- ============================================
-- FIN MIGRATION regulatory_documents
-- ============================================
