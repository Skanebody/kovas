-- ============================================
-- KOVAS App — Connecteur Pennylane (PDP DGFiP 2024)
-- Date : 2026-05-22
-- Cf. /docs/connectors/PENNYLANE-INTEGRATION.md
--
-- Ce script est idempotent (CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS).
-- Schéma `accounting_connectors` aligné avec le connecteur Qonto (provider générique).
-- ============================================

-- ============================================
-- 1. Table `accounting_connectors`
-- Stocke les credentials chiffrés des intégrations comptables/bancaires
-- (Pennylane, Qonto, Iopole, etc.) — 1 row par (org, provider).
-- ============================================
CREATE TABLE IF NOT EXISTS accounting_connectors (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider           text NOT NULL, -- 'pennylane' | 'qonto' | 'iopole' | ...
  status             text NOT NULL DEFAULT 'inactive', -- 'inactive' | 'active' | 'error'
  encrypted_token    text,          -- AES-256-GCM (base64), via lib/security/encrypt.ts
  metadata           jsonb DEFAULT '{}'::jsonb, -- libre : workspace_id, scope, etc.
  last_test_at       timestamptz,
  last_test_status   text,          -- 'success' | 'failure'
  last_test_error    text,
  last_sync_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_accounting_connectors_org
  ON accounting_connectors (organization_id);
CREATE INDEX IF NOT EXISTS idx_accounting_connectors_active
  ON accounting_connectors (organization_id, provider)
  WHERE status = 'active';

-- RLS : isolation par organisation (membership active)
ALTER TABLE accounting_connectors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'accounting_connectors'
      AND policyname = 'accounting_connectors_org_isolation'
  ) THEN
    EXECUTE 'CREATE POLICY accounting_connectors_org_isolation
      ON accounting_connectors
      FOR ALL
      USING (public.is_member_of(organization_id))
      WITH CHECK (public.is_member_of(organization_id))';
  END IF;
END $$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_accounting_connectors_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_connectors_updated_at ON accounting_connectors;
CREATE TRIGGER trg_accounting_connectors_updated_at
  BEFORE UPDATE ON accounting_connectors
  FOR EACH ROW EXECUTE FUNCTION public.touch_accounting_connectors_updated_at();

-- ============================================
-- 2. Colonnes Pennylane sur `invoices`
-- ============================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS pennylane_invoice_id  text,
  ADD COLUMN IF NOT EXISTS pennylane_customer_id text,
  ADD COLUMN IF NOT EXISTS pennylane_synced_at   timestamptz,
  ADD COLUMN IF NOT EXISTS pennylane_public_url  text;

CREATE INDEX IF NOT EXISTS idx_invoices_pennylane_invoice_id
  ON invoices (pennylane_invoice_id)
  WHERE pennylane_invoice_id IS NOT NULL;

-- ============================================
-- 3. Colonnes Pennylane sur `quotes`
-- ============================================
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS pennylane_quote_id    text,
  ADD COLUMN IF NOT EXISTS pennylane_customer_id text,
  ADD COLUMN IF NOT EXISTS pennylane_synced_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_quotes_pennylane_quote_id
  ON quotes (pennylane_quote_id)
  WHERE pennylane_quote_id IS NOT NULL;

-- ============================================
-- 4. Colonne Pennylane customer_id sur `clients` (cache mapping)
-- Évite de relancer la recherche/création client Pennylane à chaque facture.
-- ============================================
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS pennylane_customer_id text,
  ADD COLUMN IF NOT EXISTS pennylane_synced_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_clients_pennylane_customer_id
  ON clients (organization_id, pennylane_customer_id)
  WHERE pennylane_customer_id IS NOT NULL;

-- ============================================
-- 5. Commentaires (auto-doc DBA)
-- ============================================
COMMENT ON TABLE accounting_connectors IS
  'Connecteurs comptables/bancaires par organisation (Pennylane, Qonto, Iopole). Tokens chiffrés AES-256-GCM via lib/security/encrypt.ts.';
COMMENT ON COLUMN accounting_connectors.encrypted_token IS
  'Token API chiffré (base64 = iv || authTag || ciphertext). Décryptable via ENCRYPTION_KEY uniquement.';
COMMENT ON COLUMN invoices.pennylane_invoice_id IS
  'ID Pennylane de la facture synchronisée (PDP DGFiP). NULL si non syncée.';
COMMENT ON COLUMN quotes.pennylane_quote_id IS
  'ID Pennylane du devis synchronisé. NULL si non syncé.';
COMMENT ON COLUMN clients.pennylane_customer_id IS
  'ID Pennylane du client (cache mapping pour éviter listCustomers répétés).';
