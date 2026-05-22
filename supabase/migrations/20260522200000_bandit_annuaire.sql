-- ============================================
-- KOVAS App — Multi-armed bandit annuaire (Thompson sampling Beta-Bernoulli)
-- Date : 2026-05-22
-- Lot #149 — ALGOS-BANDIT-FRAUDE (algo 1/2)
--
-- Objectif : classer dynamiquement les diagnostiqueurs sur les pages
-- annuaire publiques (/diagnostiqueurs/[dept]/[city]) pour maximiser
-- la conversion (lead → contact accepté) tout en explorant les nouveaux
-- entrants (cold start protection).
--
-- Approche : Thompson sampling sur distribution Beta(α, β) par diagnostiqueur.
-- α = 1 + succès, β = 1 + échecs. Decay journalier exponentiel pour permettre
-- aux comportements récents de dominer les stats historiques.
-- ============================================

-- ============================================
-- 1. Table diagnosticians (créée si absente)
-- Stub minimal — la table peut être enrichie par une migration ultérieure
-- du module annuaire public. On évite UNIQUE(slug) etc. côté Phase 1.
-- ============================================
CREATE TABLE IF NOT EXISTS diagnosticians (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  slug            text UNIQUE,
  certification_n text,
  -- Géolocalisation cabinet (haversine pour algo fraude pattern 3)
  cabinet_lat     double precision,
  cabinet_lng     double precision,
  -- Métadonnées annuaire
  city_slug       text,
  dept_code       text,
  years_active    integer NOT NULL DEFAULT 0,
  monthly_missions integer NOT NULL DEFAULT 0,
  is_published    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnosticians_city
  ON diagnosticians(city_slug)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_diagnosticians_dept
  ON diagnosticians(dept_code)
  WHERE is_published = true;

-- ============================================
-- 2. Table bandit_diagnostician_stats
-- Stats Beta-Bernoulli par diagnostiqueur (V1 globales, V2 par city_slug).
-- ============================================
CREATE TABLE IF NOT EXISTS bandit_diagnostician_stats (
  diagnostician_id uuid PRIMARY KEY REFERENCES diagnosticians(id) ON DELETE CASCADE,
  -- Compteurs bruts (lecture humaine)
  impressions      integer NOT NULL DEFAULT 0,
  conversions      integer NOT NULL DEFAULT 0,
  -- Distribution Beta(alpha, beta) lissée par decay
  alpha            numeric NOT NULL DEFAULT 1.0 CHECK (alpha >= 1.0),
  beta             numeric NOT NULL DEFAULT 1.0 CHECK (beta >= 1.0),
  -- Decay
  last_updated_at  timestamptz NOT NULL DEFAULT now(),
  decay_factor     numeric NOT NULL DEFAULT 0.95 CHECK (decay_factor > 0 AND decay_factor <= 1),
  -- Cold start protection
  warm_threshold   integer NOT NULL DEFAULT 50 CHECK (warm_threshold > 0),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bandit_stats_updated
  ON bandit_diagnostician_stats(last_updated_at);

-- ============================================
-- 3. Table bandit_events — audit + replay
-- ============================================
CREATE TABLE IF NOT EXISTS bandit_events (
  id               bigserial PRIMARY KEY,
  diagnostician_id uuid NOT NULL REFERENCES diagnosticians(id) ON DELETE CASCADE,
  event_type       text NOT NULL CHECK (event_type IN ('impression', 'click', 'lead_request', 'lead_accepted')),
  city_slug        text,
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_bandit_events_diag_time
  ON bandit_events(diagnostician_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_bandit_events_type_time
  ON bandit_events(event_type, occurred_at DESC);

-- ============================================
-- 4. RLS — annuaire public en lecture, écriture côté service_role
-- ============================================
ALTER TABLE bandit_diagnostician_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE bandit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnosticians ENABLE ROW LEVEL SECURITY;

-- Lecture annuaire : tous peuvent voir les diagnostiqueurs publiés
CREATE POLICY "diagnosticians_public_read"
  ON diagnosticians FOR SELECT
  USING (is_published = true);

-- Lecture stats : service_role uniquement (algo serveur)
-- (pas de policy SELECT pour anon → bloqué par défaut)

-- Lecture events : owner organisation peut consulter ses propres events
CREATE POLICY "bandit_events_owner_read"
  ON bandit_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM diagnosticians d
      WHERE d.id = bandit_events.diagnostician_id
        AND d.organization_id IS NOT NULL
        AND public.is_member_of(d.organization_id)
    )
  );

-- ============================================
-- 5. Helper RPC — incrémentation atomique des stats
-- Évite les race conditions entre recordImpression et recordConversion.
-- ============================================
CREATE OR REPLACE FUNCTION public.bandit_record_event(
  p_diagnostician_id uuid,
  p_event_type text,
  p_city_slug text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Log brut dans bandit_events
  INSERT INTO bandit_events (diagnostician_id, event_type, city_slug, metadata)
  VALUES (p_diagnostician_id, p_event_type, p_city_slug, p_metadata);

  -- 2. Upsert stats agrégées
  INSERT INTO bandit_diagnostician_stats (diagnostician_id)
  VALUES (p_diagnostician_id)
  ON CONFLICT (diagnostician_id) DO NOTHING;

  -- 3. Met à jour les compteurs selon event_type
  IF p_event_type = 'impression' THEN
    UPDATE bandit_diagnostician_stats
       SET impressions = impressions + 1,
           beta = beta + 1.0, -- impression sans conversion = signal d'échec potentiel
           last_updated_at = now()
     WHERE diagnostician_id = p_diagnostician_id;
  ELSIF p_event_type IN ('click', 'lead_request', 'lead_accepted') THEN
    -- Conversion = succès Beta. lead_accepted = signal fort (alpha+2),
    -- les autres = signal faible (alpha+0.5 click, alpha+1 lead_request).
    UPDATE bandit_diagnostician_stats
       SET conversions = conversions + 1,
           alpha = alpha + CASE
             WHEN p_event_type = 'lead_accepted' THEN 2.0
             WHEN p_event_type = 'lead_request' THEN 1.0
             ELSE 0.5
           END,
           -- On compense le beta+1 de l'impression précédente : la conversion
           -- transforme l'échec présumé en succès.
           beta = GREATEST(1.0, beta - 1.0),
           last_updated_at = now()
     WHERE diagnostician_id = p_diagnostician_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bandit_record_event(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bandit_record_event(uuid, text, text, jsonb) TO service_role, authenticated;

-- ============================================
-- 6. Helper RPC — decay journalier
-- À appeler depuis Edge Function cron (24h).
-- alpha = 1 + (alpha - 1) * decay_factor ; idem beta.
-- Effet : les stats vieilles s'effacent progressivement, permet re-exploration.
-- ============================================
CREATE OR REPLACE FUNCTION public.bandit_apply_decay()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE bandit_diagnostician_stats
       SET alpha = 1.0 + GREATEST(0, alpha - 1.0) * decay_factor,
           beta  = 1.0 + GREATEST(0, beta  - 1.0) * decay_factor,
           last_updated_at = now()
     WHERE last_updated_at < now() - interval '20 hours'
    RETURNING diagnostician_id
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bandit_apply_decay() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bandit_apply_decay() TO service_role;

-- ============================================
-- Fin migration bandit annuaire
-- ============================================
