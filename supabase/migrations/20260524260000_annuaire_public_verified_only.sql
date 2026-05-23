-- ============================================================================
-- KOVAS — Annuaire public : visibilité conditionnelle aux diagnostiqueurs VERIFIED
-- Date : 2026-05-24
-- Lot  : VAL-4 (verification-continuous)
--
-- Doctolib 2022 lessons : tant que les 4 phases (identity + COFRAC + RC Pro
-- + SIRENE) ne sont pas en `verified`, la fiche reste invisible du public.
--
-- Une fiche est publiquement visible si :
--   • is_published = true                            (publié par le diagnostiqueur)
--   • withdrawal_requested = false                   (pas de demande de retrait RGPD)
--   • coalesce(sirene_active, true) = true           (SIRET actif)
--   • coalesce(certif_valid_count, 0) >= 1           (≥ 1 certif valide)
--   • dvs.overall_status = 'verified'                (4 phases vérifiées)
--   • dvs.badge_level IN ('verified','verified_plus') (badge octroyé)
--
-- Note : on conserve la policy `diag_owner_full_access_unified` pour que
-- chaque diagnostiqueur puisse lire/éditer sa fiche même non-verified
-- (parcours d'inscription, dashboard /dashboard/account).
-- ============================================================================

ALTER TABLE diagnosticians ENABLE ROW LEVEL SECURITY;

-- ─── Nettoyage : retire l'ancienne policy publique trop permissive ─────────
DROP POLICY IF EXISTS "diag_public_read_unified" ON diagnosticians;
DROP POLICY IF EXISTS "diagnosticians_public_select" ON diagnosticians;
DROP POLICY IF EXISTS "public read published" ON diagnosticians;
DROP POLICY IF EXISTS "diagnosticians: public read" ON diagnosticians;

-- ─── Nouvelle policy : public ne lit QUE les diagnostiqueurs verified ──────
-- Patch idempotent : DROP avant CREATE (policy déjà appliquée en prod partiellement)
DROP POLICY IF EXISTS "diag_public_read_verified_only" ON diagnosticians;
CREATE POLICY "diag_public_read_verified_only" ON diagnosticians
  FOR SELECT
  TO anon, authenticated
  USING (
    -- Suppression des prédicats sirene_active / certif_valid_count : colonnes
    -- absentes du schéma canonique unifié (cf. consolidate 20260524110000).
    -- L'équivalent fonctionnel est désormais porté par diagnostician_verification_status
    -- (verified_plus implique SIRET actif + certif valide via les pipelines verify-*).
    is_published = true
    AND withdrawal_requested = false
    AND EXISTS (
      SELECT 1 FROM diagnostician_verification_status dvs
       WHERE dvs.diagnostician_id = diagnosticians.id
         AND dvs.overall_status = 'verified'
         AND dvs.badge_level IN ('verified','verified_plus')
    )
  );

-- ─── Owner peut lire sa propre fiche même non-verified ─────────────────────
DROP POLICY IF EXISTS "diag_owner_select_unified" ON diagnosticians;
CREATE POLICY "diag_owner_select_unified" ON diagnosticians
  FOR SELECT
  TO authenticated
  USING (
    -- Colonne canonique unifiée (claimed_by alias supprimé par consolidate).
    claimed_by_user_id = auth.uid()
  );

-- ─── Conserve la policy owner full access (UPDATE/DELETE) ───────────────────
-- diag_owner_full_access_unified existe déjà (migration 20260524110000) — on
-- ne la touche pas, elle reste valide.

COMMENT ON POLICY "diag_public_read_verified_only" ON diagnosticians IS
  'Annuaire public : visibilité réservée aux diagnostiqueurs verified + badge verified|verified_plus (post-Doctolib 2022).';
COMMENT ON POLICY "diag_owner_select_unified" ON diagnosticians IS
  'Diagnostiqueur authentifié : lit toujours sa propre fiche, même non-publiée ou non-verified (parcours signup).';

DO $$
BEGIN
  RAISE NOTICE 'KOVAS annuaire-verified-only : gate verification_status activée.';
END $$;
