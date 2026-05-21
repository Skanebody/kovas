-- ============================================
-- KOVAS App — Module 5 prérequis : Contacts (+ alignement Quotes)
-- Date : 2026-05-25
-- Objectif : table contacts (clients / prescripteurs / fournisseurs)
--            servant de cible pour auto_quotes et prescriber_relationships.
--            La table quotes existe déjà (init_schema 18/05) — on aligne
--            par ALTER pour les colonnes manquantes utilisées par les modules.
-- ============================================

-- ============================================
-- 1. Table contacts (nouvelle — répertoire central)
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('client', 'prescriber', 'supplier')),
  display_name    text NOT NULL,
  email           text,
  phone           text, -- E.164 (+33...)
  company_name    text,
  siret           text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

COMMENT ON TABLE contacts IS
  'Répertoire central : clients, prescripteurs (agences / notaires / syndics) et fournisseurs. Cible des modules auto_quotes et prescriber_relationships.';

CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts (organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_kind ON contacts (organization_id, kind);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (organization_id, lower(email))
  WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_alive ON contacts (organization_id)
  WHERE deleted_at IS NULL;

-- Trigger updated_at (réutilise la fonction globale)
DROP TRIGGER IF EXISTS trg_contacts_updated ON contacts;
CREATE TRIGGER trg_contacts_updated
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contacts_select ON contacts;
DROP POLICY IF EXISTS contacts_insert ON contacts;
DROP POLICY IF EXISTS contacts_update ON contacts;
DROP POLICY IF EXISTS contacts_delete ON contacts;
CREATE POLICY contacts_select ON contacts
  FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY contacts_insert ON contacts
  FOR INSERT WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY contacts_update ON contacts
  FOR UPDATE USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY contacts_delete ON contacts
  FOR DELETE USING (public.is_member_of(organization_id));

-- ============================================
-- 2. Alignement table quotes (déjà créée 2026-05-18)
--    Colonnes additionnelles nécessaires aux modules 5/6 :
--      - user_id (auteur du devis)
--      - contact_id (lien direct contact lorsque pas un client)
--      - valid_until / sent_at (compatibilité spec module)
-- ============================================
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS user_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_id  uuid REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valid_until date,
  ADD COLUMN IF NOT EXISTS sent_at     timestamptz;

CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_contact ON quotes (contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_org_status ON quotes (organization_id, status);

COMMENT ON COLUMN quotes.user_id    IS 'Auteur (diagnostiqueur) ayant émis le devis.';
COMMENT ON COLUMN quotes.contact_id IS 'Contact destinataire (prescripteur / lead) lorsque pas encore client converti.';
COMMENT ON COLUMN quotes.valid_until IS 'Date limite de validité du devis (J+30 par défaut applicatif).';
COMMENT ON COLUMN quotes.sent_at    IS 'Horodatage envoi (email / signature electronique).';
