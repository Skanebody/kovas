-- ============================================
-- KOVAS — Branding cabinet par organisation
--   1. Colonnes additionnelles sur `organizations` :
--      - logo_url        : chemin Supabase Storage du logo (jamais data-URL)
--      - logo_mime       : mime type validé (png | svg+xml | jpeg)
--      - brand_color_hex : couleur principale cabinet (#RRGGBB)
--      - brand_updated_at: dernière modification branding (logo OU couleur)
--   2. Bucket Supabase Storage `org-branding` (privé, signed URL only)
--   3. RLS policies storage.objects : un membre de l'org ne lit/écrit que dans
--      `org-branding/<son_orgId>/*` (helper public.is_member_of(uuid)).
--
--  Path convention : `<organization_id>/logo.<ext>` — un seul logo par org,
--  upsert à chaque ré-upload (overwrite). Les PDF devis/factures générés
--  consommeront ces données via le helper
--  `apps/web/src/lib/branding/get-organization-branding.ts`.
-- ============================================

-- ────────────────────────────────────────────────────────────
-- 1. Colonnes branding sur organizations
-- ────────────────────────────────────────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS logo_url         text,
  ADD COLUMN IF NOT EXISTS logo_mime        text
    CHECK (logo_mime IS NULL OR logo_mime IN ('image/png', 'image/svg+xml', 'image/jpeg')),
  ADD COLUMN IF NOT EXISTS brand_color_hex  text NOT NULL DEFAULT '#0F1419'
    CHECK (brand_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN IF NOT EXISTS brand_updated_at timestamptz;

COMMENT ON COLUMN organizations.logo_url IS
  'Chemin Supabase Storage du logo cabinet (bucket org-branding). NULL = pas de logo. Convention : <org_id>/logo.<ext>. Servi via signed URL 24h.';
COMMENT ON COLUMN organizations.logo_mime IS
  'Mime type du logo. Whitelist : image/png, image/svg+xml, image/jpeg. NULL si pas de logo.';
COMMENT ON COLUMN organizations.brand_color_hex IS
  'Couleur principale du cabinet utilisée pour les filets et accents sur devis/factures PDF. Format strict #RRGGBB. Default = noir KOVAS #0F1419.';
COMMENT ON COLUMN organizations.brand_updated_at IS
  'Timestamp dernière modification branding (logo OU couleur). Sert au cache-busting des PDF générés.';

-- ────────────────────────────────────────────────────────────
-- 2. Bucket Supabase Storage `org-branding`
-- ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-branding',
  'org-branding',
  false,
  2097152, -- 2 MiB max par fichier (logo cabinet, validé côté client + serveur)
  ARRAY['image/png', 'image/svg+xml', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 3. RLS policies sur storage.objects pour `org-branding`
--    Path convention : <organization_id>/logo.<ext>
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "org-branding: org members read" ON storage.objects;
CREATE POLICY "org-branding: org members read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'org-branding'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

DROP POLICY IF EXISTS "org-branding: org members upload" ON storage.objects;
CREATE POLICY "org-branding: org members upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'org-branding'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

DROP POLICY IF EXISTS "org-branding: org members update" ON storage.objects;
CREATE POLICY "org-branding: org members update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'org-branding'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

DROP POLICY IF EXISTS "org-branding: org members delete" ON storage.objects;
CREATE POLICY "org-branding: org members delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'org-branding'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );
