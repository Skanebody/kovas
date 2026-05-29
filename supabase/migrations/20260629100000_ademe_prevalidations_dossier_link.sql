-- ============================================
-- KOVAS — Pré-validation ADEME : lier au DOSSIER (et non plus à l'ancienne
-- table `missions`, renommée en `dossiers` le 2026-05-18).
--
-- Contexte : `ademe_prevalidations.mission_id` référençait `missions(id)`,
-- table legacy désormais vide. Les dossiers réels vivent dans `dossiers`.
-- Conséquence : impossible de persister une prévalidation depuis un dossier.
--
-- Correctif : ajout d'une colonne `dossier_id` (FK → dossiers) + assouplissement
-- de `mission_id` (NULL autorisé, conservée pour rétro-compat / legacy). Les
-- nouvelles prévalidations utilisent `dossier_id`.
-- ============================================

ALTER TABLE ademe_prevalidations
  ADD COLUMN IF NOT EXISTS dossier_id uuid REFERENCES dossiers(id) ON DELETE CASCADE;

-- mission_id n'est plus obligatoire (le flux courant écrit dossier_id).
ALTER TABLE ademe_prevalidations
  ALTER COLUMN mission_id DROP NOT NULL;

-- Index pour récupérer la dernière prévalidation d'un dossier (badge statut).
CREATE INDEX IF NOT EXISTS idx_prevalidations_dossier
  ON ademe_prevalidations (dossier_id, created_at DESC)
  WHERE dossier_id IS NOT NULL;

-- Au moins un rattachement (dossier OU mission legacy) doit être présent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ademe_prevalidations_target_chk'
  ) THEN
    ALTER TABLE ademe_prevalidations
      ADD CONSTRAINT ademe_prevalidations_target_chk
      CHECK (dossier_id IS NOT NULL OR mission_id IS NOT NULL);
  END IF;
END $$;

COMMENT ON COLUMN ademe_prevalidations.dossier_id IS
  'Dossier source de la prévalidation (table dossiers). Remplace mission_id depuis 2026-06.';
