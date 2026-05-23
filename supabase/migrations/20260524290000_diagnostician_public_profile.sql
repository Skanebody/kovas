-- ============================================================
-- KOVAS — Profil public diagnostiqueur éditable
--
-- Permet aux diagnostiqueurs ayant revendiqué leur fiche
-- (claimed_by_user_id = auth.uid()) d'éditer les éléments
-- "marketing" affichés publiquement sur l'annuaire.
--
-- Les champs réglementaires (certifications COFRAC, RC Pro,
-- Sirene, etc.) restent gérés par les pipelines de validation
-- — ils ne sont PAS éditables ici.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.diagnostician_public_profile (
  diagnostician_id     uuid PRIMARY KEY REFERENCES public.diagnosticians(id) ON DELETE CASCADE,
  bio_short            text,
  bio_long             text,
  intervention_zones   jsonb NOT NULL DEFAULT '[]'::jsonb,  -- ['paris', 'boulogne-billancourt', …]
  opening_hours        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {mon: {open: '08:00', close: '18:00'}, …}
  specialties          jsonb NOT NULL DEFAULT '[]'::jsonb,  -- ['DPE', 'AMIANTE', …]
  indicative_prices    jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {DPE_apt_T2: 12000, …}  (centimes)
  profile_photo_url    text,
  portfolio_photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bio_short_length CHECK (char_length(coalesce(bio_short, '')) <= 300),
  CONSTRAINT bio_long_length  CHECK (char_length(coalesce(bio_long,  '')) <= 2000)
);

-- Trigger updated_at automatique
CREATE OR REPLACE FUNCTION public.set_diagnostician_public_profile_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dpp_updated_at ON public.diagnostician_public_profile;
CREATE TRIGGER trg_dpp_updated_at
  BEFORE UPDATE ON public.diagnostician_public_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.set_diagnostician_public_profile_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.diagnostician_public_profile ENABLE ROW LEVEL SECURITY;

-- Lecture publique conditionnée par la visibilité globale du diagnostiqueur
-- (helper is_diagnostician_publicly_visible défini par la migration
--  20260524240000_diagnosticians_verification_pipeline.sql).
DROP POLICY IF EXISTS dpp_public_read ON public.diagnostician_public_profile;
CREATE POLICY dpp_public_read ON public.diagnostician_public_profile
  FOR SELECT
  USING (public.is_diagnostician_publicly_visible(diagnostician_id));

-- Le propriétaire (auth.uid() = diagnosticians.claimed_by_user_id) peut tout faire
DROP POLICY IF EXISTS dpp_owner_all ON public.diagnostician_public_profile;
CREATE POLICY dpp_owner_all ON public.diagnostician_public_profile
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.diagnosticians d
      WHERE d.id = diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.diagnosticians d
      WHERE d.id = diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  );

-- ============================================================
-- Statistiques de visites — léger (mock côté UI tant qu'il n'y a
-- pas de tracking PostHog/server, table prête pour V1.5).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.diagnostician_profile_views (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostician_id uuid NOT NULL REFERENCES public.diagnosticians(id) ON DELETE CASCADE,
  viewed_at        timestamptz NOT NULL DEFAULT now(),
  visitor_city     text,                                -- déduit IP côté serveur
  source           text DEFAULT 'direct'                -- direct / google / social / referral
);

CREATE INDEX IF NOT EXISTS idx_dpv_diag_date
  ON public.diagnostician_profile_views(diagnostician_id, viewed_at DESC);

ALTER TABLE public.diagnostician_profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dpv_owner_read ON public.diagnostician_profile_views;
CREATE POLICY dpv_owner_read ON public.diagnostician_profile_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.diagnosticians d
      WHERE d.id = diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  );

-- Insert public (page publique anon) — pas de RLS lecture pour anon
DROP POLICY IF EXISTS dpv_insert_anon ON public.diagnostician_profile_views;
CREATE POLICY dpv_insert_anon ON public.diagnostician_profile_views
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.diagnostician_public_profile IS
  'Profil public éditable par le diagnostiqueur (bio, zones, photos, tarifs indicatifs)';
COMMENT ON TABLE public.diagnostician_profile_views IS
  'Tracking visites fiches publiques diagnostiqueurs (V1.5 stats)';
