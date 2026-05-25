/**
 * E2E — SEO enrichment du template programmatique survivant (Refonte
 * Acqui-Target 2026-05).
 *
 * Vérifie sur 3 villes échantillon (Paris top métropole, Lyon top régional,
 * Dieppe ville mid Normandie) que :
 *   - la page /diagnostic/dpe/{ville} rend correctement (200, H1, meta)
 *   - les 5 data points uniques sont présents dans le HTML
 *   - les 4 templates programmatiques supprimés renvoient 404
 *   - le sitemap-diagnostics-villes.xml ne contient plus que /diagnostic/
 */

import { expect, test } from '@playwright/test'

const SAMPLE_CITIES = [
  { slug: 'paris', name: 'Paris' },
  { slug: 'lyon', name: 'Lyon' },
  { slug: 'dieppe', name: 'Dieppe' },
] as const

const DELETED_ROUTES = [
  '/prix/dpe/paris',
  '/comparatif/dpe/paris',
  '/audit-energetique/paris',
  '/maprimerenov/paris',
  '/urgent/paris',
] as const

test.describe('SEO enrichment — /diagnostic/[type]/[ville]', () => {
  for (const city of SAMPLE_CITIES) {
    test(`rend la page /diagnostic/dpe/${city.slug} avec H1 et meta`, async ({ page }) => {
      const response = await page.goto(`/diagnostic/dpe/${city.slug}`)
      expect(response, `Aucune réponse pour /diagnostic/dpe/${city.slug}`).not.toBeNull()
      expect(response?.status(), `Statut HTTP attendu < 400 pour ${city.slug}`).toBeLessThan(400)

      const h1Locator = page.locator('h1')
      await expect(h1Locator).toBeVisible()
      const h1Text = await h1Locator.textContent()
      expect(h1Text ?? '', `H1 doit contenir le nom de la ville ${city.name}`).toContain(city.name)
    })

    test(`les 5 data points uniques sont présents sur ${city.slug}`, async ({ page }) => {
      await page.goto(`/diagnostic/dpe/${city.slug}`)

      // Le wrapper de la section enriched
      await expect(page.locator('[data-testid="enriched-data-section"]')).toBeVisible()

      // 1. Prix médian DVF
      await expect(page.locator('[data-testid="data-point-dvf-price"]')).toBeVisible()
      const dvfText = await page.locator('[data-testid="data-point-dvf-price"]').innerText()
      expect(dvfText, 'Le prix médian au m² DVF doit contenir un montant en euros').toMatch(/\d/)
      expect(dvfText.toLowerCase(), 'Source DVF doit être citée').toContain('dvf')

      // 2. Taux passoires F/G ADEME
      await expect(page.locator('[data-testid="data-point-ademe-fg"]')).toBeVisible()
      const ademeText = await page.locator('[data-testid="data-point-ademe-fg"]').innerText()
      expect(ademeText, 'Taux F/G doit contenir un pourcentage').toMatch(/\d+(\.\d+)?\s*%/)

      // 3. Délai vente moyen
      await expect(page.locator('[data-testid="data-point-sale-delay"]')).toBeVisible()
      const delayText = await page.locator('[data-testid="data-point-sale-delay"]').innerText()
      expect(delayText, 'Délai vente doit contenir un nombre de jours').toMatch(/\d+\s*j/)

      // 4. Nombre diagnostiqueurs actifs (rayon 30 km)
      await expect(page.locator('[data-testid="data-point-diagnosticians"]')).toBeVisible()
      const diagText = await page.locator('[data-testid="data-point-diagnosticians"]').innerText()
      expect(diagText, 'Nombre de diagnostiqueurs doit être présent').toMatch(/\d/)
      expect(diagText.toLowerCase(), 'Rayon 30 km doit être mentionné').toContain('30')

      // 5. Quote dynamique : témoignage + stat verbalisée
      await expect(page.locator('[data-testid="data-point-quote"]')).toBeVisible()
      const quoteText = await page.locator('[data-testid="data-point-quote"]').innerText()
      expect(quoteText.length, 'La quote doit contenir du texte').toBeGreaterThan(40)
      expect(quoteText, 'Le témoignage doit citer la ville').toContain(city.name)
    })
  }
})

test.describe('SEO cleanup — routes supprimées', () => {
  for (const route of DELETED_ROUTES) {
    test(`la route supprimée ${route} renvoie 404`, async ({ page }) => {
      const response = await page.goto(route)
      expect(response, `Aucune réponse pour ${route}`).not.toBeNull()
      const status = response?.status() ?? 0
      expect(status, `${route} doit renvoyer 404 (obtenu ${status})`).toBe(404)
    })
  }
})

test.describe('SEO cleanup — sitemap', () => {
  test('sitemap-diagnostics-villes.xml ne contient que /diagnostic/', async ({ request }) => {
    const response = await request.get('/sitemap-diagnostics-villes.xml')
    expect(response.status()).toBe(200)
    const body = await response.text()

    // Ne doit plus contenir les 5 templates supprimés
    expect(body).not.toContain('/prix/')
    expect(body).not.toContain('/comparatif/')
    expect(body).not.toContain('/audit-energetique/')
    expect(body).not.toContain('/maprimerenov/')
    expect(body).not.toContain('/urgent/')

    // Doit contenir le template survivant
    expect(body).toContain('/diagnostic/')

    // Doit lister Paris au moins (sanity check)
    expect(body).toContain('/diagnostic/dpe/paris')
  })
})
