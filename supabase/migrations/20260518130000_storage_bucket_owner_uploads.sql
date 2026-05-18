-- ============================================
-- KOVAS — Supabase Storage bucket "owner-uploads"
-- Bucket pour les documents uploadés par le client/propriétaire
-- via lien public token-validated (uploads serveur via service_role).
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'owner-uploads',
  'owner-uploads',
  false,
  20971520, -- 20 MB max (factures PDF, plans...)
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies : lecture pour les membres de l'org, INSERT/DELETE via service_role
DROP POLICY IF EXISTS "owner-uploads: org members read" ON storage.objects;
CREATE POLICY "owner-uploads: org members read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'owner-uploads'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

-- Pas de policy INSERT/DELETE côté client : ces opérations passent par
-- l'API route serveur qui utilise SUPABASE_SERVICE_ROLE_KEY.
