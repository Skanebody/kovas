-- ============================================================================
-- KOVAS — Mode mission tchat : idempotence INSERT voice_notes offline (BUG 2 P0)
-- ============================================================================
-- Calqué sur 20260528100000_mission_photos_idempotency.sql.
--
-- Correctif BUG 2 (audit terrain réseau instable) :
--   En mode Capture, le blob audio n'était persisté NULLE PART (seul
--   l'objectURL local existait, révoqué au unmount). Si la transcription
--   échouait offline, l'audio ET le texte étaient perdus.
--
--   La queue offline notes (mission-notes-offline-store) stocke désormais le
--   blob audio AVANT tout appel réseau et le rejoue à `online` via
--   /api/transcribe (qui INSERT voice_notes). Sans clef d'idempotence, un
--   rejeu de ce flux (réponse réseau perdue après transcription réussie) crée
--   une 2e ligne voice_notes → doublon de note vocale.
--
--   Solution : on stocke l'UUID local Dexie de la note (`client_local_id`) et
--   on impose une contrainte UNIQUE partielle (dossier_id, client_local_id).
--   La route /api/transcribe passe alors d'un .insert() à un .upsert() sur ces
--   deux colonnes quand le client fournit `clientLocalId` → un rejeu retombe
--   sur la même ligne (idempotent). Sans clef (mode normal en ligne), le
--   comportement reste un INSERT classique (client_local_id NULL).
--
-- 100% idempotent (ADD COLUMN IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT
-- EXISTS) — sûr à rejouer. NE PAS appliquer hors séquence de déploiement
-- (Benjamin applique en prod).
--
-- Authority : CLAUDE.md §3 features 1 + 10 (offline complet) + brief BUG 2.
-- ============================================================================

ALTER TABLE voice_notes
  ADD COLUMN IF NOT EXISTS client_local_id text;

COMMENT ON COLUMN voice_notes.client_local_id IS
  'UUID local Dexie de la note vocale (clef idempotence sync offline). Permet le upsert onConflict (dossier_id, client_local_id) pour éviter les doublons en cas de rejeu réseau (timeout terrain). NULL pour les notes vocales du mode en ligne classique (INSERT direct).';

-- Index UNIQUE partiel : une seule ligne par (dossier, id local) tant que
-- client_local_id est renseigné. Les lignes legacy / mode online (NULL) sont
-- exclues.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vn_dossier_client_local_id
  ON voice_notes (dossier_id, client_local_id)
  WHERE client_local_id IS NOT NULL;
