-- ============================================
-- KOVAS App — Lot #147 SITE-ANNEXES
-- Demandes de partenariat (page /partenaires)
-- Date : 2026-05-22
-- ============================================
-- Objectif : collecter les demandes de partenariat soumises depuis la page
-- /partenaires (notaires, agences immobilieres, banques/courtiers,
-- fournisseurs energie).
--
-- Accès : service role only. Insertion via Server Action admin.
-- ============================================

CREATE TABLE IF NOT EXISTS partner_inquiries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification contact
  first_name          text NOT NULL,
  last_name           text NOT NULL,
  email               text NOT NULL,
  phone               text,                -- E.164 (+33...)

  -- Identification structure
  company_name        text NOT NULL,
  company_role        text NOT NULL,       -- "Directeur d'agence", "Notaire associé", etc.
  partnership_type    text NOT NULL
                      CHECK (partnership_type IN (
                        'notaires',
                        'agences-immobilieres',
                        'banques-courtiers',
                        'fournisseurs-energie',
                        'autre'
                      )),

  -- Contenu
  message             text NOT NULL,

  -- Métadonnées
  source_ip           text,
  user_agent          text,
  honeypot_value      text,

  -- Workflow admin
  status              text NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new', 'in_review', 'qualified', 'closed_won', 'closed_lost', 'spam')),
  internal_notes      text,

  -- Audit
  created_at          timestamptz NOT NULL DEFAULT now(),
  reviewed_at         timestamptz,
  reviewed_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE partner_inquiries IS
  'Demandes de partenariat collectees depuis la page publique /partenaires. Service role only.';

CREATE INDEX IF NOT EXISTS idx_partner_inquiries_status
  ON partner_inquiries (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_inquiries_type
  ON partner_inquiries (partnership_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_inquiries_email
  ON partner_inquiries (lower(email));

ALTER TABLE partner_inquiries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE partner_inquiries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE partner_inquiries TO service_role;
