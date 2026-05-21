-- ============================================
-- KOVAS — Carte de visite numérique partageable (P8)
--
-- Une carte de visite par organisation :
--   - toggles d'affichage des informations (téléphone / email / adresse / web /
--     certification / SIRET / logo)
--   - champs custom : titre pro (sinon défaut depuis linguistic_profile),
--     site web, téléphone fixe
--   - public_token (16 octets hex) pour /c/<token> sans authentification
--   - stats anonymes : view_count (page publique) + scan_count (download vCard)
--
-- L'idée produit : le diagnostiqueur scanne sa carte avec l'appareil photo
-- d'un prescripteur, la bannière "Ajouter aux contacts" apparaît avec toutes
-- les infos pré-remplies. Zéro saisie, zéro erreur.
--
-- Convention public_token : encode(gen_random_bytes(16), 'hex') = 32 chars.
-- Brut-force aléatoire infaisable, régénérable côté UI pour invalider.
-- ============================================

CREATE TABLE IF NOT EXISTS business_cards (
  organization_id    uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Toggles d'affichage (chaque info est-elle exposée dans la vCard ?)
  show_phone_mobile  boolean NOT NULL DEFAULT true,
  show_phone_fixed   boolean NOT NULL DEFAULT false,
  show_email         boolean NOT NULL DEFAULT true,
  show_address       boolean NOT NULL DEFAULT true,
  show_website       boolean NOT NULL DEFAULT true,
  show_certification boolean NOT NULL DEFAULT true,
  show_siret         boolean NOT NULL DEFAULT true,
  show_logo          boolean NOT NULL DEFAULT true,

  -- Champs custom (overrides depuis profile/org si user veut autre chose
  -- que les valeurs par défaut)
  custom_title       text,                   -- ex : "Diagnostiqueur immobilier certifié"
  custom_website     text,                   -- URL site web cabinet
  custom_phone_fixed text,                   -- ligne fixe en plus du mobile (E.164)

  -- Token public pour /c/<token>
  public_token       text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),

  -- Stats anonymes
  view_count         int NOT NULL DEFAULT 0,
  scan_count         int NOT NULL DEFAULT 0,

  -- Audit
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_cards_public_token
  ON business_cards (public_token);

COMMENT ON TABLE business_cards IS
  'Carte de visite numérique partageable (P8). Une par organisation. Page publique /c/<public_token> accessible sans auth.';
COMMENT ON COLUMN business_cards.public_token IS
  'Token aléatoire 16 octets hex pour /c/<token>. Régénérable depuis l''UI pour invalider l''ancien lien.';
COMMENT ON COLUMN business_cards.custom_title IS
  'Titre professionnel personnalisé. Si NULL, utilise par défaut "Diagnostiqueur immobilier certifié".';
COMMENT ON COLUMN business_cards.view_count IS
  'Nombre de chargements de la page publique /c/<token>. Stat anonyme.';
COMMENT ON COLUMN business_cards.scan_count IS
  'Nombre de téléchargements du fichier .vcf. Stat anonyme.';

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────

ALTER TABLE business_cards ENABLE ROW LEVEL SECURITY;

-- Owner full access : le membre de l'org peut tout lire/écrire sur la ligne
-- de son organisation. La page publique /c/<token> passe par le service-role
-- (bypass RLS) pour incrémenter les compteurs.
DROP POLICY IF EXISTS "business_cards: org members full access" ON business_cards;
CREATE POLICY "business_cards: org members full access"
  ON business_cards
  FOR ALL TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

-- ────────────────────────────────────────────────────────────
-- Trigger updated_at
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_business_cards_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_business_cards_updated_at ON business_cards;
CREATE TRIGGER trg_business_cards_updated_at
  BEFORE UPDATE ON business_cards
  FOR EACH ROW EXECUTE FUNCTION touch_business_cards_updated_at();
