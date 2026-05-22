-- ============================================
-- Rétention 10 ans des factures + accès post-résiliation
--
-- Cadre légal :
--   - Article L123-22 Code de commerce — 10 ans (documents comptables)
--   - Article L102 B CGI — 6 ans (documents fiscaux)
--   - Article 286 I 3° bis CGI — conservation LAFT
--   - RGPD art. 5-1-e — la conservation légale prime sur la minimisation
--
-- On retient le délai le plus long (10 ans) à compter de la date d'émission
-- (issued_at) ou, à défaut, de la création (created_at).
-- ============================================

-- 1. Colonnes archived_at et deleted_at (soft delete + archivage)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz;

CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at
  ON invoices (organization_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_invoices_archived_at
  ON invoices (organization_id, archived_at);

-- 2. Trigger BEFORE DELETE : interdit le hard delete pendant 10 ans
--    L'application doit utiliser soft delete (UPDATE deleted_at = now()).
CREATE OR REPLACE FUNCTION public.tg_invoices_no_hard_delete_before_10y()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_retain_until timestamptz;
  v_basis timestamptz;
BEGIN
  v_basis := COALESCE(OLD.issued_at::timestamptz, OLD.created_at);
  v_retain_until := v_basis + interval '10 years';

  IF now() < v_retain_until THEN
    RAISE EXCEPTION
      'Suppression définitive de la facture % interdite avant le % (rétention 10 ans Code commerce L123-22). Utiliser deleted_at pour soft delete.',
      OLD.reference, v_retain_until
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_invoices_no_hard_delete ON invoices;
CREATE TRIGGER trg_invoices_no_hard_delete
  BEFORE DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoices_no_hard_delete_before_10y();

COMMENT ON TRIGGER trg_invoices_no_hard_delete ON invoices IS
  'Bloque le hard delete pendant 10 ans (Code commerce L123-22 + LAFT art. 286 I 3° bis CGI).';

-- 3. Empêche aussi toute UPDATE des montants d'une facture émise
--    (l'inaltérabilité LAFT impose l'utilisation d'un avoir).
CREATE OR REPLACE FUNCTION public.tg_invoices_no_update_after_issued()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'issued' OR OLD.status IN ('paid', 'partial', 'overdue') THEN
    IF (OLD.amount_ht  IS DISTINCT FROM NEW.amount_ht)
       OR (OLD.amount_tva IS DISTINCT FROM NEW.amount_tva)
       OR (OLD.amount_ttc IS DISTINCT FROM NEW.amount_ttc)
       OR (OLD.line_items IS DISTINCT FROM NEW.line_items)
       OR (OLD.issued_at  IS DISTINCT FROM NEW.issued_at)
       OR (OLD.tva_rate   IS DISTINCT FROM NEW.tva_rate)
    THEN
      RAISE EXCEPTION
        'Modification des montants ou lignes d''une facture émise interdite (LAFT — inaltérabilité). Émettre un avoir.'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_invoices_no_update_after_issued ON invoices;
CREATE TRIGGER trg_invoices_no_update_after_issued
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoices_no_update_after_issued();

COMMENT ON TRIGGER trg_invoices_no_update_after_issued ON invoices IS
  'Inaltérabilité des montants/lignes après émission (LAFT — corrections par avoir uniquement).';

-- 4. RLS — accès en lecture seule au diagnostiqueur résilié (10 ans)
--    Hypothèse : on a (ou aura) une notion de membership avec status. On crée une
--    policy SELECT permissive : le membre (même status revoked) peut lire ses
--    factures pendant 10 ans. La policy d'écriture (existante) limite l'INSERT
--    aux memberships actifs.
DROP POLICY IF EXISTS "members read invoices 10y after termination" ON invoices;
CREATE POLICY "members read invoices 10y after termination" ON invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = invoices.organization_id
        AND m.user_id = auth.uid()
        -- Tout membership (actif, pending, revoked) garde droit de lecture
    )
    AND (
      -- Délai légal : 10 ans à partir de issued_at (ou created_at à défaut)
      COALESCE(invoices.issued_at::timestamptz, invoices.created_at) + interval '10 years' > now()
    )
  );

COMMENT ON POLICY "members read invoices 10y after termination" ON invoices IS
  'Garantit l''accès en lecture seule au diagnostiqueur résilié pendant 10 ans (Code commerce L123-22 + CGV §8).';

-- 5. Vue convenience : factures actives (non soft-deleted)
CREATE OR REPLACE VIEW invoices_active AS
  SELECT * FROM invoices WHERE deleted_at IS NULL;

COMMENT ON VIEW invoices_active IS
  'Vue des factures actives (deleted_at IS NULL). Les factures soft-deleted restent en DB pour rétention 10 ans.';

-- 6. Fonction utilitaire : date limite de rétention
CREATE OR REPLACE FUNCTION public.invoice_retention_until(p_invoice_id uuid)
RETURNS timestamptz LANGUAGE sql STABLE AS $$
  SELECT COALESCE(i.issued_at::timestamptz, i.created_at) + interval '10 years'
  FROM invoices i WHERE i.id = p_invoice_id;
$$;

COMMENT ON FUNCTION public.invoice_retention_until(uuid) IS
  'Renvoie la date à partir de laquelle la facture peut être définitivement supprimée (issued_at + 10 ans).';
