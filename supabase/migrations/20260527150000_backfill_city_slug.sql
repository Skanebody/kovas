-- ============================================
-- KOVAS — Backfill `diagnosticians.city_slug` NULL + trigger auto-set
-- ============================================
--
-- Contexte (refonte acqui-target 2026-05) :
--   Les fiches publiques `/trouver-un-diagnostiqueur/[dept]/[city]/[slug]`
--   utilisent `city_slug` dans l'URL canonique + le JSON-LD SEO. Quand la
--   colonne est NULL (cas de Hugo Tanguy par ex.), le code retombait sur
--   le sentinel littéral 'inconnu', cassant le SEO et faisant remonter des
--   404 dans la Search Console.
--
-- Stratégie :
--   1. Fonction `kovas_slugify(text)` PL/pgSQL IMMUTABLE — slug ASCII safe.
--      Utilise `public.immutable_unaccent` déjà déployée (migration
--      20260524340000) pour normaliser les accents.
--   2. UPDATE backfill : si `city_slug` NULL et `city` non-NULL → slugify(city).
--                       sinon 'commune-non-precisee'.
--   3. Trigger BEFORE INSERT OR UPDATE pour auto-set si NULL et `city`
--      non-NULL (évite la re-régression).
--
-- Cf. CLAUDE.md §10 (architecture i18n + slugs).

-- 1. Fonction slugify SQL (utilise immutable_unaccent déjà dispo)
CREATE OR REPLACE FUNCTION public.kovas_slugify(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    CASE
      WHEN input_text IS NULL OR length(trim(input_text)) = 0 THEN NULL
      ELSE
        -- 1) unaccent → lowercase
        -- 2) remplace tout caractère non [a-z0-9] par '-'
        -- 3) collapse multi '-' en un seul
        -- 4) trim '-' aux extrémités
        trim(BOTH '-' FROM
          regexp_replace(
            regexp_replace(
              lower(public.immutable_unaccent(input_text)),
              '[^a-z0-9]+',
              '-',
              'g'
            ),
            '-+',
            '-',
            'g'
          )
        )
    END
$$;

COMMENT ON FUNCTION public.kovas_slugify(text) IS
  'Slug ASCII safe pour URLs publiques annuaire. Utilise immutable_unaccent.';

-- 2. Backfill des city_slug NULL
-- On évite de tirer les rows déjà OK pour limiter le bruit dans les logs.
UPDATE public.diagnosticians
SET city_slug = COALESCE(
  NULLIF(public.kovas_slugify(city), ''),
  'commune-non-precisee'
)
WHERE city_slug IS NULL OR length(trim(city_slug)) = 0;

-- 3. Trigger auto-set city_slug si NULL au INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.diagnosticians_autoset_city_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.city_slug IS NULL OR length(trim(NEW.city_slug)) = 0 THEN
    NEW.city_slug := COALESCE(
      NULLIF(public.kovas_slugify(NEW.city), ''),
      'commune-non-precisee'
    );
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.diagnosticians_autoset_city_slug() IS
  'Auto-set diagnosticians.city_slug si NULL ou vide — alimenté depuis city.';

DROP TRIGGER IF EXISTS trg_diagnosticians_autoset_city_slug ON public.diagnosticians;
CREATE TRIGGER trg_diagnosticians_autoset_city_slug
  BEFORE INSERT OR UPDATE ON public.diagnosticians
  FOR EACH ROW
  EXECUTE FUNCTION public.diagnosticians_autoset_city_slug();

-- 4. Sanity check / report (visible dans la console SQL Supabase)
DO $$
DECLARE
  v_remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM public.diagnosticians
  WHERE city_slug IS NULL OR length(trim(city_slug)) = 0;

  IF v_remaining > 0 THEN
    RAISE WARNING 'Backfill incomplete: % diagnosticians rows still have NULL/empty city_slug', v_remaining;
  ELSE
    RAISE NOTICE 'Backfill OK — toutes les lignes diagnosticians ont un city_slug.';
  END IF;
END $$;
