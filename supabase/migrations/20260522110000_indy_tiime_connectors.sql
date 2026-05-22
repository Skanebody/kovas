-- =============================================================================
-- Migration : connecteurs comptables Indy + Tiime + table de configuration commune
-- Cf. CLAUDE.md §17 — connecteurs comptables secondaires (Indy freemium API privée,
-- Tiime compta automatique payante).
--
-- Ce fichier coexiste avec les agents Qonto/Pennylane lancés en parallèle :
--   - `accounting_connectors` : créé avec IF NOT EXISTS (schema partagé 4 providers)
--   - Colonnes `*_invoice_id` / `*_customer_id` : ALTER ADD IF NOT EXISTS
--   - `connector_api_access_requests` : table dédiée pour la demande d'accès
--     API privée Indy (en attendant la mise à disposition par leur équipe)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table partagée des connecteurs comptables (compatible Qonto/Pennylane/Indy/Tiime)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('qonto', 'pennylane', 'indy', 'tiime')),
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'error', 'pending')),
  api_key_encrypted text,
  api_secret_encrypted text,
  oauth_access_token_encrypted text,
  oauth_refresh_token_encrypted text,
  oauth_expires_at timestamptz,
  workspace_id text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounting_connectors_org_provider_unique UNIQUE (organization_id, provider)
);

CREATE INDEX IF NOT EXISTS accounting_connectors_org_idx
  ON public.accounting_connectors(organization_id);

CREATE INDEX IF NOT EXISTS accounting_connectors_provider_idx
  ON public.accounting_connectors(provider);

ALTER TABLE public.accounting_connectors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'accounting_connectors'
      AND policyname = 'accounting_connectors_org_members'
  ) THEN
    CREATE POLICY accounting_connectors_org_members
      ON public.accounting_connectors
      FOR ALL
      USING (public.is_member_of(organization_id))
      WITH CHECK (public.is_member_of(organization_id));
  END IF;
END$$;

-- updated_at trigger reuse pattern : reuse subscriptions_set_updated_at if available
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'accounting_connectors_updated_at'
  ) THEN
    CREATE TRIGGER accounting_connectors_updated_at
      BEFORE UPDATE ON public.accounting_connectors
      FOR EACH ROW
      EXECUTE FUNCTION public.subscriptions_set_updated_at();
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 2. Colonnes Indy / Tiime sur invoices et clients
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS indy_invoice_id text,
  ADD COLUMN IF NOT EXISTS indy_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS tiime_invoice_id text,
  ADD COLUMN IF NOT EXISTS tiime_synced_at timestamptz;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS indy_quote_id text,
  ADD COLUMN IF NOT EXISTS indy_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS tiime_quote_id text,
  ADD COLUMN IF NOT EXISTS tiime_synced_at timestamptz;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS indy_customer_id text,
  ADD COLUMN IF NOT EXISTS tiime_customer_id text;

CREATE INDEX IF NOT EXISTS invoices_indy_invoice_id_idx
  ON public.invoices(indy_invoice_id) WHERE indy_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS invoices_tiime_invoice_id_idx
  ON public.invoices(tiime_invoice_id) WHERE tiime_invoice_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Table des demandes d'accès API (Indy en particulier)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connector_api_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('indy', 'tiime', 'qonto', 'pennylane')),
  requested_by uuid REFERENCES auth.users(id),
  contact_email text,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'granted', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_notes text,
  CONSTRAINT connector_api_access_request_unique_pending
    UNIQUE (organization_id, provider, status)
);

CREATE INDEX IF NOT EXISTS connector_api_access_requests_org_idx
  ON public.connector_api_access_requests(organization_id);

ALTER TABLE public.connector_api_access_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'connector_api_access_requests'
      AND policyname = 'connector_api_access_requests_org_members'
  ) THEN
    CREATE POLICY connector_api_access_requests_org_members
      ON public.connector_api_access_requests
      FOR ALL
      USING (public.is_member_of(organization_id))
      WITH CHECK (public.is_member_of(organization_id));
  END IF;
END$$;

COMMENT ON TABLE public.accounting_connectors IS
  'Configuration des connecteurs comptables (Qonto/Pennylane/Indy/Tiime). 1 ligne max par (org, provider). Secrets chiffrés côté app.';

COMMENT ON TABLE public.connector_api_access_requests IS
  'Demandes d''accès aux API privées (Indy notamment). Une seule demande pending par (org, provider).';
