-- ============================================
-- KOVAS App — Module Devis (P2) : Factur-X + UX devis Qonto-style
-- Date : 2026-05-27
--
-- Authority : CLAUDE.md §3 + §8 (Stripe + Yousign) + plan prompt P2.
--
-- Objectif :
--   1. Aligner la table `quotes` avec les exigences Factur-X
--      (XML CII embarqué, profil EN16931 par défaut, mentions
--      paiement, notes, snapshot client traçabilité 10 ans).
--   2. Stocker les PDFs dans un bucket dédié `quotes-pdfs`.
--   3. Index utiles à la liste filtrée par statut + org.
--   4. Fonction helper `generate_quote_reference(org_id)` qui
--      réutilise `next_reference(org, 'quote')` (init_schema 18/05)
--      mais avec une signature explicite pour la couche app.
--
-- Idempotent : `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`,
-- `ON CONFLICT DO NOTHING`, `DROP POLICY IF EXISTS`.
-- ============================================

-- ============================================
-- 1. Colonnes Factur-X / UX manquantes sur `quotes`
-- ============================================
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS facturx_xml          text,
  ADD COLUMN IF NOT EXISTS facturx_profile      text DEFAULT 'EN16931',
  ADD COLUMN IF NOT EXISTS payment_terms_days   int  DEFAULT 30,
  ADD COLUMN IF NOT EXISTS payment_method       text DEFAULT 'virement',
  ADD COLUMN IF NOT EXISTS notes                text,
  ADD COLUMN IF NOT EXISTS client_snapshot      jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at           timestamptz;

-- ============================================
-- 2. Contraintes CHECK (idempotent : DROP avant ADD)
-- ============================================
ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS quotes_facturx_profile_check;
ALTER TABLE quotes
  ADD CONSTRAINT quotes_facturx_profile_check
  CHECK (facturx_profile IN ('BASIC', 'EN16931', 'EXTENDED'));

ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS quotes_payment_method_check;
ALTER TABLE quotes
  ADD CONSTRAINT quotes_payment_method_check
  CHECK (payment_method IN ('virement', 'sepa', 'cheque', 'especes', 'cb'));

ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS quotes_payment_terms_days_check;
ALTER TABLE quotes
  ADD CONSTRAINT quotes_payment_terms_days_check
  CHECK (payment_terms_days IS NULL OR payment_terms_days BETWEEN 0 AND 365);

-- ============================================
-- 3. Index utiles à la page liste (filtre status + org + alive)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_quotes_org_status_alive
  ON quotes (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_org_created_alive
  ON quotes (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_alive
  ON quotes (organization_id)
  WHERE deleted_at IS NULL;

-- ============================================
-- 4. Commentaires métier
-- ============================================
COMMENT ON COLUMN quotes.facturx_xml         IS
  'XML CII (CrossIndustryInvoice) Factur-X embarqué dans le PDF/A-3 si pris en charge — sinon stocké pour audit / future embed.';
COMMENT ON COLUMN quotes.facturx_profile     IS
  'Profil Factur-X : BASIC (minimal) | EN16931 (européen défaut) | EXTENDED.';
COMMENT ON COLUMN quotes.payment_terms_days  IS
  'Délai de paiement en jours (défaut 30 — Code de commerce L441-10).';
COMMENT ON COLUMN quotes.payment_method      IS
  'Moyen de paiement attendu : virement | sepa | cheque | especes | cb.';
COMMENT ON COLUMN quotes.notes               IS
  'Notes libres visibles sur le PDF (mentions, conditions complémentaires).';
COMMENT ON COLUMN quotes.client_snapshot     IS
  'Snapshot client figé à l''envoi pour traçabilité même si client supprimé (RGPD + audit 10 ans Code Commerce).';
COMMENT ON COLUMN quotes.deleted_at          IS
  'Soft delete (NULL = devis vivant). Seuls les brouillons peuvent être soft-deleted.';

-- ============================================
-- 5. Bucket Storage `quotes-pdfs` (privé — accès via signed URL)
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quotes-pdfs',
  'quotes-pdfs',
  false,
  10485760, -- 10 MB max par PDF (large marge — un devis ~80-200 KB)
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Convention de path : <organization_id>/<quote_id>.pdf

DROP POLICY IF EXISTS "quotes-pdfs: org members read"   ON storage.objects;
DROP POLICY IF EXISTS "quotes-pdfs: org members upload" ON storage.objects;
DROP POLICY IF EXISTS "quotes-pdfs: org members update" ON storage.objects;
DROP POLICY IF EXISTS "quotes-pdfs: org members delete" ON storage.objects;

CREATE POLICY "quotes-pdfs: org members read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'quotes-pdfs'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "quotes-pdfs: org members upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'quotes-pdfs'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "quotes-pdfs: org members update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'quotes-pdfs'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  )
  WITH CHECK (
    bucket_id = 'quotes-pdfs'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "quotes-pdfs: org members delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'quotes-pdfs'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

-- ============================================
-- 6. Wrapper helper `generate_quote_reference(org_id)`
--    Réutilise `next_reference` mais avec une signature explicite.
--    Format : DEV-2026-00042
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_quote_reference(p_org uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.next_reference(p_org, 'quote');
END;
$$;

COMMENT ON FUNCTION public.generate_quote_reference(uuid) IS
  'Renvoie une référence DEV-YYYY-NNNNN unique par organisation/année. Wrapper de next_reference(org, ''quote'').';

GRANT EXECUTE ON FUNCTION public.generate_quote_reference(uuid) TO authenticated;
