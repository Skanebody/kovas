-- ============================================================================
-- KOVAS — Storage bucket "mission-photos" : policy UPDATE (P0-2)
-- ============================================================================
-- Correctif P0-2 (audit terrain réseau instable) :
--   Le sync manager uploade avec `{ upsert: true }`. Quand un retry rejoue
--   un upload dont l'objet existe DÉJÀ dans Storage (cas réseau qui coupe
--   après le PUT mais avant la confirmation), Supabase Storage exécute un
--   UPDATE sur storage.objects (pas un INSERT). Or le bucket mission-photos
--   ne déclarait que des policies SELECT / INSERT / DELETE — PAS UPDATE.
--   Résultat : le retry est rejeté par RLS → la photo ne se synchronise
--   jamais (couplé à P0-1/P0-3 = perte).
--
--   Solution : ajouter une policy FOR UPDATE calquée EXACTEMENT sur la
--   policy INSERT existante ("mission-photos: org members upload"), c.-à-d.
--   même condition d'appartenance org (1er segment du path = organization_id).
--   On fournit USING (lecture de l'objet existant) ET WITH CHECK (validation
--   du nouvel état) avec la même condition, pour que l'upsert idempotent
--   passe le RLS.
--
-- 100% idempotent (DROP POLICY IF EXISTS puis CREATE POLICY) — sûr à rejouer.
-- NE PAS appliquer hors séquence de déploiement.
--
-- Authority : CLAUDE.md §10 RGPD + RLS, miroir de
--   20260518110000_storage_bucket_photos.sql (policy INSERT).
-- ============================================================================

DROP POLICY IF EXISTS "mission-photos: org members update" ON storage.objects;
CREATE POLICY "mission-photos: org members update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'mission-photos'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  )
  WITH CHECK (
    bucket_id = 'mission-photos'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );
