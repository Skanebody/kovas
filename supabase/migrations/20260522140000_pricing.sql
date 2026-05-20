-- ============================================
-- KOVAS App — Pricing backend (Partition B)
-- Date : 2026-05-22
-- Authority : CLAUDE.md §3 + prompt Partition B
--
-- Tables :
--   * user_pricing_config           — configuration tarifaire par user (templates + overrides)
--   * user_pricing_packs            — packs custom par user (8 packs prédéfinis appliqués)
--   * mission_pricing_snapshots     — prix figé au moment du RDV (immutable, CA tracking)
--
-- Le snapshot est immutable APRES INSERT : seuls `status` et `status_updated_at`
-- peuvent être mis à jour. Protection via TRIGGER (cf. section "Immutabilité").
-- ============================================

-- ============================================
-- 1. user_pricing_config — config tarifaire user
-- ============================================
CREATE TABLE IF NOT EXISTS user_pricing_config (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vat_status           text NOT NULL DEFAULT 'with_vat'
    CHECK (vat_status IN ('with_vat', 'franchise_vat')),
  vat_rate             numeric(4, 3) NOT NULL DEFAULT 0.200,
  display_mode         text NOT NULL DEFAULT 'ht_and_ttc'
    CHECK (display_mode IN ('ht_and_ttc', 'ttc_only', 'ht_only')),
  applied_template     text,   -- 'economique' | 'median' | 'premium' | 'blank'
  template_applied_at  timestamptz,
  -- pricing_config jsonb structure :
  -- {
  --   "diagnostics": {
  --     "DPE":     { "basePrice": 130, "modulations": { "studio": 0.85, "appartement": 1.0, "grandAppartement": 1.15, "maison": 1.20, "grandeMaison": 1.40 } },
  --     "AMIANTE": { ... },
  --     ...
  --   },
  --   "travelFees":   { "includedRadiusKm": 15, "pricePerKmBeyond": 0.50, "capAmount": 50 },
  --   "majorations":  { "urgency48h": 30, "weekend": 50, "evening": 25 }
  -- }
  pricing_config       jsonb NOT NULL DEFAULT '{}'::jsonb,
  has_configured       boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_config_org ON user_pricing_config(organization_id);

-- ============================================
-- 2. user_pricing_packs — packs custom par user
-- ============================================
CREATE TABLE IF NOT EXISTS user_pricing_packs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  description           text,
  predefined_pack_id    text,   -- 'pack-vente-appartement-ancien' etc. (lib pack-definitions)
  diagnostics           text[] NOT NULL,
  price_ht              numeric(10, 2) NOT NULL,
  applicable_for        text[],   -- ['vente', 'location', 'mise_en_copro']
  min_property_age      int,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_packs_user_active ON user_pricing_packs(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pricing_packs_org ON user_pricing_packs(organization_id);

-- ============================================
-- 3. mission_pricing_snapshots — prix figé au RDV
-- ============================================
CREATE TABLE IF NOT EXISTS mission_pricing_snapshots (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id               uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  estimated_at             timestamptz NOT NULL DEFAULT now(),

  -- Détail itemized (avant détection pack)
  itemized_subtotal_ht     numeric(10, 2),

  -- Pack appliqué (substitue itemized si renseigné)
  applied_pack_id          uuid REFERENCES user_pricing_packs(id) ON DELETE SET NULL,
  applied_pack_price_ht    numeric(10, 2),

  -- Frais déplacement
  travel_fees_ht           numeric(10, 2) NOT NULL DEFAULT 0,
  travel_distance_km       numeric(8, 2),

  -- Majorations (urgent / weekend / soir)
  majorations_ht           numeric(10, 2) NOT NULL DEFAULT 0,
  majorations_details      jsonb,   -- [{ kind, label, amountHt }]

  -- Totaux figés
  total_ht                 numeric(10, 2) NOT NULL,
  vat_amount               numeric(10, 2) NOT NULL DEFAULT 0,
  total_ttc                numeric(10, 2) NOT NULL,

  -- Cycle de vie (mutable)
  status                   text NOT NULL DEFAULT 'estimated'
    CHECK (status IN ('estimated', 'mission_done', 'cancelled')),
  status_updated_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pricing_snapshots_user_status
  ON mission_pricing_snapshots(user_id, status, estimated_at);
CREATE INDEX IF NOT EXISTS idx_pricing_snapshots_dossier
  ON mission_pricing_snapshots(dossier_id);
CREATE INDEX IF NOT EXISTS idx_pricing_snapshots_org
  ON mission_pricing_snapshots(organization_id);

-- ============================================
-- 4. Trigger updated_at sur les tables config + packs
-- ============================================
CREATE OR REPLACE FUNCTION public.touch_pricing_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_pricing_config_touch
  BEFORE UPDATE ON user_pricing_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_pricing_updated_at();

CREATE TRIGGER trg_user_pricing_packs_touch
  BEFORE UPDATE ON user_pricing_packs
  FOR EACH ROW EXECUTE FUNCTION public.touch_pricing_updated_at();

-- ============================================
-- 5. Immutabilité des snapshots
-- Seuls status et status_updated_at peuvent être modifiés.
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_pricing_snapshot_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Champs autorisés à muter : status + status_updated_at uniquement.
  IF NEW.dossier_id            IS DISTINCT FROM OLD.dossier_id
     OR NEW.user_id            IS DISTINCT FROM OLD.user_id
     OR NEW.organization_id    IS DISTINCT FROM OLD.organization_id
     OR NEW.estimated_at       IS DISTINCT FROM OLD.estimated_at
     OR NEW.itemized_subtotal_ht IS DISTINCT FROM OLD.itemized_subtotal_ht
     OR NEW.applied_pack_id    IS DISTINCT FROM OLD.applied_pack_id
     OR NEW.applied_pack_price_ht IS DISTINCT FROM OLD.applied_pack_price_ht
     OR NEW.travel_fees_ht     IS DISTINCT FROM OLD.travel_fees_ht
     OR NEW.travel_distance_km IS DISTINCT FROM OLD.travel_distance_km
     OR NEW.majorations_ht     IS DISTINCT FROM OLD.majorations_ht
     OR NEW.majorations_details IS DISTINCT FROM OLD.majorations_details
     OR NEW.total_ht           IS DISTINCT FROM OLD.total_ht
     OR NEW.vat_amount         IS DISTINCT FROM OLD.vat_amount
     OR NEW.total_ttc          IS DISTINCT FROM OLD.total_ttc
  THEN
    RAISE EXCEPTION 'mission_pricing_snapshots is immutable except for status / status_updated_at';
  END IF;
  -- Auto-set status_updated_at si status change
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pricing_snapshot_immutable
  BEFORE UPDATE ON mission_pricing_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pricing_snapshot_immutability();

-- ============================================
-- 6. RLS policies
-- ============================================
ALTER TABLE user_pricing_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pricing_packs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_pricing_snapshots  ENABLE ROW LEVEL SECURITY;

-- user_pricing_config : le user ne voit que sa propre config
CREATE POLICY "pricing_config_self"
  ON user_pricing_config
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- user_pricing_packs : le user gère ses packs
CREATE POLICY "pricing_packs_self"
  ON user_pricing_packs
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- mission_pricing_snapshots : visible par tous les membres de l'org
CREATE POLICY "pricing_snapshots_select_org"
  ON mission_pricing_snapshots
  FOR SELECT
  USING (public.is_member_of(organization_id));

CREATE POLICY "pricing_snapshots_insert_self"
  ON mission_pricing_snapshots
  FOR INSERT
  WITH CHECK (
    public.is_member_of(organization_id)
    AND user_id = auth.uid()
  );

CREATE POLICY "pricing_snapshots_update_status_only"
  ON mission_pricing_snapshots
  FOR UPDATE
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "pricing_snapshots_delete_org"
  ON mission_pricing_snapshots
  FOR DELETE
  USING (public.is_member_of(organization_id));

-- ============================================
-- 7. Commentaires métier
-- ============================================
COMMENT ON TABLE user_pricing_config IS
  'Configuration tarifaire par diagnostiqueur (template + modulations + TVA + frais déplacement).';
COMMENT ON TABLE user_pricing_packs IS
  'Packs custom (combinaisons diagnostics à prix unique) — instances des PREDEFINED_PACKS.';
COMMENT ON TABLE mission_pricing_snapshots IS
  'Snapshot prix figé au moment du RDV — immutable sauf status + status_updated_at.';
COMMENT ON COLUMN user_pricing_config.pricing_config IS
  'JSONB : { diagnostics: {TYPE -> { basePrice, modulations }}, travelFees, majorations }.';
COMMENT ON COLUMN mission_pricing_snapshots.majorations_details IS
  'JSONB array : [{ kind: "urgency"|"weekend"|"evening", label, amountHt }].';
