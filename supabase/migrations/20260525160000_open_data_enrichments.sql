-- ============================================
-- KOVAS App — Module 6 : Enrichissements open data
-- Date : 2026-05-25
-- Objectif : centraliser les enrichissements récupérés depuis les APIs
--            publiques (BAN, IGN, BDNB, RNB, Géorisques, DVF) pour une
--            mission donnée. Cache mutualisé par (org, mission).
-- ============================================

CREATE TABLE open_data_enrichments (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mission_id          uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  user_id             uuid REFERENCES profiles(id) ON DELETE SET NULL,
  -- Géocodage
  latitude            numeric(9,6),
  longitude           numeric(9,6),
  ban_payload         jsonb,
  ign_payload         jsonb,
  bdnb_payload        jsonb,
  rnb_payload         jsonb,
  georisques_payload  jsonb,
  dvf_payload         jsonb,
  -- Métadonnées de fetch
  ban_fetched_at        timestamptz,
  ign_fetched_at        timestamptz,
  bdnb_fetched_at       timestamptz,
  rnb_fetched_at        timestamptz,
  georisques_fetched_at timestamptz,
  dvf_fetched_at        timestamptz,
  fetch_errors        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, mission_id)
);

COMMENT ON TABLE open_data_enrichments IS
  'Cache des enrichissements open data par mission : géocodage BAN/IGN, base BDNB, identifiant RNB, ERP Géorisques, comparables DVF. Sources publiques FR.';
COMMENT ON COLUMN open_data_enrichments.ban_payload IS
  'Réponse Base Adresse Nationale (geocodage + cadastre). Source : https://api-adresse.data.gouv.fr/';
COMMENT ON COLUMN open_data_enrichments.ign_payload IS
  'Réponse IGN (Géoplateforme : parcelle cadastrale, bâti, altimétrie). Source : https://geoservices.ign.fr/';
COMMENT ON COLUMN open_data_enrichments.bdnb_payload IS
  'Base de Données Nationale des Bâtiments (caractéristiques thermiques, étiquette DPE théorique). Source : https://bdnb.io/';
COMMENT ON COLUMN open_data_enrichments.rnb_payload IS
  'Référentiel National des Bâtiments (identifiant unique RNB). Source : https://rnb.beta.gouv.fr/';
COMMENT ON COLUMN open_data_enrichments.georisques_payload IS
  'Géorisques (ERP : risques naturels, technologiques, miniers, radon). Source : https://www.georisques.gouv.fr/';
COMMENT ON COLUMN open_data_enrichments.dvf_payload IS
  'Demandes de Valeurs Foncières (transactions immobilières publiques). Source : https://app.dvf.etalab.gouv.fr/';
COMMENT ON COLUMN open_data_enrichments.fetch_errors IS
  'Map {source: error_message} pour les sources ayant échoué (ex: timeout, 5xx, payload invalide).';

CREATE INDEX idx_open_data_org ON open_data_enrichments (organization_id);
CREATE INDEX idx_open_data_mission ON open_data_enrichments (mission_id);
CREATE INDEX idx_open_data_geo ON open_data_enrichments (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX idx_open_data_user ON open_data_enrichments (user_id);

-- Trigger updated_at
CREATE TRIGGER trg_open_data_enrichments_updated
  BEFORE UPDATE ON open_data_enrichments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE open_data_enrichments ENABLE ROW LEVEL SECURITY;
CREATE POLICY ode_select ON open_data_enrichments
  FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY ode_insert ON open_data_enrichments
  FOR INSERT WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY ode_update ON open_data_enrichments
  FOR UPDATE USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY ode_delete ON open_data_enrichments
  FOR DELETE USING (public.is_member_of(organization_id));
