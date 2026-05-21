-- ============================================
-- KOVAS App — Module 5 : Suivi prescripteurs (prescriber_relationships)
-- Date : 2026-05-25
-- Objectif : suivre la relation avec chaque prescripteur (agence,
--            notaire, syndic), calculer un tier dynamique selon
--            le revenu généré sur 12 mois glissants, détecter le silence.
-- ============================================

CREATE TABLE prescriber_relationships (
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
  -- Colonne calculée silent_since_days (jours depuis dernier contact)
  silent_since_days        int GENERATED ALWAYS AS (
                             CASE
                               WHEN last_contact_at IS NULL THEN NULL
                               ELSE GREATEST(0, (EXTRACT(EPOCH FROM (now() - last_contact_at)) / 86400)::int)
                             END
                           ) STORED,
  notes                    text,
  next_action_at           timestamptz,
  next_action_type         text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, contact_id)
);

COMMENT ON TABLE prescriber_relationships IS
  'Suivi CRM des prescripteurs (agences, notaires, syndics). Tier recalculé automatiquement à partir du revenu 12 mois glissant.';
COMMENT ON COLUMN prescriber_relationships.tier IS
  'Calculé via trigger : platinum (>50k€), gold (>20k€), silver (>5k€), bronze sinon.';
COMMENT ON COLUMN prescriber_relationships.silent_since_days IS
  'Jours écoulés depuis last_contact_at (NULL si jamais contacté). Colonne GENERATED STORED.';

CREATE INDEX idx_prescriber_org_tier ON prescriber_relationships (organization_id, tier);
CREATE INDEX idx_prescriber_contact ON prescriber_relationships (contact_id);
CREATE INDEX idx_prescriber_silent ON prescriber_relationships (organization_id, silent_since_days)
  WHERE silent_since_days IS NOT NULL;
CREATE INDEX idx_prescriber_next_action ON prescriber_relationships (next_action_at)
  WHERE next_action_at IS NOT NULL;
CREATE INDEX idx_prescriber_user ON prescriber_relationships (user_id);

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

CREATE TRIGGER trg_prescriber_tier
  BEFORE INSERT OR UPDATE OF revenue_12m_eur ON prescriber_relationships
  FOR EACH ROW EXECUTE FUNCTION compute_prescriber_tier();

-- Trigger updated_at
CREATE TRIGGER trg_prescriber_relationships_updated
  BEFORE UPDATE ON prescriber_relationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE prescriber_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY pr_select ON prescriber_relationships
  FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY pr_insert ON prescriber_relationships
  FOR INSERT WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY pr_update ON prescriber_relationships
  FOR UPDATE USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY pr_delete ON prescriber_relationships
  FOR DELETE USING (public.is_member_of(organization_id));
