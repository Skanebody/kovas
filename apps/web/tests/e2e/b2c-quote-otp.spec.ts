/**
 * Test 2 — Demande devis B2C avec OTP SMS (DEV_MODE).
 *
 * ⚠️ NON IMPLÉMENTÉ EN V1 — feature annuaire B2C absente du codebase.
 *
 * Le brief G3 décrit un flux :
 * - /diagnostiqueurs/[dept]/[ville] (pages publiques annuaire)
 * - Bouton "Demander un devis"
 * - Form 3 étapes (contact → OTP SMS → confirmation)
 * - API /api/leads/send-otp avec OTP_DEV_MODE=true
 *
 * État actuel : aucune de ces routes n'existe (cf. apps/web/src/app/).
 * KOVAS V1 actuel = uniquement le SaaS B2B (KOVAS 360).
 * L'annuaire B2C (KOVAS Annuaire) est planifié mais pas démarré.
 *
 * À activer lorsque les routes seront implémentées :
 * 1. Retirer le test.skip()
 * 2. Vérifier que process.env.OTP_DEV_MODE === 'true'
 * 3. Adapter les sélecteurs aux champs réels du form
 */
import { test } from '@playwright/test'

test.describe('Demande devis B2C avec OTP', () => {
  test.skip(
    true,
    "Feature annuaire B2C + OTP SMS non implémentée en V1 — routes /diagnostiqueurs/* et /api/leads/* absentes du codebase. À réactiver post-launch annuaire.",
  )

  test('quote request with OTP verification', async ({ page }) => {
    // Stub conservé pour référence — body activé après implémentation annuaire B2C.
    await page.goto('/diagnostiqueurs/seine-maritime/dieppe')
    // ... voir docs/g3-tests-e2e-spec.md (à créer) pour le flux complet
  })
})
