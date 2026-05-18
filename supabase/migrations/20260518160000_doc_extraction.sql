-- ============================================
-- KOVAS — Extraction de données des documents propriétaire
-- Cf. CLAUDE.md §3 feature 6 — upload documents + (V1.5) extraction IA
-- ============================================

ALTER TABLE owner_documents
  ADD COLUMN IF NOT EXISTS extracted_data jsonb,
  ADD COLUMN IF NOT EXISTS extraction_status text DEFAULT 'pending', -- pending | processing | extracted | failed | skipped
  ADD COLUMN IF NOT EXISTS extracted_at timestamptz,
  ADD COLUMN IF NOT EXISTS extraction_cost_eur numeric(8,4),
  ADD COLUMN IF NOT EXISTS extraction_error text;

CREATE INDEX IF NOT EXISTS idx_owner_documents_extraction_status
  ON owner_documents (organization_id, extraction_status)
  WHERE extraction_status IN ('pending', 'processing');

-- Note : pas de CHECK constraint stricte sur le format de extracted_data
-- (le schéma JSON varie selon doc_kind). Cf. lib/document-extractor.ts pour la structure.
