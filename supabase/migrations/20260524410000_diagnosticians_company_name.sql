-- ============================================================================
-- KOVAS Annuaire — FIX-RR : raison sociale + audit énergétique mention
--
-- Objectif :
--   1. Ajouter `company_name text` à `diagnosticians` pour stocker la raison
--      sociale issue de la colonne `Societe` du dataset DHUP officiel
--      (data.gouv.fr / 7987214d-949e-4245-b005-5cc4e7a5df36).
--      Exemples observés CSV : "sarl cotri", "spm diagnostic - agenda 40",
--      "diag immo conseil". Cette information est ce que le particulier voit
--      quand il appelle ou cherche sur Google — plus professionnel que
--      "Raoul Chipot" (le gérant).
--
--   2. Index trigram (pg_trgm + unaccent) pour permettre la recherche
--      annuaire par nom de société sans accent + insensible à la casse.
--      Partial index `WHERE company_name IS NOT NULL` pour ne pas peser
--      sur les 30-40% de fiches indépendantes sans société (EI, EURL nom
--      propre, micro-entreprise).
--
-- Notes techniques :
--   - `unaccent()` n'étant pas `IMMUTABLE` par défaut (catalog-dependent),
--     un wrapper `immutable_unaccent()` est créé pour pouvoir s'en servir
--     dans une expression d'index. C'est le pattern recommandé Postgres
--     (cf. https://stackoverflow.com/questions/11005036).
--   - Pas de backfill SQL ici — fait par le cron `absorb-dhup-directory`
--     au prochain run, ou via `scripts/backfill-company-name-dhup.ts`.
-- ============================================================================

-- Extensions requises (déjà actives en prod, INE pour idempotence dev)
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Colonne company_name (raison sociale)
ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS company_name text;

COMMENT ON COLUMN diagnosticians.company_name IS
  'Raison sociale de la societe d''exercice (ex: "Cabinet Diag Pro 75 SARL"). Source : colonne "Societe" du dataset DHUP officiel data.gouv.fr. NULL pour les diagnostiqueurs en nom propre (EI, EURL au nom du gerant). L''UI publique prefere ce champ a full_name quand non-NULL.';

-- Wrapper IMMUTABLE pour permettre l'usage d'unaccent() dans une expression d'index.
-- unaccent() est STABLE par défaut (dépend du catalog), donc inutilisable dans
-- un index. Le wrapper force IMMUTABLE en passant explicitement le dictionnaire.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT public.unaccent('public.unaccent', $1);
$$;

-- Index trigram GIN pour recherche annuaire (search by company name)
-- Partial WHERE company_name IS NOT NULL → ne couvre que les fiches avec société.
-- unaccent + lower → matche "Cabinet Diag Pro" sur recherche "cabinet diag pro"
-- ou substring "diag pro" via trigram operator %.
CREATE INDEX IF NOT EXISTS idx_diag_company_name
  ON diagnosticians
  USING gin ((lower(public.immutable_unaccent(company_name))) gin_trgm_ops)
  WHERE company_name IS NOT NULL;

-- Index simple b-tree pour ORDER BY / GROUP BY company_name (admin dashboards)
CREATE INDEX IF NOT EXISTS idx_diag_company_name_btree
  ON diagnosticians (lower(company_name))
  WHERE company_name IS NOT NULL;
