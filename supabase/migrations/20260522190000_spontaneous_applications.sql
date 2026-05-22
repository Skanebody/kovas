-- ============================================
-- KOVAS App — Lot #147 SITE-ANNEXES
-- Candidatures spontanées (page /carrieres)
-- Date : 2026-05-22
-- ============================================
-- Objectif : collecter les candidatures spontanées soumises depuis la page
-- /carrieres (formulaire 5 champs). Pas d'offre publique ouverte en V1,
-- mais on garde la fenêtre ouverte aux profils intéressants pour Phase 2.
--
-- Accès : service role only (lecture admin uniquement). Aucune RLS pour
-- les utilisateurs publics — l'insertion se fait via Server Action avec
-- client admin (clé SUPABASE_SERVICE_ROLE_KEY).
-- ============================================

CREATE TABLE IF NOT EXISTS spontaneous_applications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification candidat
  first_name      text NOT NULL,
  last_name       text NOT NULL,
  email           text NOT NULL,
  linkedin_url    text,
  target_role     text NOT NULL,
  message         text NOT NULL,

  -- Métadonnées soumission
  source_ip       text,            -- IP anonymisée (rate-limit / anti-spam audit)
  user_agent      text,
  honeypot_value  text,            -- valeur du honeypot si fournie (debug)

  -- Workflow interne admin
  status          text NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'in_review', 'archived', 'spam')),
  internal_notes  text,

  -- Audit
  created_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE spontaneous_applications IS
  'Candidatures spontanees collectees depuis la page publique /carrieres. Service role only.';

CREATE INDEX IF NOT EXISTS idx_spontaneous_apps_status
  ON spontaneous_applications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_spontaneous_apps_email
  ON spontaneous_applications (lower(email));

-- ============================================
-- RLS : service role only (aucune policy publique)
-- ============================================
ALTER TABLE spontaneous_applications ENABLE ROW LEVEL SECURITY;

-- Aucune policy SELECT/INSERT/UPDATE/DELETE — seul le service role bypass RLS
-- pour les operations d'admin via les Server Actions.

REVOKE ALL ON TABLE spontaneous_applications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE spontaneous_applications TO service_role;
