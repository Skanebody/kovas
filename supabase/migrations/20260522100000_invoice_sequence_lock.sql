-- ============================================
-- Sequence lock : numérotation continue et croissante des factures
--
-- Cadre légal :
--   - Article 286, I, 3° bis CGI (Loi anti-fraude TVA — LAFT)
--   - Article 242 nonies A, 2° de l'annexe II au CGI (numérotation séquentielle)
--   - Article L441-9 du Code de commerce
--
-- Objectif :
--   1. Garantir séquentialité continue per-organisation par (kind, year)
--   2. Verrou transactionnel concurrent-safe via pg_advisory_xact_lock
--   3. Index UNIQUE sur invoices(organization_id, reference)
--   4. Trigger BEFORE INSERT validant le pattern FAC-YYYY-NNNNN
-- ============================================

-- 1. Index unique sur reference_counters (organization_id, kind, year)
--    Note : PRIMARY KEY existant couvre déjà la triple unicité, on garde l'index
--    nommé explicitement pour le diagnostiquer plus facilement.
CREATE INDEX IF NOT EXISTS idx_reference_counters_lookup
  ON reference_counters (organization_id, kind, year);

-- 2. Fonction next_reference enrichie : verrou transactionnel
--    L'advisory lock per-(org, kind, year) évite tout race-condition même sous
--    forte concurrence. Le hash est calculé avec hashtextextended pour bigint.
CREATE OR REPLACE FUNCTION public.next_reference(p_org uuid, p_kind text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year   int := EXTRACT(YEAR FROM now() AT TIME ZONE 'Europe/Paris');
  v_next   bigint;
  v_prefix text;
  v_lock_key bigint;
BEGIN
  -- Préfixe selon le type d'entité
  v_prefix := CASE p_kind
    WHEN 'invoice' THEN 'FAC'
    WHEN 'quote'   THEN 'DEV'
    WHEN 'credit_note' THEN 'AVO'
    WHEN 'dossier' THEN 'DOS'
    ELSE 'MIS'
  END;

  -- Validation kind (whitelist)
  IF p_kind NOT IN ('invoice', 'quote', 'credit_note', 'dossier', 'mission') THEN
    RAISE EXCEPTION 'next_reference: kind invalide « % »', p_kind
      USING ERRCODE = 'check_violation';
  END IF;

  -- Verrou transactionnel : un seul next_reference simultané par (org, kind, year).
  -- hashtextextended retourne bigint, parfait pour pg_advisory_xact_lock.
  v_lock_key := hashtextextended(p_org::text || ':' || p_kind || ':' || v_year::text, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Upsert atomique du compteur
  INSERT INTO reference_counters (organization_id, kind, year, last_value)
  VALUES (p_org, p_kind, v_year, 1)
  ON CONFLICT (organization_id, kind, year)
  DO UPDATE SET last_value = reference_counters.last_value + 1
  RETURNING last_value INTO v_next;

  RETURN v_prefix || '-' || v_year || '-' || lpad(v_next::text, 5, '0');
END $$;

COMMENT ON FUNCTION public.next_reference(uuid, text) IS
  'Génère une référence séquentielle continue per-organisation et per-année. '
  'Verrou pg_advisory_xact_lock pour la sécurité concurrentielle (LAFT art. 286 I 3° bis CGI).';

-- 3. Garantir l'unicité forte (org, reference). La table init avait déjà une
--    contrainte UNIQUE — on s'assure qu'elle existe en idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_organization_id_reference_key'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_organization_id_reference_key
      UNIQUE (organization_id, reference);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_reference_pattern
  ON invoices (organization_id, reference);

-- 4. Trigger BEFORE INSERT : valide le pattern FAC-YYYY-NNNNN
--    et empêche tout numéro hors séquence (gap ou rebroussement).
CREATE OR REPLACE FUNCTION public.tg_invoices_validate_reference()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_pattern text := '^FAC-\d{4}-\d{5,}$';
  v_year int;
  v_seq  bigint;
  v_last_seq bigint;
BEGIN
  -- 1. Pattern obligatoire
  IF NEW.reference IS NULL OR NEW.reference !~ v_pattern THEN
    RAISE EXCEPTION 'Numéro de facture « % » invalide. Format attendu : FAC-YYYY-NNNNN.', NEW.reference
      USING ERRCODE = 'check_violation';
  END IF;

  -- 2. Extraction année + numéro
  v_year := substring(NEW.reference from 'FAC-(\d{4})-')::int;
  v_seq  := substring(NEW.reference from 'FAC-\d{4}-(\d+)$')::bigint;

  -- 3. Année cohérente avec issued_at (si renseigné)
  IF NEW.issued_at IS NOT NULL AND v_year <> EXTRACT(YEAR FROM NEW.issued_at)::int THEN
    RAISE EXCEPTION 'Année de la référence (%) incompatible avec issued_at (%).',
      v_year, NEW.issued_at USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Séquence sans gap : la valeur doit être <= last_value du compteur
  SELECT last_value INTO v_last_seq
  FROM reference_counters
  WHERE organization_id = NEW.organization_id
    AND kind = 'invoice'
    AND year = v_year;

  IF v_last_seq IS NOT NULL AND v_seq > v_last_seq THEN
    RAISE EXCEPTION 'Numéro de facture % au-delà du compteur (%). Utilisez next_reference().',
      v_seq, v_last_seq USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_invoices_validate_reference ON invoices;
CREATE TRIGGER trg_invoices_validate_reference
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoices_validate_reference();

COMMENT ON TRIGGER trg_invoices_validate_reference ON invoices IS
  'Valide le pattern FAC-YYYY-NNNNN et empêche tout numéro hors séquence.';

-- 5. Empêche toute UPDATE du numéro de référence d'une facture émise
CREATE OR REPLACE FUNCTION public.tg_invoices_lock_reference_after_issued()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.reference IS DISTINCT FROM NEW.reference AND OLD.status = 'issued' THEN
    RAISE EXCEPTION 'Modification du numéro d''une facture émise interdite (LAFT — inaltérabilité).'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_invoices_lock_reference ON invoices;
CREATE TRIGGER trg_invoices_lock_reference
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoices_lock_reference_after_issued();

COMMENT ON TRIGGER trg_invoices_lock_reference ON invoices IS
  'Inaltérabilité du numéro de facture après émission (LAFT — art. 286 I 3° bis CGI).';
