-- ============================================================================
-- KOVAS — GC2 Mission flow continu : fondations data layer
-- ============================================================================
-- Préparation backend pour la refonte UX du tchat mission en mode flow continu
-- (vs le mode step-by-step actuel). Permet à l'UI de reprendre exactement où le
-- diagnostiqueur s'est arrêté, même après changement d'appareil ou de session.
--
-- La refonte UX complète (composants tchat + composer continu + transitions
-- animées) est différée 3-5j en session dédiée. Cette migration pose les rails.
--
-- Authority : REFONTE-ACQUI-TARGET-V2 §6.2 — Game Changer 2.
-- ============================================================================

-- 1. mission_flow_states — état persistant du flow par mission
CREATE TABLE IF NOT EXISTS public.mission_flow_states (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id            uuid NOT NULL UNIQUE REFERENCES public.missions (id) ON DELETE CASCADE,
  organization_id       uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,

  -- État courant du flow (machine à états déterministe)
  current_phase         text NOT NULL DEFAULT 'preparation',
  -- 'preparation' | 'capture_terrain' | 'verification' | 'pre_export' | 'sent'

  -- Sous-état dans la phase (ex: 'photos' | 'voix' | 'mesures' pendant capture_terrain)
  current_step          text,

  -- Pièce en cours (FK retirée — table mission_rooms variable selon environnement,
  -- code applicatif valide l'existence. Cf. lot B83 GC2 mission flow UI.)
  current_room_id       uuid,

  -- Position de scroll dans le tchat (pour reprendre à la dernière vue)
  last_seen_message_id  uuid,

  -- Compteur d'événements traités (pour optimistic concurrency)
  version               int NOT NULL DEFAULT 1,

  -- Métadonnées
  resumed_count         int NOT NULL DEFAULT 0,
  last_device_user_agent text,

  -- Workflow timestamps
  preparation_started_at  timestamptz,
  capture_started_at      timestamptz,
  capture_completed_at    timestamptz,
  verification_started_at timestamptz,
  pre_export_started_at   timestamptz,
  sent_at                 timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mission_flow_states_phase_check'
  ) THEN
    ALTER TABLE public.mission_flow_states
      ADD CONSTRAINT mission_flow_states_phase_check
      CHECK (current_phase IN ('preparation', 'capture_terrain', 'verification', 'pre_export', 'sent'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mission_flow_states_org
  ON public.mission_flow_states (organization_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_mission_flow_states_phase
  ON public.mission_flow_states (organization_id, current_phase);

ALTER TABLE public.mission_flow_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mission_flow_states_org_member_all ON public.mission_flow_states;
CREATE POLICY mission_flow_states_org_member_all
  ON public.mission_flow_states
  FOR ALL
  TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

COMMENT ON TABLE public.mission_flow_states IS
  'GC2 — Etat persistant du flow mission continu. Permet reprise sur autre device.';

-- 2. mission_flow_events — journal append-only des transitions (audit + replay)
CREATE TABLE IF NOT EXISTS public.mission_flow_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id        uuid NOT NULL REFERENCES public.missions (id) ON DELETE CASCADE,
  organization_id   uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  from_phase        text,
  to_phase          text NOT NULL,
  from_step         text,
  to_step           text,
  trigger           text NOT NULL,
  -- 'user_action' | 'auto_completed' | 'idle_timeout' | 'admin_override'
  trigger_payload   jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_flow_events_mission_time
  ON public.mission_flow_events (mission_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_mission_flow_events_org_time
  ON public.mission_flow_events (organization_id, occurred_at DESC);

ALTER TABLE public.mission_flow_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mission_flow_events_org_read ON public.mission_flow_events;
CREATE POLICY mission_flow_events_org_read
  ON public.mission_flow_events
  FOR SELECT
  TO authenticated
  USING (public.is_member_of(organization_id));

DROP POLICY IF EXISTS mission_flow_events_org_insert ON public.mission_flow_events;
CREATE POLICY mission_flow_events_org_insert
  ON public.mission_flow_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_member_of(organization_id));

COMMENT ON TABLE public.mission_flow_events IS
  'GC2 — Journal append-only des transitions de flow mission (audit + replay).';

-- 3. RPC transition atomique avec optimistic concurrency
CREATE OR REPLACE FUNCTION public.mission_flow_transition(
  p_mission_id     uuid,
  p_to_phase       text,
  p_to_step        text DEFAULT NULL,
  p_expected_ver   int DEFAULT NULL,
  p_trigger        text DEFAULT 'user_action',
  p_payload        jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  ok               boolean,
  new_version      int,
  prev_phase       text,
  error_reason     text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id         uuid;
  v_current        public.mission_flow_states%ROWTYPE;
  v_from_phase     text;
  v_from_step      text;
  v_now            timestamptz := now();
BEGIN
  -- 1. Récupère l'organization_id de la mission
  SELECT m.organization_id INTO v_org_id
  FROM public.missions m
  WHERE m.id = p_mission_id;

  IF v_org_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::int, NULL::text, 'mission_not_found'::text;
    RETURN;
  END IF;

  -- 2. Vérifie l'accès (RLS bypass via SECURITY DEFINER : check explicite)
  IF NOT public.is_member_of(v_org_id) THEN
    RETURN QUERY SELECT false, NULL::int, NULL::text, 'forbidden'::text;
    RETURN;
  END IF;

  -- 3. Charge ou crée le state row
  SELECT * INTO v_current
  FROM public.mission_flow_states
  WHERE mission_id = p_mission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.mission_flow_states (
      mission_id, organization_id, current_phase, current_step,
      preparation_started_at, created_at, updated_at
    )
    VALUES (
      p_mission_id, v_org_id, 'preparation', NULL,
      v_now, v_now, v_now
    )
    RETURNING * INTO v_current;
  END IF;

  -- 4. Optimistic concurrency check
  IF p_expected_ver IS NOT NULL AND v_current.version != p_expected_ver THEN
    RETURN QUERY SELECT false, v_current.version, v_current.current_phase, 'version_mismatch'::text;
    RETURN;
  END IF;

  -- 5. Validation transition (machine à états)
  IF v_current.current_phase = 'sent' AND p_to_phase != 'sent' THEN
    RETURN QUERY SELECT false, v_current.version, v_current.current_phase, 'terminal_state'::text;
    RETURN;
  END IF;

  v_from_phase := v_current.current_phase;
  v_from_step := v_current.current_step;

  -- 6. UPDATE state + bump timestamps phase-spécifiques
  UPDATE public.mission_flow_states
  SET current_phase = p_to_phase,
      current_step = p_to_step,
      version = v_current.version + 1,
      updated_at = v_now,
      capture_started_at = COALESCE(
        capture_started_at,
        CASE WHEN p_to_phase = 'capture_terrain' THEN v_now ELSE NULL END
      ),
      capture_completed_at = COALESCE(
        capture_completed_at,
        CASE WHEN v_from_phase = 'capture_terrain' AND p_to_phase != 'capture_terrain' THEN v_now ELSE NULL END
      ),
      verification_started_at = COALESCE(
        verification_started_at,
        CASE WHEN p_to_phase = 'verification' THEN v_now ELSE NULL END
      ),
      pre_export_started_at = COALESCE(
        pre_export_started_at,
        CASE WHEN p_to_phase = 'pre_export' THEN v_now ELSE NULL END
      ),
      sent_at = COALESCE(
        sent_at,
        CASE WHEN p_to_phase = 'sent' THEN v_now ELSE NULL END
      )
  WHERE mission_id = p_mission_id;

  -- 7. Append event (audit append-only)
  INSERT INTO public.mission_flow_events (
    mission_id, organization_id,
    from_phase, to_phase, from_step, to_step,
    trigger, trigger_payload, occurred_at
  )
  VALUES (
    p_mission_id, v_org_id,
    v_from_phase, p_to_phase, v_from_step, p_to_step,
    p_trigger, p_payload, v_now
  );

  RETURN QUERY SELECT true, v_current.version + 1, v_from_phase, NULL::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mission_flow_transition(uuid, text, text, int, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mission_flow_transition(uuid, text, text, int, text, jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.mission_flow_transition IS
  'GC2 — Transition atomique du mission flow avec optimistic concurrency. Append event audit.';
