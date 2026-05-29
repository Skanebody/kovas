-- ============================================================================
-- KOVAS — Mode mission tchat : idempotence INSERT notes texte/vocal (BUG 1 P0)
-- ============================================================================
-- Calqué EXACTEMENT sur 20260528100000_mission_photos_idempotency.sql.
--
-- Correctif BUG 1 (audit terrain réseau instable) :
--   En mode Capture, les notes texte ET les transcriptions vocales étaient
--   POSTées en best-effort vers /api/dossiers/[id]/notes SANS clef
--   d'idempotence. Un rejeu de sync (timeout réseau APRÈS un INSERT réussi
--   mais AVANT réception de la réponse) crée une DEUXIÈME ligne
--   mission_text_notes → doublon de note garanti en sous-sol / vide-sanitaire.
--
--   Solution : on stocke l'UUID local Dexie de la note (`client_local_id`) et
--   on impose une contrainte UNIQUE partielle (dossier_id, client_local_id).
--   Le client passe alors d'un .insert() à un .upsert() avec onConflict sur
--   ces deux colonnes → un rejeu ne crée plus de doublon, il retombe sur la
--   même ligne (idempotent).
--
--   Partielle (WHERE client_local_id IS NOT NULL) pour ne pas casser les
--   lignes legacy insérées avant ce correctif (client_local_id à NULL) et ne
--   pas forcer la colonne NOT NULL.
--
-- 100% idempotent (ADD COLUMN IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT
-- EXISTS) — sûr à rejouer. NE PAS appliquer hors séquence de déploiement
-- (Benjamin applique en prod).
--
-- Authority : CLAUDE.md §3 features 1 + 10 (offline complet) + brief BUG 1.
-- ============================================================================

ALTER TABLE mission_text_notes
  ADD COLUMN IF NOT EXISTS client_local_id text;

COMMENT ON COLUMN mission_text_notes.client_local_id IS
  'UUID local Dexie de la note (clef idempotence sync). Permet le upsert onConflict (dossier_id, client_local_id) pour éviter les doublons en cas de rejeu réseau (timeout terrain). NULL pour les lignes legacy pré-correctif BUG 1.';

-- Index UNIQUE partiel : une seule ligne par (dossier, id local) tant que
-- client_local_id est renseigné. Les lignes legacy (NULL) sont exclues.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mtn_dossier_client_local_id
  ON mission_text_notes (dossier_id, client_local_id)
  WHERE client_local_id IS NOT NULL;
