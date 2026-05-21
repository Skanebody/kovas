-- ============================================
-- KOVAS — B2C quote requests sur fiches publiques diagnostiqueurs
-- Pré-requis : table `diagnosticians` créée par migration A1 (cohabitation parallèle)
-- ============================================

CREATE TABLE IF NOT EXISTS quote_requests (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostician_id         uuid NOT NULL REFERENCES diagnosticians(id) ON DELETE CASCADE,

  -- Contact requester (anonyme B2C, particulier ou pro)
  requester_first_name     text NOT NULL,
  requester_last_name      text NOT NULL,
  requester_email          text NOT NULL,
  requester_phone          text,             -- E.164 optionnel
  -- Bien
  property_type            text NOT NULL CHECK (property_type IN ('maison', 'appartement', 'local_commercial', 'autre')),
  property_situation       text NOT NULL CHECK (property_situation IN ('vente', 'location', 'travaux', 'audit')),
  property_address         text,
  property_postal_code     text,
  property_city            text,
  property_surface_m2      int,
  property_year_built      int,
  property_geo_lat         double precision,
  property_geo_lng         double precision,

  -- Diagnostics demandés (codes : DPE, AMIANTE, PLOMB, GAZ, ELEC, TERMITES, CARREZ, BOUTIN, ERP)
  diagnostics_requested    text[] NOT NULL DEFAULT '{}',
  -- Détection auto KOVAS (suggérés vs demandés) — jsonb [{ type, required, reason }]
  diagnostics_suggested    jsonb,

  -- Message libre
  message                  text,

  -- Statut funnel diag
  status                   text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'quoted', 'won', 'lost', 'spam')),

  -- Notif diag
  diag_notified_at         timestamptz,
  diag_responded_at        timestamptz,

  -- Anti-spam (CLAUDE.md §10 RGPD : IP + UA conservés pour défense uniquement)
  ip_address               inet,
  user_agent               text,
  honeypot_filled          boolean DEFAULT false,
  recaptcha_score          numeric(3,2),

  -- Audit
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_req_diag
  ON quote_requests(diagnostician_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_req_email
  ON quote_requests(requester_email);

COMMENT ON TABLE quote_requests IS
  'Demandes de devis B2C/B2B reçues par les diagnostiqueurs via leur fiche publique kovas.fr/diagnostiqueurs/[dept]/[city]/[slug].';
COMMENT ON COLUMN quote_requests.diagnostics_suggested IS
  'Auto-détection KOVAS [{ type, required, reason }] selon situation/année/type bien (cf. computeRequiredDiagnostics).';
COMMENT ON COLUMN quote_requests.honeypot_filled IS
  'true si le champ honeypot caché a été rempli — bot probable, à filtrer côté admin.';

-- ============================================
-- RLS — anon peut insérer, diag claimé peut lire
-- ============================================
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

-- Le formulaire public est anon → insert sans contrainte (anti-spam au niveau application)
DROP POLICY IF EXISTS "quote_requests_anon_insert" ON quote_requests;
CREATE POLICY "quote_requests_anon_insert"
  ON quote_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Service role idem (route handler côté serveur passe par admin client)
DROP POLICY IF EXISTS "quote_requests_service_insert" ON quote_requests;
CREATE POLICY "quote_requests_service_insert"
  ON quote_requests
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Diagnostiqueur ayant réclamé sa fiche peut lire ses propres demandes
DROP POLICY IF EXISTS "quote_requests_diag_claimed_read" ON quote_requests;
CREATE POLICY "quote_requests_diag_claimed_read"
  ON quote_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM diagnosticians d
      WHERE d.id = diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  );

-- Diag peut mettre à jour le statut de ses demandes (pending → contacted/quoted/won/lost/spam)
DROP POLICY IF EXISTS "quote_requests_diag_claimed_update" ON quote_requests;
CREATE POLICY "quote_requests_diag_claimed_update"
  ON quote_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM diagnosticians d
      WHERE d.id = diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM diagnosticians d
      WHERE d.id = diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  );

-- ============================================
-- Trigger updated_at
-- ============================================
CREATE OR REPLACE FUNCTION set_updated_at_quote_requests()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quote_requests_updated_at ON quote_requests;
CREATE TRIGGER trg_quote_requests_updated_at
  BEFORE UPDATE ON quote_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_quote_requests();

-- ============================================
-- Rate limiting helper (anti-spam IP-based, 5 demandes/heure max)
-- ============================================
CREATE OR REPLACE FUNCTION check_quote_request_rate_limit(p_ip inet, p_window_minutes int DEFAULT 60)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM quote_requests
  WHERE ip_address = p_ip
    AND created_at > (now() - (p_window_minutes || ' minutes')::interval)
$$;

COMMENT ON FUNCTION check_quote_request_rate_limit IS
  'Retourne le nb de demandes envoyées depuis une IP sur la fenêtre passée (rate limit anti-spam).';
