-- ============================================
-- KOVAS App — Module P3 : Factures émises (V1)
-- Date : 2026-05-27
-- Objectif :
--   1. Compléter la table `invoices` (init_schema 18/05) avec les colonnes
--      manquantes pour le wizard / relances / avoirs / IBAN.
--   2. Fonctions séquentielles par organisation + année :
--        - generate_invoice_reference(org_id)      → FAC-2026-00042
--        - generate_credit_note_reference(org_id)  → AV-2026-00001
--   3. Index optimisé pour les requêtes de relance (overdue).
--   4. Colonnes IBAN/BIC sur organizations (paiement SEPA + QR code EPC069).
--
-- Conformité :
--   - Pénalités L441-10 Code Commerce calculées côté applicatif (cf.
--     supabase/functions/invoice-reminders/index.ts) au-delà de J+30.
--   - Profil Factur-X EN16931 par défaut (déjà en colonne).
--   - Migration 100 % idempotente (IF NOT EXISTS, ADD COLUMN IF NOT EXISTS).
-- ============================================

-- ============================================
-- 1. Colonnes additionnelles `invoices`
-- ============================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_terms_days int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS notes              text,
  ADD COLUMN IF NOT EXISTS credit_note_for_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_id            uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_id         uuid REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at            timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_payment_link_url text,
  ADD COLUMN IF NOT EXISTS xml_path           text;

-- Aligne payment_method en CHECK (valeurs autorisées).
-- DROP CONSTRAINT si existe puis recrée — idempotent.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'invoices' AND constraint_name = 'invoices_payment_method_check'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT invoices_payment_method_check;
  END IF;
END $$;

ALTER TABLE invoices
  ALTER COLUMN payment_method SET DEFAULT 'virement';

ALTER TABLE invoices
  ADD CONSTRAINT invoices_payment_method_check
  CHECK (
    payment_method IS NULL
    OR payment_method IN ('virement','sepa','card','cheque','especes','prelevement','autre')
  );

-- Aligne le CHECK status pour inclure tous les états (init_schema le déclarait
-- en texte sans CHECK). Déclaré ici en garde-fou.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'invoices' AND constraint_name = 'invoices_status_check'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT invoices_status_check;
  END IF;
END $$;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check CHECK (
    status IN ('draft','issued','paid','partial','overdue','cancelled')
  );

COMMENT ON COLUMN invoices.payment_terms_days         IS 'Délai paiement en jours (défaut 30, max 60 entre pros L441-10).';
COMMENT ON COLUMN invoices.notes                      IS 'Notes libres affichées en pied de facture (optionnel).';
COMMENT ON COLUMN invoices.credit_note_for_invoice_id IS 'Avoir : référence la facture annulée (null pour facture standard).';
COMMENT ON COLUMN invoices.user_id                    IS 'Auteur (diagnostiqueur) ayant émis la facture.';
COMMENT ON COLUMN invoices.contact_id                 IS 'Contact destinataire si pas encore client converti.';
COMMENT ON COLUMN invoices.sent_at                    IS 'Horodatage envoi email client (verrouille l''édition).';
COMMENT ON COLUMN invoices.stripe_payment_link_url    IS 'URL Stripe Payment Link générée à l''émission (paiement en ligne).';
COMMENT ON COLUMN invoices.xml_path                   IS 'Chemin Storage du XML Factur-X (si stocké séparément du PDF/A-3).';

-- ============================================
-- 2. Index overdue (relances) + index user/contact
-- ============================================
-- Cible : requête Edge Function relances quotidiennes (status issued|partial + due_date < now)
-- L'index existant idx_invoices_overdue (init_schema) couvre (organization_id, due_date)
-- WHERE status IN ('issued','partial','overdue'). On ajoute un index complémentaire
-- sur (status, due_date) global pour le cron qui scanne toutes orgs.
CREATE INDEX IF NOT EXISTS idx_invoices_global_overdue
  ON invoices (status, due_date)
  WHERE status IN ('issued','partial','overdue');

CREATE INDEX IF NOT EXISTS idx_invoices_user
  ON invoices (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_contact
  ON invoices (contact_id)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_credit_note_for
  ON invoices (credit_note_for_invoice_id)
  WHERE credit_note_for_invoice_id IS NOT NULL;

-- Index trigramme pour search reference (FAC-2026-XXXXX) + display search
CREATE INDEX IF NOT EXISTS idx_invoices_reference_trgm
  ON invoices USING gin (reference gin_trgm_ops);

-- ============================================
-- 3. Colonnes IBAN / BIC organizations (pour QR code EPC069 SEPA)
-- ============================================
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS iban     text,
  ADD COLUMN IF NOT EXISTS bic      text,
  ADD COLUMN IF NOT EXISTS bank_name text;

COMMENT ON COLUMN organizations.iban      IS 'IBAN compte pro pour mention obligatoire factures + QR code SEPA EPC069.';
COMMENT ON COLUMN organizations.bic       IS 'BIC/SWIFT du compte (optionnel — beaucoup de banques le déduisent de l''IBAN).';
COMMENT ON COLUMN organizations.bank_name IS 'Nom de la banque pour mention RIB en pied de facture.';

-- ============================================
-- 4. Séquence par (organization_id, année) — factures
-- ============================================
-- Table dédiée pour suivre les compteurs sans race condition.
CREATE TABLE IF NOT EXISTS invoice_sequences (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  year            int  NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('invoice','credit_note')),
  next_seq        int  NOT NULL DEFAULT 1,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, year, kind)
);

COMMENT ON TABLE invoice_sequences IS
  'Compteur séquentiel par (org, année, kind) — FAC-YYYY-NNNNN et AV-YYYY-NNNNN.';

ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_sequences_select ON invoice_sequences;
DROP POLICY IF EXISTS invoice_sequences_modify ON invoice_sequences;

CREATE POLICY invoice_sequences_select ON invoice_sequences
  FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

-- L'insert/update se fait uniquement via les fonctions SECURITY DEFINER.
-- Pas de policy modify côté users.

-- ============================================
-- 5. Fonctions séquentielles (SECURITY DEFINER)
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_invoice_reference(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year    int := EXTRACT(YEAR FROM now() AT TIME ZONE 'Europe/Paris')::int;
  v_seq     int;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'organization_id_required';
  END IF;

  -- UPSERT atomique avec RETURNING pour récupérer la valeur attribuée
  INSERT INTO invoice_sequences (organization_id, year, kind, next_seq)
  VALUES (p_org_id, v_year, 'invoice', 2)
  ON CONFLICT (organization_id, year, kind)
  DO UPDATE SET next_seq = invoice_sequences.next_seq + 1, updated_at = now()
  RETURNING next_seq - 1 INTO v_seq;

  RETURN 'FAC-' || v_year::text || '-' || lpad(v_seq::text, 5, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_invoice_reference(uuid) IS
  'Produit la prochaine référence facture FAC-YYYY-NNNNN pour une organisation (séquentiel par année calendaire Europe/Paris).';

CREATE OR REPLACE FUNCTION public.generate_credit_note_reference(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year    int := EXTRACT(YEAR FROM now() AT TIME ZONE 'Europe/Paris')::int;
  v_seq     int;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'organization_id_required';
  END IF;

  INSERT INTO invoice_sequences (organization_id, year, kind, next_seq)
  VALUES (p_org_id, v_year, 'credit_note', 2)
  ON CONFLICT (organization_id, year, kind)
  DO UPDATE SET next_seq = invoice_sequences.next_seq + 1, updated_at = now()
  RETURNING next_seq - 1 INTO v_seq;

  RETURN 'AV-' || v_year::text || '-' || lpad(v_seq::text, 5, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_credit_note_reference(uuid) IS
  'Produit la prochaine référence avoir AV-YYYY-NNNNN pour une organisation (séquentiel par année).';

-- Autorise l'exécution depuis le rôle authenticated (les fonctions sont
-- SECURITY DEFINER, mais on whitelist explicitement le grant).
GRANT EXECUTE ON FUNCTION public.generate_invoice_reference(uuid)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_credit_note_reference(uuid) TO authenticated, service_role;

-- ============================================
-- 6. Storage bucket pour PDF factures (private — lecture via signed URL)
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices-pdfs', 'invoices-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies storage : seuls membres org peuvent lire/écrire leurs propres fichiers
-- Convention : path = <org_id>/<invoice_id>.pdf  (org_id en premier segment)

DROP POLICY IF EXISTS "invoices_pdfs_select" ON storage.objects;
DROP POLICY IF EXISTS "invoices_pdfs_insert" ON storage.objects;
DROP POLICY IF EXISTS "invoices_pdfs_update" ON storage.objects;
DROP POLICY IF EXISTS "invoices_pdfs_delete" ON storage.objects;

CREATE POLICY "invoices_pdfs_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoices-pdfs'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "invoices_pdfs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'invoices-pdfs'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "invoices_pdfs_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'invoices-pdfs'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "invoices_pdfs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'invoices-pdfs'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

-- ============================================
-- Fin migration invoices V1
-- ============================================
