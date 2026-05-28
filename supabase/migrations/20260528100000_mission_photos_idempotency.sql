-- ============================================================================
-- KOVAS — Mode mission tchat : idempotence INSERT photos rafale (P0-1)
-- ============================================================================
-- Correctif P0-1 (audit terrain réseau instable) :
--   Sans clef d'idempotence côté serveur, un rejeu de sync (timeout réseau
--   APRÈS un INSERT réussi mais AVANT réception de la réponse) crée une
--   DEUXIÈME ligne mission_photos → doublon de photo garanti en sous-sol /
--   vide-sanitaire (réseau qui coupe en plein milieu).
--
--   Solution : on stocke l'UUID local Dexie de la photo (`client_local_id`)
--   et on impose une contrainte UNIQUE partielle (mission_session_id,
--   client_local_id). Le client passe alors d'un .insert() à un .upsert()
--   avec onConflict sur ces deux colonnes → un rejeu ne crée plus de doublon,
--   il retombe sur la même ligne (idempotent).
--
--   Partielle (WHERE client_local_id IS NOT NULL) pour ne pas casser les
--   éventuelles lignes legacy insérées avant ce correctif (client_local_id
--   à NULL) et ne pas forcer la colonne NOT NULL.
--
-- 100% idempotent (ADD COLUMN IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT
-- EXISTS) — sûr à rejouer. NE PAS appliquer hors séquence de déploiement.
--
-- Authority : CLAUDE.md §3 features 2 + 10 (offline complet) + MISSION-B.
-- ============================================================================

ALTER TABLE mission_photos
  ADD COLUMN IF NOT EXISTS client_local_id text;

COMMENT ON COLUMN mission_photos.client_local_id IS
  'UUID local Dexie de la photo (clef idempotence sync). Permet le upsert onConflict (mission_session_id, client_local_id) pour éviter les doublons en cas de rejeu réseau (timeout terrain). NULL pour les lignes legacy pré-correctif P0-1.';

-- Index UNIQUE partiel : une seule ligne par (session, id local) tant que
-- client_local_id est renseigné. Les lignes legacy (NULL) sont exclues.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mp_session_client_local_id
  ON mission_photos (mission_session_id, client_local_id)
  WHERE client_local_id IS NOT NULL;
