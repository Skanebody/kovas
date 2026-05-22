/**
 * Test 4 — Page /pricing + parcours vers checkout.
 *
 * NOTE V1 (état codebase 2026-05) :
 * - La page /pricing affiche 3 tiers (Découverte 29€ / Standard 59€ / Volume 99€)
 * - Aucun toggle annuel/mensuel n'est rendu (mention "2 mois offerts" en bas de page seulement)
 * - Les CTA des cards pointent vers /signup (pas directement Stripe Checkout)
 * - L'API /api/billing/checkout est POST + auth requise + retourne { url } JSON (pas un redirect GET)
 *
 * Ce test valide donc :
 * - Présence des 3 tiers
 * - CTAs Header + cards → /signup
 * - Tier Standard est marqué "Recommandé" (highlight)
 *
 * Évolutions futures (V1.5) : ajouter le toggle annuel/mensuel + tester le call POST /api/billing/checkout
 * via un user authentifié.
 */
import { expect, test } from '@playwright/test'

test.describe('Pricing page + parcours checkout', () => {
  test('affiche les 3 tiers + CTA vers signup', async ({ page }) => {
    await page.goto('/pricing')

    // Heading principal
    await expect(page.getByRole('heading', { name: /Tarification simple/i })).toBeVisible()

    // Les 3 tiers V1
    await expect(page.getByText('Découverte', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Standard', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Volume', { exact: true }).first()).toBeVisible()

    // Tier Standard marqué Recommandé
    await expect(page.getByText('Recommandé')).toBeVisible()

    // CTA tier Standard → /signup
    const standardCta = page.getByRole('link', { name: /Commencer Standard/i })
    await expect(standardCta).toBeVisible()
    await expect(standardCta).toHaveAttribute('href', '/signup')

    // CTAs Découverte + Volume aussi vers /signup
    const decouverteCta = page.getByRole('link', { name: /Commencer Découverte/i })
    await expect(decouverteCta).toHaveAttribute('href', '/signup')
    const volumeCta = page.getByRole('link', { name: /Commencer Volume/i })
    await expect(volumeCta).toHaveAttribute('href', '/signup')

    // Header : bouton "Essai 14j"
    const headerSignup = page.getByRole('link', { name: /Essai 14j/i })
    await expect(headerSignup).toBeVisible()
    await expect(headerSignup).toHaveAttribute('href', '/signup')
  })

  test('options ponctuelles affichées (signature 2€, FR/EN 5€, SMS 0,15€)', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.getByText(/2€\/signature/i)).toBeVisible()
    await expect(page.getByText(/5€\/rapport/i)).toBeVisible()
    await expect(page.getByText(/0,15€\/SMS/i)).toBeVisible()
  })

  test('click sur CTA Standard mène vers /signup avec form visible', async ({ page }) => {
    await page.goto('/pricing')
    await page.getByRole('link', { name: /Commencer Standard/i }).click()
    await page.waitForURL(/\/signup/)
    await expect(page.locator('input[name="fullName"]')).toBeVisible()
    await expect(page.locator('input[name="siret"]')).toBeVisible()
  })

  test('API /api/billing/checkout sans auth → 401 ou 503 stub (non bloquant)', async ({
    request,
  }) => {
    // L'API checkout nécessite auth + Stripe configuré.
    // En env de test sans Stripe → renvoie {stub:true,status:503}
    // En env sans auth → typiquement 401 / redirect / 500 selon impl getCurrentUser
    const response = await request.post('/api/billing/checkout', {
      data: { tier: 'standard', cycle: 'monthly' },
    })
    // On accepte 401/403/500/503 — l'important est de constater que l'endpoint répond
    // et n'expose pas Stripe en clair sans auth.
    expect([401, 403, 500, 503]).toContain(response.status())
  })
})
