-- ===========================================================================
-- KOVAS — Hardening sécurité 2026-05-27 (Agent B SECURITY-AUDIT)
-- ===========================================================================
-- À jouer manuellement en prod après revue Benjamin. Defense-in-depth.
-- Audit complet : docs/security/SECURITY-AUDIT-2026-05-27.md
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Pin search_path sur TOUTES les fonctions SECURITY DEFINER non pinées
-- ---------------------------------------------------------------------------
-- Audit Agent B : 27 fonctions SECURITY DEFINER sans search_path explicite,
-- non couvertes par le DO block de 20260526220300_supabase_advisor_fixes.sql.
-- Risque : injection de schema (un attaquant ayant CREATE sur public peut
-- shadowing une fonction et exécuter du code dans le contexte de la SECURITY
-- DEFINER, élevant privilèges).
--
-- Ce DO block ALTER toutes les fonctions prosecdef=true du schéma public
-- qui n'ont PAS déjà un search_path pinné dans leur proconfig.

DO $$
DECLARE
  v_func record;
  v_count int := 0;
BEGIN
  FOR v_func IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', v_func.sig);
    v_count := v_count + 1;
    RAISE NOTICE 'Pinned search_path on function: %', v_func.sig;
  END LOOP;
  RAISE NOTICE 'Total fonctions ALTER : %', v_count;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Sécuriser schémas data.* et analytics.* (defense-in-depth)
-- ---------------------------------------------------------------------------
-- Audit Agent B (E2) : data.* et analytics.* ont GRANT USAGE à anon depuis
-- 20260526220900_data_lake_schemas.sql. Mitigation actuelle = config.toml
-- whitelist `schemas = ["public", "storage"]` qui empêche l'exposition
-- PostgREST. Mais c'est fragile : si quelqu'un ajoute `data` au schemas array,
-- exposition immédiate de millions de lignes DPE/cadastre/DVF.
--
-- Fix : REVOKE USAGE FROM anon + activer RLS service_role only sur tables
-- data.* et analytics.*.

REVOKE USAGE ON SCHEMA data FROM anon;
REVOKE USAGE ON SCHEMA analytics FROM anon;

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname IN ('data', 'analytics')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', t.schemaname, t.tablename);
    -- Drop any existing wide-open policy first (idempotent)
    EXECUTE format(
      'DROP POLICY IF EXISTS service_only ON %I.%I',
      t.schemaname, t.tablename
    );
    EXECUTE format(
      'CREATE POLICY service_only ON %I.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t.schemaname, t.tablename
    );
    RAISE NOTICE 'RLS activée + service_role only sur %.%', t.schemaname, t.tablename;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Bloquer DELETE sur invoices (rétention 10y Code Commerce L123-22)
-- ---------------------------------------------------------------------------
-- Audit Agent B (M3) : la policy "members crud invoices" autorise DELETE
-- via FOR ALL. Un user compromis pourrait supprimer ses factures, ce qui
-- viole l'obligation de rétention 10 ans (Code de Commerce L123-22 + DGFiP).
--
-- Fix : remplacer la policy unique FOR ALL par 3 policies séparées
-- (SELECT/INSERT/UPDATE) + 1 policy DELETE qui refuse à tous les rôles
-- non-service.

-- Drop existing policy (s'il existe)
DROP POLICY IF EXISTS "members crud invoices" ON public.invoices;
DROP POLICY IF EXISTS "members select invoices" ON public.invoices;
DROP POLICY IF EXISTS "members insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "members update invoices" ON public.invoices;
DROP POLICY IF EXISTS "block invoice delete" ON public.invoices;
DROP POLICY IF EXISTS "block invoice delete authenticated" ON public.invoices;

CREATE POLICY "members select invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY "members insert invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members update invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

-- Bloque DELETE pour tous les rôles client-side
CREATE POLICY "block invoice delete authenticated" ON public.invoices
  FOR DELETE TO authenticated
  USING (false);

-- service_role conserve son accès via bypass RLS (admin jobs cleanup)
COMMENT ON TABLE public.invoices IS
  'Rétention 10 ans obligatoire (Code Commerce L123-22, DGFiP). DELETE bloqué via RLS pour tous les rôles client-side. Soft-delete via colonne deleted_at si besoin.';

-- ---------------------------------------------------------------------------
-- 4. Sanity check final
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_unpinned int;
  v_data_anon int;
  v_invoice_delete_policies int;
BEGIN
  -- Vérifie qu'aucune SECURITY DEFINER de public n'est sans search_path
  SELECT COUNT(*) INTO v_unpinned
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND NOT EXISTS (
      SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
      WHERE cfg LIKE 'search_path=%'
    );

  -- Vérifie anon n'a plus USAGE sur data/analytics
  SELECT COUNT(*) INTO v_data_anon
  FROM information_schema.usage_privileges
  WHERE grantee = 'anon' AND object_schema IN ('data', 'analytics');

  -- Vérifie policy bloquant DELETE invoices existe
  SELECT COUNT(*) INTO v_invoice_delete_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'invoices' AND cmd = 'DELETE';

  RAISE NOTICE '✓ Hardening résultat : % fonctions SECURITY DEFINER non pinées (cible 0), % grants anon sur data/analytics (cible 0), % policy DELETE sur invoices (cible 1)',
    v_unpinned, v_data_anon, v_invoice_delete_policies;

  IF v_unpinned > 0 THEN
    RAISE WARNING 'Reste % fonctions SECURITY DEFINER sans search_path', v_unpinned;
  END IF;
  IF v_data_anon > 0 THEN
    RAISE WARNING 'Reste % grants anon sur data/analytics', v_data_anon;
  END IF;
  IF v_invoice_delete_policies < 1 THEN
    RAISE WARNING 'Policy DELETE block invoices manquante';
  END IF;
END $$;
