-- ============================================
-- KOVAS App — Optimisation IA Vague Cost Optimization
-- Date : 2026-05-26
-- Ajoute le support Batch API Anthropic sur regulatory_documents :
--   - processed              : flag boolean (true quand analyse Claude terminée)
--   - batch_job_id           : ID du batch Anthropic en cours (NULL si analyse synchrone ou pas d'analyse)
--   - batch_submitted_at     : timestamp soumission du batch
--   - batch_completed_at     : timestamp de récolte du résultat (NULL = en cours)
--   - batch_error            : message d'erreur si result.type='errored'
--
-- Pattern d'usage :
--   1. regulatory-watcher INSERT doc avec processed=false (déjà existant via défaut).
--   2. regulatory-batch-analyze (cron 0 1 * * *) :
--        SELECT * FROM regulatory_documents WHERE processed=false AND batch_job_id IS NULL LIMIT 1000;
--        Submit batch → UPDATE batch_job_id, batch_submitted_at.
--   3. batch-results-poller (cron 0 * * * *) :
--        SELECT DISTINCT batch_job_id FROM regulatory_documents
--          WHERE batch_job_id IS NOT NULL AND batch_completed_at IS NULL;
--        Pour chaque batch ended → itère results → UPDATE batch_completed_at + processed=true.
--
-- Authority : docs/ai-cost-optimization.md (Levier 2 : Batch API -50%).
-- ============================================

ALTER TABLE regulatory_documents
  ADD COLUMN IF NOT EXISTS processed              boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS batch_job_id           text,
  ADD COLUMN IF NOT EXISTS batch_submitted_at     timestamptz,
  ADD COLUMN IF NOT EXISTS batch_completed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS batch_error            text;

-- Backfill : si processed_at IS NOT NULL → processed=true.
UPDATE regulatory_documents
  SET processed = true
  WHERE processed_at IS NOT NULL AND processed = false;

-- Index pour la queue de batch (docs en attente d'analyse).
CREATE INDEX IF NOT EXISTS idx_regdoc_unprocessed
  ON regulatory_documents (created_at ASC)
  WHERE processed = false AND batch_job_id IS NULL;

-- Index pour le poller (batches en cours).
CREATE INDEX IF NOT EXISTS idx_regdoc_batch_pending
  ON regulatory_documents (batch_job_id)
  WHERE batch_completed_at IS NULL AND batch_job_id IS NOT NULL;

COMMENT ON COLUMN regulatory_documents.processed IS
  'Flag de bout-en-bout : analyse Claude terminée + embeddings générés + notifications envoyées.';
COMMENT ON COLUMN regulatory_documents.batch_job_id IS
  'ID Anthropic Message Batches en cours (NULL si analyse synchrone ou pas d''analyse).';
COMMENT ON COLUMN regulatory_documents.batch_submitted_at IS
  'Timestamp de soumission du batch (cron nocturne).';
COMMENT ON COLUMN regulatory_documents.batch_completed_at IS
  'Timestamp de récolte du résultat (NULL tant que batch en cours).';
COMMENT ON COLUMN regulatory_documents.batch_error IS
  'Message d''erreur si result.type=errored/expired/canceled.';
