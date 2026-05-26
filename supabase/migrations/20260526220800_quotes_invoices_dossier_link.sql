-- ============================================
-- KOVAS App — Chantier A : Lien devis/factures ↔ dossier
-- Date : 2026-05-24
--
-- Authority : CLAUDE.md §22 + FIX-KK §A.
--
-- Objectif :
--   Permettre à un devis ou une facture d'être rattaché directement à un
--   `dossiers.id` (et non plus seulement à `client_id` + `mission_id`),
--   pour qu'ils apparaissent dans la nouvelle section "Documents
--   commerciaux" de la page dossier détail.
--
-- Idempotent : `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
-- ============================================

-- ============================================
-- 1. quotes.dossier_id (rattachement direct au dossier)
-- ============================================
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS dossier_id uuid REFERENCES dossiers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_dossier
  ON quotes (dossier_id)
  WHERE dossier_id IS NOT NULL;

COMMENT ON COLUMN quotes.dossier_id IS
  'Dossier KOVAS auquel ce devis est rattaché (FIX-KK §A). NULL = devis libre, sans dossier source.';

-- ============================================
-- 2. invoices.dossier_id (idem pour factures)
-- ============================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS dossier_id uuid REFERENCES dossiers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_dossier
  ON invoices (dossier_id)
  WHERE dossier_id IS NOT NULL;

COMMENT ON COLUMN invoices.dossier_id IS
  'Dossier KOVAS auquel cette facture est rattachée (FIX-KK §A). NULL = facture libre, sans dossier source.';

-- ============================================
-- 3. Index composite pour la section "Documents commerciaux" du dossier
--    (récupère devis + factures triés par création, filtrés alive)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_quotes_dossier_created
  ON quotes (dossier_id, created_at DESC)
  WHERE dossier_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_dossier_created
  ON invoices (dossier_id, created_at DESC)
  WHERE dossier_id IS NOT NULL;
