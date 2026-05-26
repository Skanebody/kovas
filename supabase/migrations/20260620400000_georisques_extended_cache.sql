-- ============================================================================
-- KOVAS — Cache tables Géorisques étendu (Radon / PPRI / Argiles / Cavités)
-- Date : 2026-06-20
-- Authority : docs/data-gouv-opportunities.md §3 Top #3 + CLAUDE.md §3 ERP étendu.
--
-- Objectif : éviter d'appeler l'API Géorisques à chaque vue de fiche dossier.
-- Les arrêtés Géorisques évoluent peu (mises à jour mensuelles à annuelles)
-- → TTL applicatif de 30 jours côté lecture.
--
-- Granularités :
--   - radon / PPRI : clé = code_insee (commune)
--   - argiles / cavités : clé = geohash 7 caractères (~150m de précision,
--     suffisant pour la déclaration IAL — l'aléa argile/cavité varie peu
--     à cette échelle, et regrouper réduit drastiquement le cache miss).
--
-- Lecture publique (`anon` peut consulter via wrappers RPC ou endpoints
-- métier — utile pour pages SEO commune + dossier client). Écriture
-- réservée à `service_role` (Edge Functions cron + serveur Next).
-- ============================================================================

-- ─── 1. Radon (par commune) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.georisques_radon_cache (
  code_insee TEXT PRIMARY KEY,
  classe SMALLINT NOT NULL CHECK (classe BETWEEN 1 AND 3),
  obligation_ial BOOLEAN NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_grc_radon_fetched_at
  ON public.georisques_radon_cache (fetched_at DESC);

COMMENT ON TABLE public.georisques_radon_cache IS
  'Cache du potentiel radon par commune (Géorisques + IRSN). TTL applicatif 30j. Classe 3 = obligation IAL.';

-- ─── 2. PPRI (par commune) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.georisques_ppri_cache (
  code_insee TEXT PRIMARY KEY,
  plans JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_grc_ppri_fetched_at
  ON public.georisques_ppri_cache (fetched_at DESC);

COMMENT ON TABLE public.georisques_ppri_cache IS
  'Cache des Plans de Prévention Risque Inondation (Gaspar) par commune. `plans` est une JSON array de PPRIResult (id, libelle, etat, dateApprobation, url).';

-- ─── 3. Argiles (par geohash 7) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.georisques_argiles_cache (
  geohash TEXT PRIMARY KEY,
  alea TEXT NOT NULL CHECK (alea IN ('faible', 'moyen', 'fort')),
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_grc_argiles_fetched_at
  ON public.georisques_argiles_cache (fetched_at DESC);

COMMENT ON TABLE public.georisques_argiles_cache IS
  'Cache aléa retrait-gonflement argiles par geohash 7 (~150m). Moyen/fort = obligation IAL.';

-- ─── 4. Cavités souterraines (par geohash 7) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.georisques_cavites_cache (
  geohash TEXT PRIMARY KEY,
  cavites JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_grc_cavites_fetched_at
  ON public.georisques_cavites_cache (fetched_at DESC);

COMMENT ON TABLE public.georisques_cavites_cache IS
  'Cache des cavités souterraines connues par geohash 7. `cavites` = JSON array de Cavite (id, type, libelle, distanceM).';

-- ============================================================================
-- 5. RLS — lecture publique, écriture service-role uniquement
-- ============================================================================

ALTER TABLE public.georisques_radon_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.georisques_ppri_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.georisques_argiles_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.georisques_cavites_cache ENABLE ROW LEVEL SECURITY;

-- ── Radon ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS radon_read ON public.georisques_radon_cache;
CREATE POLICY radon_read ON public.georisques_radon_cache
  FOR SELECT USING (true);

DROP POLICY IF EXISTS radon_write ON public.georisques_radon_cache;
CREATE POLICY radon_write ON public.georisques_radon_cache
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- ── PPRI ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS ppri_read ON public.georisques_ppri_cache;
CREATE POLICY ppri_read ON public.georisques_ppri_cache
  FOR SELECT USING (true);

DROP POLICY IF EXISTS ppri_write ON public.georisques_ppri_cache;
CREATE POLICY ppri_write ON public.georisques_ppri_cache
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- ── Argiles ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS argiles_read ON public.georisques_argiles_cache;
CREATE POLICY argiles_read ON public.georisques_argiles_cache
  FOR SELECT USING (true);

DROP POLICY IF EXISTS argiles_write ON public.georisques_argiles_cache;
CREATE POLICY argiles_write ON public.georisques_argiles_cache
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- ── Cavités ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS cavites_read ON public.georisques_cavites_cache;
CREATE POLICY cavites_read ON public.georisques_cavites_cache
  FOR SELECT USING (true);

DROP POLICY IF EXISTS cavites_write ON public.georisques_cavites_cache;
CREATE POLICY cavites_write ON public.georisques_cavites_cache
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- ============================================================================
-- 6. Grants
-- ============================================================================
GRANT SELECT ON public.georisques_radon_cache TO anon, authenticated;
GRANT SELECT ON public.georisques_ppri_cache TO anon, authenticated;
GRANT SELECT ON public.georisques_argiles_cache TO anon, authenticated;
GRANT SELECT ON public.georisques_cavites_cache TO anon, authenticated;

GRANT ALL ON public.georisques_radon_cache TO service_role;
GRANT ALL ON public.georisques_ppri_cache TO service_role;
GRANT ALL ON public.georisques_argiles_cache TO service_role;
GRANT ALL ON public.georisques_cavites_cache TO service_role;
