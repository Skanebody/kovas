-- Migration 20260520150000 — multi-source import (Liciel / AnalysImmo / OBBC / ORIS / Autre)
--
-- Contexte : la feature « Import Liciel » (commits 20260519/20260520) est en réalité
-- agnostique du logiciel diag source (pipeline parser CSV → normalizer → deduper → RPC
-- commit). On rebrand en multi-source pour couvrir ~90 % du marché diag FR :
--   - Liciel ............... 40-52 % PdM (mappings spécifiques en V1)
--   - AnalysImmo ........... 15-20 % PdM (mappings à compléter — fallback Claude Haiku)
--   - OBBC ................. 10-15 % PdM (idem)
--   - ORIS .................  5-10 % PdM (idem)
--   - Autre logiciel ........ fallback Claude Haiku 100 %
--
-- Cf. CLAUDE.md §1 et §13. Le bucket Storage `import-liciel-staging` reste inchangé
-- (nom technique invisible côté UI) pour éviter une migration storage destructrice.

ALTER TABLE import_jobs
  ADD COLUMN source_logiciel text NOT NULL DEFAULT 'autre'
  CHECK (source_logiciel IN ('liciel', 'analysimmo', 'obbc', 'oris', 'autre'));

CREATE INDEX idx_import_jobs_source ON import_jobs(source_logiciel);

COMMENT ON COLUMN import_jobs.source_logiciel IS
  'Logiciel diag source : liciel | analysimmo | obbc | oris | autre. Détermine le mapping headers utilisé par le parser et le tuto affiché.';
