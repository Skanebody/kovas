-- ============================================
-- KOVAS App — Module 5 : Suivi prescripteurs (prescriber_relationships)
-- Date : 2026-05-25
-- Objectif : suivre la relation avec chaque prescripteur (agence,
--            notaire, syndic), calculer un tier dynamique selon
--            le revenu généré sur 12 mois glissants, détecter le silence.
-- ============================================

-- Patch idempotent : table peut déjà exister partiellement
CREATE TABLE IF NOT EXISTS prescriber_relationships (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id               uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id                  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  tier                     text NOT NULL DEFAULT 'bronze' CHECK (tier IN (
                             'platinum', 'gold', 'silver', 'bronze'
                           )),
  revenue_12m_eur          numeric(12,2) NOT NULL DEFAULT 0,
  missions_12m_count       int NOT NULL DEFAULT 0,
  acceptance_rate          numeric(4,3),
  avg_basket_eur           numeric(10,2),
  last_mission_at          timestamptz,
  last_contact_at          timestamptz,
  -- silent_since_days : calculé côté requête (vue ou app) car now() non-immutable
  -- interdit l'usage dans GENERATED STORED. Voir vue v_prescriber_silence ci-dessous.
  notes                    text,
  next_action_at           timestamptz,
  next_action_type         text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, contact_id)
);

-- Vue helper : calcule silent_since_days à la volée (now() OK en VIEW)
CREATE OR REPLACE VIEW v_prescriber_silence AS
SELECT
  id,
  organization_id,
  contact_id,
  last_contact_at,
  CASE
    WHEN last_contact_at IS NULL THEN NULL
    ELSE GREATEST(0, (EXTRACT(EPOCH FROM (now() - last_contact_at)) / 86400)::int)
  END AS silent_since_days
FROM prescriber_relationships;

-- Nettoyage : si la table existait déjà avec silent_since_days GENERATED (qui aurait échoué),
-- on la drop pour pouvoir l'utiliser via la vue v_prescriber_silence.
ALTER TABLE prescriber_relationships DROP COLUMN IF EXISTS silent_since_days;

COMMENT ON TABLE prescriber_relationships IS
  'Suivi CRM des prescripteurs (agences, notaires, syndics). Tier recalculé automatiquement à partir du revenu 12 mois glissant.';
COMMENT ON COLUMN prescriber_relationships.tier IS
  'Calculé via trigger : platinum (>50k€), gold (>20k€), silver (>5k€), bronze sinon.';

CREATE INDEX IF NOT EXISTS idx_prescriber_org_tier ON prescriber_relationships (organization_id, tier);
CREATE INDEX IF NOT EXISTS idx_prescriber_contact ON prescriber_relationships (contact_id);
-- Remplace l'index sur silent_since_days (colonne supprimée) par index sur last_contact_at
CREATE INDEX IF NOT EXISTS idx_prescriber_silent ON prescriber_relationships (organization_id, last_contact_at)
  WHERE last_contact_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prescriber_next_action ON prescriber_relationships (next_action_at)
  WHERE next_action_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prescriber_user ON prescriber_relationships (user_id);

-- ============================================
-- Trigger tier calculation BEFORE INSERT/UPDATE
-- ============================================
CREATE OR REPLACE FUNCTION compute_prescriber_tier()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.revenue_12m_eur >= 50000 THEN
    NEW.tier := 'platinum';
  ELSIF NEW.revenue_12m_eur >= 20000 THEN
    NEW.tier := 'gold';
  ELSIF NEW.revenue_12m_eur >= 5000 THEN
    NEW.tier := 'silver';
  ELSE
    NEW.tier := 'bronze';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prescriber_tier ON prescriber_relationships;
CREATE TRIGGER trg_prescriber_tier
  BEFORE INSERT OR UPDATE OF revenue_12m_eur ON prescriber_relationships
  FOR EACH ROW EXECUTE FUNCTION compute_prescriber_tier();

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_prescriber_relationships_updated ON prescriber_relationships;
CREATE TRIGGER trg_prescriber_relationships_updated
  BEFORE UPDATE ON prescriber_relationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE prescriber_relationships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pr_select ON prescriber_relationships;
CREATE POLICY pr_select ON prescriber_relationships
  FOR SELECT USING (public.is_member_of(organization_id));
DROP POLICY IF EXISTS pr_insert ON prescriber_relationships;
CREATE POLICY pr_insert ON prescriber_relationships
  FOR INSERT WITH CHECK (public.is_member_of(organization_id));
DROP POLICY IF EXISTS pr_update ON prescriber_relationships;
CREATE POLICY pr_update ON prescriber_relationships
  FOR UPDATE USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));
DROP POLICY IF EXISTS pr_delete ON prescriber_relationships;
CREATE POLICY pr_delete ON prescriber_relationships
  FOR DELETE USING (public.is_member_of(organization_id));
