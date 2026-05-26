-- Cache RNB (Référentiel National des Bâtiments) + BDNB CSTB
-- -----------------------------------------------------------------------------
-- Pré-remplissage automatique des fiches biens depuis l'open data officiel État.
-- TTL applicatif : 30j (les bâtiments changent peu). Lecture publique car données
-- 100 % open data (Licence Etalab 2.0 + ODbL). Écriture restreinte service_role.
--
-- Sources :
--   - RNB  : https://rnb-api.beta.gouv.fr (beta.gouv, Cerema/IGN, Etalab 2.0)
--   - BDNB : https://api-portail.bdnb.io  (CSTB, ODbL pour subset Open)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rnb_cache (
  rnb_id            text PRIMARY KEY,
  point             geography(Point, 4326) NOT NULL,
  raw_data          jsonb NOT NULL,
  bdnb_enrichment   jsonb,
  fetched_at        timestamptz NOT NULL DEFAULT now(),
  bdnb_fetched_at   timestamptz
);

COMMENT ON TABLE  public.rnb_cache IS 'Cache RNB + BDNB. TTL applicatif 30j. Données open data, lecture publique.';
COMMENT ON COLUMN public.rnb_cache.rnb_id          IS 'Identifiant RNB pivot national (12 caractères alphanum).';
COMMENT ON COLUMN public.rnb_cache.point           IS 'Centroïde bâtiment en WGS84 (EPSG:4326).';
COMMENT ON COLUMN public.rnb_cache.raw_data        IS 'Payload RNB brut JSON (addresses, status, ext_ids...).';
COMMENT ON COLUMN public.rnb_cache.bdnb_enrichment IS 'Payload BDNB Open brut JSON (année construction, matériaux, DPE consolidé...).';

CREATE INDEX IF NOT EXISTS rnb_cache_point_gix     ON public.rnb_cache USING GIST (point);
CREATE INDEX IF NOT EXISTS rnb_cache_fetched_at_ix ON public.rnb_cache (fetched_at);

-- -----------------------------------------------------------------------------
-- RLS : open data → lecture publique, écriture service_role uniquement
-- -----------------------------------------------------------------------------
ALTER TABLE public.rnb_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rnb_cache_read  ON public.rnb_cache;
DROP POLICY IF EXISTS rnb_cache_write ON public.rnb_cache;

CREATE POLICY rnb_cache_read
  ON public.rnb_cache
  FOR SELECT
  USING (true);

CREATE POLICY rnb_cache_write
  ON public.rnb_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
