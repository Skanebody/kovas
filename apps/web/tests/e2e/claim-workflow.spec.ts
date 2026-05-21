/**
 * Test 3 — Claim workflow diagnostician.
 *
 * ⚠️ NON IMPLÉMENTÉ EN V1 — feature claim absente du codebase.
 *
 * Le brief G3 décrit :
 * - /reclamer-ma-fiche/find (recherche SIRET)
 * - Submit claim
 * - Admin approval → diagnostician.claim_status = 'claimed'
 *
 * État actuel : route absente, table `diagnosticians.claim_status` non créée.
 * Ce flux fait partie du module annuaire B2C (KOVAS Annuaire) non démarré.
 *
 * À activer lorsque le module sera développé :
 * 1. Retirer le test.skip()
 * 2. Créer un fixture diagnostician orphelin via admin client
 * 3. Soumettre le claim via UI
 * 4. Approve via admin client direct DB (ou /admin/* si UI dispo)
 * 5. Vérifier claim_status='claimed'
 */
import { test } from '@playwright/test'

test.describe('Claim workflow diagnostician', () => {
  test.skip(
    true,
    "Feature claim diagnostician non implémentée en V1 — routes /reclamer-ma-fiche/* absentes du codebase. À réactiver post-launch annuaire.",
  )

  test('claim → admin approve → claim_status=claimed', async ({ page }) => {
    // Stub conservé pour référence
    await page.goto('/reclamer-ma-fiche/find')
    // ... attendre implémentation
  })
})
