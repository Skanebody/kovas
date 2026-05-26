-- ============================================================================
-- Observatoire — Prix médians par type de diagnostic
-- ============================================================================
-- Étend `observatoire_live_stats` avec une colonne JSONB qui stocke le prix
-- médian des 8 diagnostics standards (DPE + amiante + plomb + gaz + élec +
-- termites + Carrez/Boutin + ERP) au lieu du seul DPE actuel.
--
-- Forme attendue du JSONB :
--   {
--     "dpe": 175.00,
--     "amiante": 145.00,
--     "plomb": 115.00,
--     "gaz": 110.00,
--     "electricite": 115.00,
--     "termites": 95.00,
--     "carrez": 90.00,
--     "erp": 35.00
--   }
--
-- La colonne reste nullable : les rows historiques sans backfill resteront
-- visibles côté UI avec un fallback gracieux vers le référentiel mocké.
-- L'Edge Function `observatoire-stats-refresh` est étendue pour la peupler
-- mensuellement (variation déterministe ~1,5%/mois en V1, mesures réelles
-- KOVAS quand le volume sera suffisant en V2).
-- ============================================================================

ALTER TABLE public.observatoire_live_stats
  ADD COLUMN IF NOT EXISTS prices_by_type jsonb;

COMMENT ON COLUMN public.observatoire_live_stats.prices_by_type IS
  'KOVAS — prix médians par type de diagnostic en € TTC : { dpe, amiante, plomb, gaz, electricite, termites, carrez, erp }. NULL = fallback référentiel mocké côté UI.';
