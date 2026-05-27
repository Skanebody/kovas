-- ============================================
-- KOVAS — Colonne `annuaire_tier` sur diagnosticians
-- ============================================
--
-- Contexte (refonte acqui-target 2026-05) :
--   La fiche publique `/trouver-un-diagnostiqueur/[dept]/[city]/[slug]` rend
--   la carte d'intervention avec un style visuel différencié selon le tier
--   d'abonnement annuaire :
--     - free      → cercle navy discret
--     - presence  → cercle navy plus marqué (visibilité ville)
--     - boost     → cercle chartreuse animé pulse (département)
--     - premium   → 3 cercles concentriques + 3 markers villes (région)
--
--   Pour que ces 4 visualisations soient effectives, il faut la colonne en DB.
--   Tant que les souscriptions Stripe annuaire ne sont pas livrées (lot B43),
--   toutes les rows sont en `free` → comportement identique à avant, mais le
--   plumbing est prêt pour activation future en un UPDATE.
--
-- Stratégie :
--   1. ENUM PostgreSQL strict (4 valeurs) pour intégrité référentielle.
--   2. Colonne NOT NULL DEFAULT 'free' (backfill implicite des 13 856 rows).
--   3. Colonne `highlighted_cities` JSONB nullable pour les 3 villes mises en
--      avant par les abonnés Premium (markers chartreuse sur la carte).
--   4. Index BTREE sur (annuaire_tier) — utile pour les rankings annuaire.
--   5. RLS : lecture publique anon (déjà appliquée sur diagnosticians).
--
-- Cf. CLAUDE.md §4 (Track Annuaire 19/39/79) + Design System v5 §carte.

-- 1. ENUM strict (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'annuaire_tier') THEN
    CREATE TYPE public.annuaire_tier AS ENUM ('free', 'presence', 'boost', 'premium');
  END IF;
END $$;

-- 2. Colonne annuaire_tier (idempotent — re-run safe)
ALTER TABLE public.diagnosticians
  ADD COLUMN IF NOT EXISTS annuaire_tier public.annuaire_tier NOT NULL DEFAULT 'free';

COMMENT ON COLUMN public.diagnosticians.annuaire_tier IS
  'Tier d''abonnement KOVAS Annuaire (free / presence 19€ / boost 39€ / premium 79€). Détermine le rendu visuel de la carte d''intervention sur la fiche publique.';

-- 3. Colonne highlighted_cities (JSONB array<{lat,lng,name}>, max 3 entries)
--    Utilisée uniquement par les abonnés Premium pour les markers chartreuse.
ALTER TABLE public.diagnosticians
  ADD COLUMN IF NOT EXISTS highlighted_cities JSONB;

COMMENT ON COLUMN public.diagnosticians.highlighted_cities IS
  'JSONB array<{lat:number,lng:number,name:string}> — 3 villes principales mises en avant par les abonnés Premium. NULL pour les autres tiers.';

-- 4. Contrainte de cohérence : highlighted_cities seulement pour Premium
--    (soft check : Premium peut avoir NULL, mais les autres tiers DOIVENT avoir NULL)
ALTER TABLE public.diagnosticians
  DROP CONSTRAINT IF EXISTS diagnosticians_highlighted_cities_premium_only;

ALTER TABLE public.diagnosticians
  ADD CONSTRAINT diagnosticians_highlighted_cities_premium_only
  CHECK (
    highlighted_cities IS NULL
    OR annuaire_tier = 'premium'
  );

-- 5. Index BTREE pour les requêtes de ranking annuaire (filtrer par tier)
CREATE INDEX IF NOT EXISTS idx_diagnosticians_annuaire_tier
  ON public.diagnosticians (annuaire_tier)
  WHERE annuaire_tier <> 'free';

-- 6. Sanity check
DO $$
DECLARE
  v_count INTEGER;
  v_free  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.diagnosticians;
  SELECT COUNT(*) INTO v_free  FROM public.diagnosticians WHERE annuaire_tier = 'free';

  RAISE NOTICE 'diagnosticians.annuaire_tier OK : % rows (free=% ; le reste sera peuplé par le pipeline Stripe annuaire).', v_count, v_free;
END $$;
