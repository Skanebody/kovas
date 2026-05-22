-- ============================================
-- KOVAS — Supabase Advisor Fixes
-- Date : 2026-05-22
--
-- Corrige les avertissements remontés par l'Advisor Supabase :
--   1. RLS Disabled in Public (partitions events_*/photos_* + reference_counters
--      + incidents + monthly_mission_counts)
--   2. Security Definer View (monthly_mission_counts → security_invoker)
--   3. Auth RLS Initialization Plan (user_addons : auth.uid() → (SELECT auth.uid()))
--   4. Function search_path mutable (6 fonctions custom KOVAS)
--   5. Public Can Execute SECURITY DEFINER Function (REVOKE public/anon)
--   6. Unindexed foreign keys (auto-détection via pg_catalog + CREATE INDEX
--      IF NOT EXISTS sur toutes les FK simple-colonne sans index couvrant)
--
-- Items NON couverts ici (action manuelle console Supabase) :
--   - Auth → Security → Enable Leaked Password Protection
--   - Extensions postgis / pg_trgm / vector dans schéma `extensions` (risque casse
--     applicative, à valider avant migration)
--
-- Voir docs/SUPABASE-MANUAL-FIXES.md pour la liste des actions manuelles.
--
-- Cette migration est IDEMPOTENTE : re-runnable sans casser. Aucun DROP
-- non-conditionnel, aucune mutation de données utilisateur.
-- ============================================

-- ============================================
-- 1. RLS Disabled in Public — activation sur les tables non couvertes
-- ============================================

-- 1.a. Partitions events/photos
-- PostgreSQL n'active pas automatiquement RLS sur les partitions enfants quand
-- la table parente l'est. On force l'activation explicite sur chaque partition.
-- Les policies de la table parente s'appliquent automatiquement aux partitions
-- (héritage natif), il suffit donc d'activer le flag.
DO $$
DECLARE
  v_partition record;
BEGIN
  FOR v_partition IN
    SELECT c.relname AS table_name
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND p.relname IN ('photos', 'events')
      AND c.relrowsecurity = false
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_partition.table_name);
    RAISE NOTICE 'RLS activé sur partition public.%', v_partition.table_name;
  END LOOP;
END $$;

-- 1.b. reference_counters : compteur de numérotation continue per-org
-- Accès via la fonction SECURITY DEFINER `next_reference` uniquement. On
-- protège la table en lecture aux membres de l'org, écriture service_role.
ALTER TABLE public.reference_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reference_counters: org members read" ON public.reference_counters;
CREATE POLICY "reference_counters: org members read"
  ON public.reference_counters FOR SELECT
  TO authenticated
  USING (public.is_member_of(organization_id));

-- INSERT/UPDATE/DELETE : pas de policy = bloqué pour authenticated.
-- service_role bypasse RLS, donc la fonction SECURITY DEFINER continue de
-- fonctionner (elle s'exécute avec les privilèges du owner, pas du caller).

-- 1.c. incidents : status page custom (Modification 18 §14)
-- Lecture publique (banner in-app + page /status), écriture admin only.
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incidents: public read active" ON public.incidents;
CREATE POLICY "incidents: public read active"
  ON public.incidents FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "incidents: admin write" ON public.incidents;
CREATE POLICY "incidents: admin write"
  ON public.incidents FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true));

-- 1.d. spatial_ref_sys : table système PostGIS, NON modifiable.
-- L'Advisor remonte un faux positif. Ignoré intentionnellement.
-- (cf. https://postgis.net/docs/manual-3.4/using_postgis_dbmanagement.html#spatial_ref_sys)

-- ============================================
-- 2. Security Definer View → security_invoker
-- ============================================

-- monthly_mission_counts est exposée via PostgREST. En SECURITY DEFINER (défaut
-- pré-PG15), elle bypasse les RLS de la table missions sous-jacente. On la
-- recrée en security_invoker pour que les policies missions s'appliquent.
DROP VIEW IF EXISTS public.monthly_mission_counts;

CREATE VIEW public.monthly_mission_counts
WITH (security_invoker = true) AS
SELECT
  organization_id,
  date_trunc('month', created_at)::date AS month,
  COUNT(*)::int AS missions_count
FROM public.missions
WHERE deleted_at IS NULL
GROUP BY organization_id, date_trunc('month', created_at);

COMMENT ON VIEW public.monthly_mission_counts IS
  'Compteur mensuel de missions par organisation (widget transparence). '
  'security_invoker = true : applique les RLS de l''appelant sur missions.';

-- ============================================
-- 3. Auth RLS Initialization Plan — user_addons
-- ============================================

-- auth.uid() est évalué une fois par row dans une policy. (SELECT auth.uid())
-- est évalué une seule fois pour toute la requête grâce au planificateur
-- init-plan. Gain de perf significatif sur scans larges.

DROP POLICY IF EXISTS "user_addons: admin write" ON public.user_addons;
CREATE POLICY "user_addons: admin write"
  ON public.user_addons FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = true));

-- La policy "user_addons: org members read" utilise déjà public.is_member_of
-- (SECURITY DEFINER) et ne souffre pas du même problème.

-- ============================================
-- 4. Function search_path mutable
-- ============================================

-- Sans `SET search_path`, un attaquant pourrait créer un objet dans un schéma
-- antérieur dans le search_path de la session appelante et shadow une
-- fonction/table référencée par la SECURITY DEFINER. Fix : pin explicite.

DO $$
DECLARE
  v_func record;
BEGIN
  FOR v_func IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_updated_at',
        'handle_new_user',
        'subscriptions_set_updated_at',
        'bump_dossier_exported_count',
        'next_reference',
        'audit_table_changes',
        'is_member_of',
        'is_admin',
        'block_events_mutation',
        'user_addons_set_updated_at'
      )
  LOOP
    -- Force toujours search_path = public, pg_temp (override les anciens
    -- search_path = public sans pg_temp, l'Advisor exige le pg_temp).
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', v_func.sig);
    RAISE NOTICE 'search_path pin posé sur %', v_func.sig;
  END LOOP;
END $$;

-- ============================================
-- 5. Restrict EXECUTE on SECURITY DEFINER functions
-- ============================================

-- Sans REVOKE, les rôles `public` et `anon` peuvent invoquer des fonctions
-- SECURITY DEFINER, ce qui peut élever leurs privilèges. On restreint à
-- `authenticated` + `service_role` pour les fonctions custom KOVAS.

DO $$
DECLARE
  v_func record;
BEGIN
  FOR v_func IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'audit_table_changes',
        'bump_dossier_exported_count',
        'handle_new_user',
        'is_member_of',
        'is_admin',
        'next_reference',
        'block_events_mutation'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', v_func.sig);
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', v_func.sig);
    EXCEPTION WHEN undefined_object THEN
      NULL; -- rôle anon absent (env local)
    END;
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_func.sig);
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_func.sig);
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;
    RAISE NOTICE 'EXECUTE restreint sur %', v_func.sig;
  END LOOP;
END $$;

-- NOTE : fonctions PostGIS `st_estimatedextent(*)` non touchées (extension
-- système, gérée par PostGIS).

-- ============================================
-- 6. Indexes on FK columns (auto-détection introspection)
-- ============================================

-- Détecte toutes les FK simple-colonne du schéma public qui ne sont pas
-- couvertes par un index (B-tree leading column). Crée un index B-tree
-- `idx_{table}_{column}` pour chaque cas. Idempotent via IF NOT EXISTS.
--
-- Ne traite QUE les FK simple-colonne (pas les FK composites comme
-- photos.{id, created_at}). Les FK composites sont rares et leurs index
-- doivent être créés à la main avec un soin particulier (ordre des colonnes).

DO $$
DECLARE
  v_fk record;
  v_index_name text;
  v_already_indexed boolean;
BEGIN
  FOR v_fk IN
    SELECT
      n.nspname        AS schema_name,
      c.relname        AS table_name,
      a.attname        AS column_name,
      con.conname      AS constraint_name
    FROM pg_constraint con
    JOIN pg_class c        ON c.oid = con.conrelid
    JOIN pg_namespace n    ON n.oid = c.relnamespace
    JOIN pg_attribute a    ON a.attrelid = con.conrelid
                          AND a.attnum = ANY(con.conkey)
    WHERE con.contype = 'f'                  -- FK
      AND cardinality(con.conkey) = 1        -- simple-colonne only
      AND n.nspname = 'public'
      AND c.relkind = 'r'                    -- table ordinaire (pas partitionnée parente)
      AND NOT c.relispartition               -- exclut partitions (l'index parent suffit)
  LOOP
    -- Index couvrant existant ? (B-tree dont la 1re colonne est la FK)
    SELECT EXISTS (
      SELECT 1
      FROM pg_index idx
      JOIN pg_class ic ON ic.oid = idx.indexrelid
      JOIN pg_attribute ia ON ia.attrelid = idx.indrelid
                          AND ia.attnum = idx.indkey[0]
      WHERE idx.indrelid = (v_fk.schema_name || '.' || v_fk.table_name)::regclass
        AND ia.attname = v_fk.column_name
        AND idx.indpred IS NULL              -- pas un partial index
    )
    INTO v_already_indexed;

    IF NOT v_already_indexed THEN
      -- Nom d'index : tronqué à 63 caractères (limite Postgres)
      v_index_name := left('idx_' || v_fk.table_name || '_' || v_fk.column_name, 63);
      BEGIN
        EXECUTE format(
          'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%I)',
          v_index_name,
          v_fk.schema_name,
          v_fk.table_name,
          v_fk.column_name
        );
        RAISE NOTICE 'Index FK créé : %.% (col %)',
          v_fk.table_name, v_index_name, v_fk.column_name;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Echec index % sur %.% : %',
          v_index_name, v_fk.table_name, v_fk.column_name, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 7. Documentation
-- ============================================

COMMENT ON SCHEMA public IS
  'KOVAS — schéma applicatif. Fixes Supabase Advisor appliqués 2026-05-22 '
  '(migration 20260522200000). Items manuels restants (Auth Leaked Password '
  'Protection, extensions move) : voir docs/SUPABASE-MANUAL-FIXES.md.';

-- ============================================
-- FIN MIGRATION advisor fixes
-- ============================================
