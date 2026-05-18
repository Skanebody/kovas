-- ============================================
-- KOVAS — Supabase Storage bucket "voice-notes"
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  false,
  10485760, -- 10 MB max (~ 5 min audio compressed)
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/m4a']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies (path : <org_id>/<mission_id>/<note_id>.webm)
DROP POLICY IF EXISTS "voice-notes: org members read" ON storage.objects;
CREATE POLICY "voice-notes: org members read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'voice-notes'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

DROP POLICY IF EXISTS "voice-notes: org members upload" ON storage.objects;
CREATE POLICY "voice-notes: org members upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'voice-notes'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

DROP POLICY IF EXISTS "voice-notes: org members delete" ON storage.objects;
CREATE POLICY "voice-notes: org members delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'voice-notes'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );
