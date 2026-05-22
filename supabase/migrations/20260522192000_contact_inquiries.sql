-- ============================================
-- KOVAS App — Lot #147 SITE-ANNEXES
-- Demandes de contact (page /contact étendue)
-- Date : 2026-05-22
-- ============================================
-- Objectif : remplacer le simple mailto: actuel par un formulaire
-- dynamique multi-types (particulier / diagnostiqueur / journaliste /
-- partenariat), avec stockage en base + auto-reply Resend.
--
-- Le champ `context jsonb` permet de stocker les attributs propres au
-- type de demande sans multiplier les colonnes (volume mensuel, logiciel
-- actuel, média, entreprise...).
-- ============================================

CREATE TABLE IF NOT EXISTS contact_inquiries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Typologie demande
  inquiry_type    text NOT NULL
                  CHECK (inquiry_type IN ('particulier', 'diagnostiqueur', 'journaliste', 'partenariat')),

  -- Contact
  first_name      text NOT NULL,
  last_name       text NOT NULL,
  email           text NOT NULL,
  phone           text,
  company         text,

  -- Contexte typé (jsonb pour flexibilité par type)
  -- particulier      : { city?: string, project_type?: string }
  -- diagnostiqueur   : { monthly_volume?: number, current_software?: string }
  -- journaliste      : { media?: string, deadline?: string }
  -- partenariat      : { partnership_type?: string, company_size?: string }
  context         jsonb NOT NULL DEFAULT '{}'::jsonb,

  message         text NOT NULL,

  -- Métadonnées soumission
  source_ip       text,
  user_agent      text,
  honeypot_value  text,

  -- Workflow admin
  status          text NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'in_progress', 'resolved', 'spam')),
  internal_notes  text,

  -- Audit
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE contact_inquiries IS
  'Demandes de contact unifiees depuis /contact (4 typologies). Service role only.';

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status
  ON contact_inquiries (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_type
  ON contact_inquiries (inquiry_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_email
  ON contact_inquiries (lower(email));

ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE contact_inquiries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE contact_inquiries TO service_role;
