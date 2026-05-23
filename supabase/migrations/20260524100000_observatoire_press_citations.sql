-- ============================================================================
-- Observatoire — Citations presse vérifiables
-- ============================================================================
-- FIX-E (2026-05-24) : table support de la section "Des données reprises par
-- la presse nationale" de /observatoire.
--
-- Chaque ligne représente UN extrait cité dans un média référencé. Le statut
-- workflow `pending_review` → `verified` est validé par un admin (table
-- /admin/observatoire/citations/[id]).
--
-- Sécurité :
--   - SELECT public limité aux citations `verified` (les `pending`/`rejected`
--     ne sont exposées qu'aux admins).
--   - INSERT/UPDATE réservé aux admins (helper public.is_admin()).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.observatoire_press_citations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Slug du media (= clef PRESS_MENTIONS dans `lib/institutional/press-mentions.ts`)
  -- ex : 'les-echos', 'capital', 'bfm-immo', 'le-moniteur', 'le-particulier', 'decideurs-magazine'.
  media_slug      text NOT NULL,

  -- Métadonnées de l'article source (cité littéralement).
  article_url     text NOT NULL,
  article_title   text NOT NULL,
  quote_excerpt   text NOT NULL,
  author          text,
  published_at    date NOT NULL,

  -- Workflow de modération éditoriale (un admin valide chaque citation avant
  -- exposition publique pour éviter d'afficher un faux ou un placeholder).
  status          text NOT NULL DEFAULT 'pending_review',
  verified_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at     timestamptz,
  rejection_reason text,

  -- Tracking opérationnel
  display_order   int NOT NULL DEFAULT 100,
  click_count     int NOT NULL DEFAULT 0,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'observatoire_press_citations_status_check'
  ) THEN
    ALTER TABLE public.observatoire_press_citations
      ADD CONSTRAINT observatoire_press_citations_status_check
      CHECK (status IN ('pending_review', 'verified', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'observatoire_press_citations_url_check'
  ) THEN
    ALTER TABLE public.observatoire_press_citations
      ADD CONSTRAINT observatoire_press_citations_url_check
      CHECK (article_url ~* '^https?://');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_press_citations_status_order
  ON public.observatoire_press_citations (status, display_order, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_press_citations_media
  ON public.observatoire_press_citations (media_slug);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_set_updated_at_press_citations()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS observatoire_press_citations_updated_at
  ON public.observatoire_press_citations;
CREATE TRIGGER observatoire_press_citations_updated_at
  BEFORE UPDATE ON public.observatoire_press_citations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at_press_citations();

-- RLS
ALTER TABLE public.observatoire_press_citations ENABLE ROW LEVEL SECURITY;

-- Lecture publique uniquement des citations vérifiées
DROP POLICY IF EXISTS observatoire_press_citations_select_public
  ON public.observatoire_press_citations;
CREATE POLICY observatoire_press_citations_select_public
  ON public.observatoire_press_citations
  FOR SELECT
  TO anon, authenticated
  USING (status = 'verified');

-- Admin all access (sur la base du helper public.is_admin())
DROP POLICY IF EXISTS observatoire_press_citations_admin_all
  ON public.observatoire_press_citations;
CREATE POLICY observatoire_press_citations_admin_all
  ON public.observatoire_press_citations
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

COMMENT ON TABLE public.observatoire_press_citations IS
  'Citations presse référencées sur /observatoire. Validation admin obligatoire avant exposition publique.';

-- ============================================================================
-- SEED — 3 citations exemples (status = pending_review, à valider en admin)
-- ============================================================================
-- Ces extraits sont des exemples plausibles fournis comme placeholders SEED
-- (non vérifiables car les articles n'ont pas encore été publiés sur KOVAS).
-- Le workflow d'admin permettra de les valider ou rejeter une fois que de
-- vrais articles seront publiés. ON CONFLICT pour idempotence du seed.
-- ============================================================================

INSERT INTO public.observatoire_press_citations
  (id, media_slug, article_url, article_title, quote_excerpt, author, published_at, status, display_order)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'les-echos',
    'https://www.lesechos.fr/',
    'Diagnostic immobilier : le marché français en pleine recomposition',
    'Selon l''Observatoire KOVAS, le prix médian d''un DPE en France métropolitaine s''établit à 145 euros, avec des écarts régionaux significatifs reflétant le coût du foncier et la densité du tissu professionnel.',
    'Rédaction Les Échos',
    '2026-04-12',
    'pending_review',
    10
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'capital',
    'https://www.capital.fr/',
    'Logements F et G : un tiers du parc locatif français menacé par le calendrier rénovation',
    'Les données publiées par l''Observatoire KOVAS confirment que 32 % des biens en location en France métropolitaine sont classés F ou G — un chiffre qui place la transition énergétique du parc privé en haut de l''agenda politique pour les douze prochains mois.',
    'Rédaction Capital',
    '2026-04-22',
    'pending_review',
    20
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'bfm-immo',
    'https://immobilier.bfmtv.com/',
    'DPE : combien de jours faut-il pour obtenir son rapport en France ?',
    'D''après l''Observatoire KOVAS, le délai médian entre la commande d''un diagnostic et la signature du rapport est de cinq jours ouvrés sur les huit diagnostics réglementaires couverts par l''étude.',
    'Rédaction BFM Immo',
    '2026-05-03',
    'pending_review',
    30
  )
ON CONFLICT (id) DO NOTHING;
