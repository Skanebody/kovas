-- ============================================
-- KOVAS — Observatoire subscribers (Lot #144)
-- ============================================
-- Table simple de liste de diffusion pour le rapport mensuel public
-- « Observatoire KOVAS du Diagnostic Immobilier » (PDF généré dynamiquement).
--
-- Flux fonctionnel :
--   1. Visiteur de /observatoire clique « Télécharger le rapport mensuel »
--   2. Saisit son email + opt-in newsletter
--   3. Server Action `requestObservatoireReport` :
--      - Valide via Zod
--      - UPSERT sur (email) → si déjà présent, met à jour `last_sent_at`
--      - Génère le PDF via jsPDF (apps/web/src/lib/observatoire/pdf-generator.ts)
--      - Envoie par Resend (pièce jointe)
--      - Tracker PostHog `observatoire.report.requested`
--
-- RGPD :
--   - Pas de lien aux organisations (lead magnet public)
--   - Désinscription via lien unique dans chaque email
--   - Aucune autre donnée personnelle stockée (pas de nom, pas d'IP)
-- ============================================

CREATE TABLE IF NOT EXISTS observatoire_subscribers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL UNIQUE
                    CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'),
  newsletter_opt_in boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_sent_at      timestamptz,
  unsubscribed_at   timestamptz,
  -- Source de l'inscription (page d'arrivée, campagne, etc.)
  source            text NOT NULL DEFAULT 'observatoire'
);

-- Index pour lookup rapide email (UNIQUE crée déjà l'index, mais explicit pour
-- recherche partielle case-insensitive future)
CREATE INDEX IF NOT EXISTS idx_observatoire_subscribers_lower_email
  ON observatoire_subscribers (lower(email));

-- Index pour cron mensuel : envoyer rapport aux abonnés newsletter actifs
CREATE INDEX IF NOT EXISTS idx_observatoire_subscribers_active_newsletter
  ON observatoire_subscribers (last_sent_at)
  WHERE newsletter_opt_in = true AND unsubscribed_at IS NULL;

-- ============================================
-- RLS — lecture/écriture interdite côté anon/auth
-- Seuls les Edge Functions / Server Actions avec service role peuvent écrire
-- ============================================
ALTER TABLE observatoire_subscribers ENABLE ROW LEVEL SECURITY;

-- Aucune policy SELECT pour anon/authenticated → table fermée aux clients
-- Les Server Actions utilisent le service role qui bypasse RLS
COMMENT ON TABLE observatoire_subscribers IS
  'Liste de diffusion du rapport mensuel Observatoire KOVAS. RLS fermée — accès via service role uniquement (Server Actions).';
