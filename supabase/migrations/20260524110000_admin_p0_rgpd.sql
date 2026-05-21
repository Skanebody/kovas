-- ============================================
-- KOVAS — RGPD DSAR queue (Data Subject Access Requests)
-- Cf. CLAUDE.md §10 (RGPD complet dès J0) + obligation légale délai max 30j.
--
-- Cette migration crée :
--   1. Table dsar_requests : file d'attente des demandes RGPD (export + erasure)
--   2. Trigger qui calcule la deadline automatiquement (requested_at + 30 jours)
--   3. RLS : seuls les admins peuvent lire/modifier (helper is_admin déjà créé)
--      + INSERT autorisé pour le user qui demande ses propres données (via API user-scoped)
--
-- États du workflow :
--   pending     → demande déposée, en attente de traitement
--   processing  → admin a commencé le traitement (export en cours / planning erasure)
--   completed   → données livrées (export) ou supprimées (erasure)
--   rejected    → demande refusée (motif obligatoire dans notes)
--
-- Types de demande :
--   export   → article 15 RGPD (droit d'accès / portabilité)
--   erasure  → article 17 RGPD (droit à l'oubli)
-- ============================================

-- ============================================
-- 1. Enums
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dsar_type') THEN
    CREATE TYPE dsar_type AS ENUM ('export', 'erasure');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dsar_status') THEN
    CREATE TYPE dsar_status AS ENUM ('pending', 'processing', 'completed', 'rejected');
  END IF;
END$$;

-- ============================================
-- 2. Table dsar_requests
-- ============================================
CREATE TABLE IF NOT EXISTS dsar_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id       uuid REFERENCES organizations(id) ON DELETE SET NULL,
  type                  dsar_type NOT NULL,
  status                dsar_status NOT NULL DEFAULT 'pending',
  requested_at          timestamptz NOT NULL DEFAULT now(),
  -- Calculée automatiquement par le trigger (requested_at + 30 jours).
  deadline              timestamptz NOT NULL,
  -- Note libre (motif rejet, lien export généré, ID Stripe annulation, etc.).
  notes                 text,
  -- Admin ayant traité (NULL tant que pending).
  completed_by_admin    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Index sur status + deadline pour le tri admin (urgence proche)
CREATE INDEX IF NOT EXISTS idx_dsar_status_deadline
  ON dsar_requests (status, deadline ASC)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_dsar_user
  ON dsar_requests (user_id, requested_at DESC);

-- ============================================
-- 3. Trigger : deadline = requested_at + 30 jours, mise à jour updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.dsar_set_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- À l'INSERT : forcer la deadline = requested_at + 30 jours
  IF TG_OP = 'INSERT' THEN
    IF NEW.requested_at IS NULL THEN
      NEW.requested_at := now();
    END IF;
    NEW.deadline := NEW.requested_at + INTERVAL '30 days';
    NEW.updated_at := now();
  END IF;

  -- À l'UPDATE : refresh updated_at
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    -- Si l'admin marque comme completed/rejected, capter le timestamp
    IF NEW.status IN ('completed', 'rejected')
       AND (OLD.status NOT IN ('completed', 'rejected'))
       AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dsar_deadline_trigger ON dsar_requests;
CREATE TRIGGER dsar_deadline_trigger
  BEFORE INSERT OR UPDATE ON dsar_requests
  FOR EACH ROW EXECUTE FUNCTION public.dsar_set_deadline();

-- ============================================
-- 4. RLS
-- ============================================
ALTER TABLE dsar_requests ENABLE ROW LEVEL SECURITY;

-- Lecture admin uniquement
DROP POLICY IF EXISTS "dsar_select_admin" ON dsar_requests;
CREATE POLICY "dsar_select_admin" ON dsar_requests
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Lecture par l'utilisateur de ses propres demandes (statut)
DROP POLICY IF EXISTS "dsar_select_self" ON dsar_requests;
CREATE POLICY "dsar_select_self" ON dsar_requests
  FOR SELECT
  USING (user_id = auth.uid());

-- Insertion : un user peut déposer SA propre demande
DROP POLICY IF EXISTS "dsar_insert_self" ON dsar_requests;
CREATE POLICY "dsar_insert_self" ON dsar_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Modification : admin uniquement (changement de statut, ajout notes)
DROP POLICY IF EXISTS "dsar_update_admin" ON dsar_requests;
CREATE POLICY "dsar_update_admin" ON dsar_requests
  FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Pas de DELETE policy : les demandes traitées restent dans le système
-- pour traçabilité légale (durée conservation = 5 ans recommandé CNIL).
