-- ============================================
-- KOVAS — Garde-fou local : récupération photo client (Modification 19)
-- ============================================
-- Crée la table `client_photo_requests` utilisée par les Edge Functions
-- `request-client-photo` et `upload-client-photo`.
--
-- Flux fonctionnel :
--   1. Diagnostiqueur déclenche depuis RecoveryActions desktop
--      → POST `/api/recovery/request-client-photo`
--   2. API route appelle l'Edge Function qui :
--      - génère un token UUID v4
--      - insère une ligne (status = 'pending', expires_at = now + 48h)
--      - envoie un SMS Brevo "{diag} demande une photo : {desc}. {url}"
--   3. Client clique le lien public `/upload-photo/[token]`
--   4. Page upload soumet la photo → Edge Function `upload-client-photo`
--      - vérifie token valide + pending + non expiré
--      - upload sur Supabase Storage (bucket missions/photos)
--      - INSERT dans `photos` (rattachement à la mission)
--      - UPDATE request.status = 'completed'
--
-- RLS :
--   - membres de l'organisation : lecture/écriture sur leurs requêtes
--   - lecture publique : uniquement via Edge Function (service role)
--     pour validation du token côté client (page upload-photo)
-- ============================================

CREATE TABLE client_photo_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id          uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token               text NOT NULL UNIQUE,
  photo_description   text NOT NULL CHECK (char_length(photo_description) >= 10),
  requested_by        uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  client_phone        text NOT NULL,
  expires_at          timestamptz NOT NULL,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
  photo_storage_path  text,
  uploaded_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Index pour lookup rapide par token (page publique upload)
CREATE INDEX idx_cpr_token_pending ON client_photo_requests (token)
  WHERE status = 'pending';

-- Index pour récupération côté mission (panel statut)
CREATE INDEX idx_cpr_mission ON client_photo_requests (mission_id);

-- Index pour cleanup périodique des expirées
CREATE INDEX idx_cpr_expires ON client_photo_requests (expires_at)
  WHERE status = 'pending';

-- ============================================
-- Trigger : updated_at sur chaque update
-- ============================================
CREATE OR REPLACE FUNCTION public.set_updated_at_client_photo_requests()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cpr_updated_at
  BEFORE UPDATE ON client_photo_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_client_photo_requests();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE client_photo_requests ENABLE ROW LEVEL SECURITY;

-- Membres de l'org : full read/write
CREATE POLICY "members read client_photo_requests"
  ON client_photo_requests FOR SELECT
  TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY "members write client_photo_requests"
  ON client_photo_requests FOR INSERT
  TO authenticated
  WITH CHECK (public.is_member_of(organization_id) AND requested_by = auth.uid());

CREATE POLICY "members update client_photo_requests"
  ON client_photo_requests FOR UPDATE
  TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

-- Note : pas de policy SELECT publique. L'accès par token (page upload-photo)
-- passe obligatoirement par une Edge Function avec service role qui vérifie
-- - status = 'pending'
-- - expires_at > now()
-- Ceci évite toute fuite massive de tokens via scan SQL injection.

COMMENT ON TABLE client_photo_requests IS
  'KOVAS Garde-fou local — demandes de photos clients via SMS, Modification 19.';
