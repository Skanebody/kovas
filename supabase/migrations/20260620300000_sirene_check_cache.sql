-- ============================================
-- KOVAS — Cache vérifications SIRENE (API Recherche d'Entreprises)
-- Cf. apps/web/src/lib/data-gouv/recherche-entreprises/cache.ts
-- ============================================
--
-- Stocke 7 jours les résultats `VerificationResult` (état administratif +
-- code NAF + nom entreprise) pour éviter la pression sur l'API publique
-- recherche-entreprises.api.gouv.fr (open data, sans clé).
--
-- Lecture publique : OK (open data). Écriture : service_role uniquement
-- (le wrapper TS appelle via admin client côté serveur).
--
-- `signup_anomaly` (texte libre) sur `cabinet_trials` permet de flagger
-- les inscriptions dont le NAF déclaré ne correspond pas au périmètre
-- diagnostic immobilier sans bloquer l'essai (validation manuelle admin).

-- 1. Table de cache
CREATE TABLE IF NOT EXISTS sirene_check_cache (
  siret      TEXT PRIMARY KEY,
  result     JSONB NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_sirene_check_expires
  ON sirene_check_cache (expires_at);

COMMENT ON TABLE sirene_check_cache IS
  'Cache 7j des vérifications API Recherche d''Entreprises (api.gouv.fr). Open data INSEE.';
COMMENT ON COLUMN sirene_check_cache.result IS
  'VerificationResult JSON : { found, isActive, isDiagnosticNAF, nafCode, nafLabel, companyName, legalForm, error? }';

-- 2. RLS — lecture publique (open data), écriture service_role only
ALTER TABLE sirene_check_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sirene_check_read ON sirene_check_cache;
CREATE POLICY sirene_check_read
  ON sirene_check_cache FOR SELECT
  USING (true);

DROP POLICY IF EXISTS sirene_check_write ON sirene_check_cache;
CREATE POLICY sirene_check_write
  ON sirene_check_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Extension cabinet_trials : flag d'anomalie signup (NAF mismatch, etc.)
--    Non bloquant — Benjamin valide manuellement via /admin/signup-anomalies.
ALTER TABLE cabinet_trials
  ADD COLUMN IF NOT EXISTS signup_anomaly TEXT, -- 'naf_mismatch' | NULL
  ADD COLUMN IF NOT EXISTS sirene_verified_naf TEXT,   -- ex. '71.20B'
  ADD COLUMN IF NOT EXISTS sirene_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sirene_company_name TEXT;

COMMENT ON COLUMN cabinet_trials.signup_anomaly IS
  'Flag de revue manuelle : ''naf_mismatch'' = SIRET actif mais NAF hors périmètre diagnostic immobilier.';
COMMENT ON COLUMN cabinet_trials.sirene_verified_naf IS
  'Code NAF normalisé renvoyé par l''API Recherche d''Entreprises lors du signup.';

CREATE INDEX IF NOT EXISTS idx_cabinet_trials_anomaly
  ON cabinet_trials (signup_anomaly)
  WHERE signup_anomaly IS NOT NULL;
