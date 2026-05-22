-- ============================================
-- KOVAS App — Détection fraude DPE (4 patterns)
-- Date : 2026-05-22
-- Lot #149 — ALGOS-BANDIT-FRAUDE (algo 2/2)
--
-- Patterns :
--  1. class_anomaly        — écart classe DPE déclarée vs caractéristiques bien
--  2. processing_velocity  — vitesse traitement anormale (trop rapide / trop lent)
--  3. geolocation_inconsistency — incohérence géoloc bien / cabinet / photos
--  4. signature_similarity — similarité textuelle commentaires entre opérateurs
--
-- Sources scrutées :
--  - missions internes (DPE produits via KOVAS)
--  - diagnostic_scans externes (DPE importés depuis Liciel ou ADEME public)
-- ============================================

-- ============================================
-- 1. Table diagnostic_scans (créée si absente)
-- Représente un DPE externe importé (PDF Liciel, base ADEME publique, etc.)
-- distinct des missions natives KOVAS.
-- ============================================
CREATE TABLE IF NOT EXISTS diagnostic_scans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  diagnostician_id uuid REFERENCES diagnosticians(id) ON DELETE SET NULL,
  source          text NOT NULL CHECK (source IN ('liciel_import', 'ademe_public', 'manual_upload', 'partner_api')),
  external_ref    text, -- N° DPE ADEME
  -- Caractéristiques bien
  property_lat    double precision,
  property_lng    double precision,
  property_address text,
  surface_m2      numeric,
  year_built      integer,
  property_type   text, -- 'house' | 'apartment'
  heating_type    text,
  insulation_level text,
  -- Résultat DPE
  declared_class  text CHECK (declared_class IN ('A','B','C','D','E','F','G')),
  energy_kwh      numeric,
  ghg_kg          numeric,
  -- Métadonnées traitement
  declared_at     timestamptz, -- date signature DPE
  scanned_at      timestamptz NOT NULL DEFAULT now(),
  raw_comments    text, -- commentaires opérateur (pattern 4)
  raw_payload     jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_diag_scans_diag
  ON diagnostic_scans(diagnostician_id)
  WHERE diagnostician_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_diag_scans_org
  ON diagnostic_scans(organization_id)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_diag_scans_declared_at
  ON diagnostic_scans(declared_at DESC);

-- ============================================
-- 2. Table fraud_signals
-- Un signal = une détection d'un pattern sur une source (mission ou scan).
-- L'agrégat (overallScore) est recalculé côté app à la lecture.
-- ============================================
CREATE TABLE IF NOT EXISTS fraud_signals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id          uuid REFERENCES missions(id) ON DELETE CASCADE,
  diagnostic_scan_id  uuid REFERENCES diagnostic_scans(id) ON DELETE CASCADE,
  pattern             text NOT NULL CHECK (pattern IN (
    'class_anomaly',
    'processing_velocity',
    'geolocation_inconsistency',
    'signature_similarity'
  )),
  severity            numeric NOT NULL CHECK (severity >= 0 AND severity <= 1),
  details             jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at         timestamptz NOT NULL DEFAULT now(),
  -- Revue manuelle admin
  reviewed_at         timestamptz,
  reviewed_by         uuid REFERENCES profiles(id),
  review_outcome      text CHECK (review_outcome IN ('confirmed_fraud', 'false_positive', 'inconclusive')),
  review_notes        text,
  CONSTRAINT one_source CHECK ((mission_id IS NULL) <> (diagnostic_scan_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_fraud_signals_mission
  ON fraud_signals(mission_id) WHERE mission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fraud_signals_scan
  ON fraud_signals(diagnostic_scan_id) WHERE diagnostic_scan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fraud_signals_pending
  ON fraud_signals(severity DESC) WHERE reviewed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fraud_signals_pattern
  ON fraud_signals(pattern, detected_at DESC);

-- ============================================
-- 3. RLS — service_role + admins uniquement
-- ============================================
ALTER TABLE diagnostic_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_signals ENABLE ROW LEVEL SECURITY;

-- Lecture diagnostic_scans : membre de l'organisation propriétaire
CREATE POLICY "diag_scans_org_read"
  ON diagnostic_scans FOR SELECT
  USING (organization_id IS NULL OR public.is_member_of(organization_id));

-- fraud_signals : pas de SELECT public.
-- L'admin /admin/audit/fraude-dpe utilise le service_role côté Route Handler.

-- ============================================
-- 4. Helper RPC — agrégation overallScore par source
-- Retourne max(severity) + count par pattern.
-- ============================================
CREATE OR REPLACE FUNCTION public.fraud_overall_score(
  p_mission_id uuid DEFAULT NULL,
  p_diagnostic_scan_id uuid DEFAULT NULL
)
RETURNS TABLE (
  overall_score numeric,
  flagged boolean,
  signal_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(MAX(severity), 0)::numeric AS overall_score,
    COALESCE(MAX(severity), 0) >= 0.7 AS flagged,
    COUNT(*)::integer AS signal_count
  FROM fraud_signals
  WHERE (p_mission_id IS NOT NULL AND mission_id = p_mission_id)
     OR (p_diagnostic_scan_id IS NOT NULL AND diagnostic_scan_id = p_diagnostic_scan_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fraud_overall_score(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fraud_overall_score(uuid, uuid) TO service_role, authenticated;

-- ============================================
-- Fin migration fraud detection
-- ============================================
