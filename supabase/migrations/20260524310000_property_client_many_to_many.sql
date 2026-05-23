-- ============================================
-- KOVAS App — Chantier C + D : Relations bien ↔ clients many-to-many
--   + Historique des reventes (changement de propriétaire)
-- Date : 2026-05-24
--
-- Authority : CLAUDE.md §22 + FIX-KK §C + §D.
--
-- Objectif :
--   - Sortir du modèle `properties.client_id = propriétaire unique`.
--   - Permettre N clients (rôles : owner, co_owner, tenant, seller, buyer,
--     property_manager, syndic, notary, agency) liés à un même bien.
--   - Tracer l'historique : `is_current=false` + `ended_at` pour les
--     anciens propriétaires (revente), avec lignes d'audit
--     `property_ownership_history` pour la transaction elle-même.
--   - Préserver les anciens dossiers : ils restent visibles mais marqués
--     "Propriété ancienne" via l'application (lecture des relations).
--
-- Backfill : pour chaque property avec un client_id legacy, on insère
-- une ligne `role='owner', is_current=true` avec started_at = today-90j
-- pour garantir une chronologie cohérente.
--
-- Idempotent.
-- ============================================

-- ============================================
-- 1. Table property_client_relationships (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS property_client_relationships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN (
    'owner',
    'co_owner',
    'tenant',
    'seller',
    'buyer',
    'property_manager',
    'syndic',
    'notary',
    'agency'
  )),
  is_current      boolean NOT NULL DEFAULT true,
  started_at      date NOT NULL DEFAULT current_date,
  ended_at        date,
  ownership_share numeric(5,2) CHECK (ownership_share IS NULL OR (ownership_share > 0 AND ownership_share <= 100)),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Idempotence : pas de doublon strict (même bien + même client + même rôle + même date début)
  UNIQUE (property_id, client_id, role, started_at)
);

CREATE INDEX IF NOT EXISTS idx_pcr_property_current
  ON property_client_relationships (property_id, is_current);
CREATE INDEX IF NOT EXISTS idx_pcr_client
  ON property_client_relationships (client_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcr_org
  ON property_client_relationships (organization_id);

COMMENT ON TABLE property_client_relationships IS
  'Many-to-many bien ↔ clients avec rôles métier (owner/co_owner/tenant/seller/buyer/property_manager/syndic/notary/agency). Remplace le modèle single-client de `properties.client_id` (FIX-KK §C).';
COMMENT ON COLUMN property_client_relationships.is_current IS
  'TRUE = relation active aujourd''hui. FALSE = relation historique (ex : ancien propriétaire après revente).';
COMMENT ON COLUMN property_client_relationships.ownership_share IS
  'Part de propriété en % (indivision). Ex : 50.00 pour 50/50, 33.33 pour tiers. NULL si non applicable (locataire, syndic...).';

-- ============================================
-- 2. RLS multi-tenant
-- ============================================
ALTER TABLE property_client_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pcr_org_select ON property_client_relationships;
DROP POLICY IF EXISTS pcr_org_insert ON property_client_relationships;
DROP POLICY IF EXISTS pcr_org_update ON property_client_relationships;
DROP POLICY IF EXISTS pcr_org_delete ON property_client_relationships;

CREATE POLICY pcr_org_select ON property_client_relationships
  FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY pcr_org_insert ON property_client_relationships
  FOR INSERT WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY pcr_org_update ON property_client_relationships
  FOR UPDATE USING (public.is_member_of(organization_id))
              WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY pcr_org_delete ON property_client_relationships
  FOR DELETE USING (public.is_member_of(organization_id));

-- ============================================
-- 3. Backfill — chaque property.client_id legacy devient une ligne
--    `role='owner', is_current=true`
-- ============================================
INSERT INTO property_client_relationships (property_id, client_id, organization_id, role, started_at, is_current)
SELECT p.id, p.client_id, p.organization_id, 'owner', (current_date - 90), true
FROM properties p
WHERE p.client_id IS NOT NULL
  AND p.deleted_at IS NULL
ON CONFLICT (property_id, client_id, role, started_at) DO NOTHING;

-- ============================================
-- 4. Table property_ownership_history (audit reventes — Chantier D)
-- ============================================
CREATE TABLE IF NOT EXISTS property_ownership_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  previous_owner_client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  new_owner_client_id      uuid REFERENCES clients(id) ON DELETE SET NULL,
  transaction_date date NOT NULL,
  notary_act_storage_path text,
  transaction_amount_eur numeric(12,2) CHECK (transaction_amount_eur IS NULL OR transaction_amount_eur >= 0),
  notes           text,
  recorded_by     uuid REFERENCES auth.users(id),
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poh_property
  ON property_ownership_history (property_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_poh_org
  ON property_ownership_history (organization_id);

COMMENT ON TABLE property_ownership_history IS
  'Audit trail des reventes / changements de propriétaire d''un bien (FIX-KK §D). Trace chaque transaction avec date, acte notarié, montant, ancien et nouveau propriétaire.';

ALTER TABLE property_ownership_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS poh_org_select ON property_ownership_history;
DROP POLICY IF EXISTS poh_org_insert ON property_ownership_history;
DROP POLICY IF EXISTS poh_org_update ON property_ownership_history;
DROP POLICY IF EXISTS poh_org_delete ON property_ownership_history;

CREATE POLICY poh_org_select ON property_ownership_history
  FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY poh_org_insert ON property_ownership_history
  FOR INSERT WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY poh_org_update ON property_ownership_history
  FOR UPDATE USING (public.is_member_of(organization_id))
              WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY poh_org_delete ON property_ownership_history
  FOR DELETE USING (public.is_member_of(organization_id));

-- ============================================
-- 5. Trigger updated_at sur property_client_relationships
-- ============================================
CREATE OR REPLACE FUNCTION public.touch_pcr_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pcr_touch_updated_at ON property_client_relationships;
CREATE TRIGGER trg_pcr_touch_updated_at
  BEFORE UPDATE ON property_client_relationships
  FOR EACH ROW EXECUTE FUNCTION public.touch_pcr_updated_at();
