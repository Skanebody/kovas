-- ============================================
-- KOVAS — Supabase Storage bucket "mission-photos"
-- Cf. CLAUDE.md §10 RGPD complet + RLS
-- ============================================

-- 1. Create the bucket (privé — accès via signed URL ou RLS)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mission-photos',
  'mission-photos',
  false,
  5242880, -- 5 MB max par fichier (déjà compressé WebP)
  ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies sur storage.objects pour le bucket mission-photos
-- Path convention : <organization_id>/<mission_id>/<photo_id>.webp

DROP POLICY IF EXISTS "mission-photos: org members read" ON storage.objects;
CREATE POLICY "mission-photos: org members read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'mission-photos'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

DROP POLICY IF EXISTS "mission-photos: org members upload" ON storage.objects;
CREATE POLICY "mission-photos: org members upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'mission-photos'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

DROP POLICY IF EXISTS "mission-photos: org members delete" ON storage.objects;
CREATE POLICY "mission-photos: org members delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'mission-photos'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );
