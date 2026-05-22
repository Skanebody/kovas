-- ============================================
-- Migration : Connecteur Qonto (PDP DGFiP 2024)
-- ============================================
-- Ajoute la table `accounting_connectors` (multi-provider : qonto, pennylane, indy, tiime)
-- + colonnes de tracking sur invoices/quotes/clients pour stocker les IDs Qonto.
--
-- Authentification par token chiffré AES-256-GCM (cf. apps/web/src/lib/security/encrypt.ts).
-- 1 connecteur actif maximum par (organization, provider) — contrainte UNIQUE.
-- ============================================

-- ============================================
-- 1. Colonnes tracking Qonto sur invoices
-- ============================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS qonto_invoice_id  text,
  ADD COLUMN IF NOT EXISTS qonto_synced_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_invoices_qonto_id
  ON invoices (qonto_invoice_id)
  WHERE qonto_invoice_id IS NOT NULL;

-- ============================================
-- 2. Colonnes tracking Qonto sur quotes
-- ============================================
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS qonto_quote_id    text,
  ADD COLUMN IF NOT EXISTS qonto_synced_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_quotes_qonto_id
  ON quotes (qonto_quote_id)
  WHERE qonto_quote_id IS NOT NULL;

-- ============================================
-- 3. Colonnes tracking Qonto sur clients
-- ============================================
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS qonto_customer_id text,
  ADD COLUMN IF NOT EXISTS qonto_synced_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_clients_qonto_id
  ON clients (qonto_customer_id)
  WHERE qonto_customer_id IS NOT NULL;

-- ============================================
-- 4. Table accounting_connectors (multi-provider)
-- ============================================
CREATE TABLE IF NOT EXISTS accounting_connectors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL CHECK (provider IN ('qonto', 'pennylane', 'indy', 'tiime')),
  token_encrypted TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  last_sync_at    TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_accounting_org
  ON accounting_connectors(organization_id);

ALTER TABLE accounting_connectors ENABLE ROW LEVEL SECURITY;

-- RLS : seuls les membres actifs de l'organisation lisent / écrivent leur connecteur
CREATE POLICY "accounting: org members read"
  ON accounting_connectors
  FOR SELECT
  USING (public.is_member_of(organization_id));

CREATE POLICY "accounting: org admins write"
  ON accounting_connectors
  FOR ALL
  USING (public.is_member_of(organization_id));

-- ============================================
-- 5. Trigger updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.tg_accounting_connectors_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_connectors_updated_at ON accounting_connectors;
CREATE TRIGGER trg_accounting_connectors_updated_at
  BEFORE UPDATE ON accounting_connectors
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_accounting_connectors_updated_at();

COMMENT ON TABLE accounting_connectors IS
  'Connecteurs comptables externes (Qonto PDP DGFiP, Pennylane, Indy, Tiime). Token chiffré AES-256-GCM, multi-tenant (1 par org/provider).';
