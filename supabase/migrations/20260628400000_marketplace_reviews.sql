-- ============================================
-- KOVAS — Avis annuaire natifs (marketplace_reviews)
-- Date : 2026-06-28
-- Mission : Bloc C — brancher /dashboard/annuaire/reviews sur de VRAIES données.
--
-- Contexte
-- --------
-- Jusqu'ici, le dashboard annuaire affichait des avis mockés (cf.
-- apps/web/src/lib/annuaire/mock-data.ts → réécrit en data-access réel).
-- Cette table stocke les avis natifs KOVAS d'un diagnostiqueur, en complément
-- de la synthèse Google agrégée déjà présente sur `diagnosticians`
-- (gmb_rating / gmb_review_count).
--
-- Modèle RLS : calqué sur `quote_requests` (20260530130000) et
-- `diagnosticians` (20260530100000). La propriété passe par
-- `diagnosticians.claimed_by_user_id = auth.uid()` (le module annuaire n'a PAS
-- d'organization_id — la fiche publique est rattachée directement à l'user
-- KOVAS qui l'a réclamée). L'admin (is_admin) a un accès complet pour la
-- modération.
--
-- Idempotente : CREATE TABLE IF NOT EXISTS + DO $$ pour les contraintes +
-- DROP POLICY IF EXISTS avant CREATE POLICY. Réexécutable sans erreur.
-- NON appliquée (Benjamin applique manuellement, cf. Bloc D).
-- ============================================

-- ============================================
-- 1. Table marketplace_reviews
-- ============================================
CREATE TABLE IF NOT EXISTS public.marketplace_reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostician_id  uuid NOT NULL REFERENCES public.diagnosticians(id) ON DELETE CASCADE,

  -- Auteur (pseudonymisation type GMB : "Sophie M." + ville)
  author_name       text NOT NULL,
  author_city       text,

  -- Note + contenu
  rating            int  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment           text,

  -- Provenance de l'avis
  source            text NOT NULL DEFAULT 'kovas'
    CHECK (source IN ('kovas', 'google', 'import')),

  -- Réponse du diagnostiqueur (null tant qu'il n'a pas répondu)
  reply             text,
  reply_at          timestamptz,

  -- Modération
  status            text NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'pending', 'hidden')),

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.marketplace_reviews IS
  'Avis annuaire natifs KOVAS par diagnostiqueur. Complète la synthèse Google agrégée (diagnosticians.gmb_rating / gmb_review_count).';
COMMENT ON COLUMN public.marketplace_reviews.author_name IS
  'Pseudonymisation type GMB : prénom + initiale ("Sophie M.").';
COMMENT ON COLUMN public.marketplace_reviews.source IS
  'kovas (avis natif via lien public) | google (import GMB) | import (migration manuelle).';
COMMENT ON COLUMN public.marketplace_reviews.reply IS
  'Réponse du diagnostiqueur propriétaire (server action replyToReview).';
COMMENT ON COLUMN public.marketplace_reviews.status IS
  'published (visible public) | pending (en attente modération) | hidden (masqué admin).';

-- ============================================
-- 2. Index
-- ============================================
-- Lecture liste dashboard + agrégats : (diag, status, récence).
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_diag_status_created
  ON public.marketplace_reviews (diagnostician_id, status, created_at DESC);

-- ============================================
-- 3. Row Level Security
-- ============================================
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;

-- 3a. Lecture publique : uniquement avis publiés (alimente la fiche publique).
DROP POLICY IF EXISTS "marketplace_reviews_public_read" ON public.marketplace_reviews;
CREATE POLICY "marketplace_reviews_public_read"
  ON public.marketplace_reviews
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- 3b. Le diagnostiqueur propriétaire (fiche réclamée) voit TOUS ses avis,
--     quel que soit le statut (y compris pending / hidden), pour la modération
--     côté dashboard.
DROP POLICY IF EXISTS "marketplace_reviews_owner_read" ON public.marketplace_reviews;
CREATE POLICY "marketplace_reviews_owner_read"
  ON public.marketplace_reviews
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.diagnosticians d
      WHERE d.id = marketplace_reviews.diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- 3c. Le diagnostiqueur propriétaire peut répondre / modifier (UPDATE) ses
--     avis (reply + reply_at). L'admin peut tout modifier (modération).
DROP POLICY IF EXISTS "marketplace_reviews_owner_update" ON public.marketplace_reviews;
CREATE POLICY "marketplace_reviews_owner_update"
  ON public.marketplace_reviews
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.diagnosticians d
      WHERE d.id = marketplace_reviews.diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.diagnosticians d
      WHERE d.id = marketplace_reviews.diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- 3d. service_role : accès complet (import GMB, seeds, Edge Functions, admin).
--     Les avis natifs sont créés via lien public côté serveur (service_role) ;
--     on ne donne PAS d'INSERT direct à anon/authenticated pour éviter le spam
--     d'avis (anti-abus géré au niveau application comme quote_requests).
DROP POLICY IF EXISTS "marketplace_reviews_service_all" ON public.marketplace_reviews;
CREATE POLICY "marketplace_reviews_service_all"
  ON public.marketplace_reviews
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 4. Trigger updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.touch_marketplace_reviews_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_marketplace_reviews_updated_at ON public.marketplace_reviews;
CREATE TRIGGER trg_marketplace_reviews_updated_at
  BEFORE UPDATE ON public.marketplace_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_marketplace_reviews_updated_at();
