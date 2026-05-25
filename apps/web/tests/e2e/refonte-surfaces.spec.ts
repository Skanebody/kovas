/**
 * E2E Playwright — surfaces neuves de la refonte acqui-target (Lot B38).
 *
 * Couvre les comportements infrastructure-level qui ne dépendent pas du
 * contenu DB (donc stables en CI sans seed) :
 *   - Redirects 301 /pros/* → /* (Lot B33)
 *   - Admin gate /admin/* anon → / (sécurité)
 *   - /tarifs 3 onglets canoniques + deep-link ?tab= (Lot B34)
 *   - Homepage 8 sections cibles + CTA conversion (Lot B35)
 *   - API publique v1 path renommé toujours fonctionnel (regression)
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §8 (sécurité) + §6.4 (sitemap surfaces).
 */

import { expect, test } from '@playwright/test'

test.describe('Refonte — redirects 301 /pros/* → /*', () => {
  test('GET /pros/tarifs redirige (301) vers /tarifs', async ({ request }) => {
    const res = await request.get('/pros/tarifs', { maxRedirects: 0 })
    expect(res.status()).toBe(301)
    const location = res.headers().location
    expect(location).toBe('/tarifs')
  })

  test('GET /pros/api redirige (301) vers /api', async ({ request }) => {
    const res = await request.get('/pros/api', { maxRedirects: 0 })
    expect(res.status()).toBe(301)
    expect(res.headers().location).toBe('/api')
  })

  test('GET /pros/observatoire redirige (301) vers /observatoire', async ({ request }) => {
    const res = await request.get('/pros/observatoire', { maxRedirects: 0 })
    expect(res.status()).toBe(301)
    expect(res.headers().location).toBe('/observatoire')
  })

  test('GET /pros (racine) redirige (301) vers /', async ({ request }) => {
    const res = await request.get('/pros', { maxRedirects: 0 })
    expect(res.status()).toBe(301)
    expect(res.headers().location).toBe('/')
  })
})

test.describe('Refonte — admin gate /admin/* anon → /', () => {
  test('GET /admin/refonte anon ne révèle PAS la page admin', async ({ request }) => {
    const res = await request.get('/admin/refonte', { maxRedirects: 0 })
    // Soit redirect (302/307) vers / ou /login, soit 404 — jamais 200 anon
    expect([301, 302, 307, 308, 404]).toContain(res.status())
    if (res.status() >= 300 && res.status() < 400) {
      const location = res.headers().location ?? ''
      // Ne doit JAMAIS rester sur /admin/refonte
      expect(location.startsWith('/admin/refonte')).toBe(false)
    }
  })

  test('GET /admin/press anon ne révèle PAS la console presse', async ({ request }) => {
    const res = await request.get('/admin/press', { maxRedirects: 0 })
    expect([301, 302, 307, 308, 404]).toContain(res.status())
  })

  test('GET /admin/renewals anon ne révèle PAS le cockpit renouvellements', async ({ request }) => {
    const res = await request.get('/admin/renewals', { maxRedirects: 0 })
    expect([301, 302, 307, 308, 404]).toContain(res.status())
  })

  test('GET /admin/churn anon ne révèle PAS le cockpit churn', async ({ request }) => {
    const res = await request.get('/admin/churn', { maxRedirects: 0 })
    expect([301, 302, 307, 308, 404]).toContain(res.status())
  })
})

test.describe('Refonte — /tarifs 3 onglets canoniques (Lot B34)', () => {
  test('GET /tarifs (default) charge et expose les 3 onglets', async ({ page }) => {
    await page.goto('/tarifs')
    await expect(page).toHaveTitle(/tarifs|prix/i)
    // Les 3 onglets canoniques doivent être visibles (role=tab)
    await expect(page.getByRole('tab', { name: /^Logiciel/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /^Annuaire/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /^Bundles/ })).toBeVisible()
  })

  test('GET /tarifs?tab=annuaire active l’onglet Annuaire par défaut', async ({ page }) => {
    await page.goto('/tarifs?tab=annuaire')
    const annuaireTab = page.getByRole('tab', { name: /^Annuaire/ })
    await expect(annuaireTab).toHaveAttribute('aria-selected', 'true')
  })

  test('GET /tarifs?tab=bundles active l’onglet Bundles par défaut', async ({ page }) => {
    await page.goto('/tarifs?tab=bundles')
    const bundlesTab = page.getByRole('tab', { name: /^Bundles/ })
    await expect(bundlesTab).toHaveAttribute('aria-selected', 'true')
  })
})

test.describe('Refonte — Homepage 8 sections (Lot B35)', () => {
  test('Homepage charge avec hero "copilote des diagnostiqueurs" et CTA essai', async ({
    page,
  }) => {
    await page.goto('/')
    // Hero — la phrase éditoriale (peut varier en casse / accents)
    await expect(page.locator('h1').first()).toContainText(/copilote des diagnostiqueurs/i)
    // CTA d'essai 30 jours (chartreuse conversion V5)
    await expect(page.getByRole('link', { name: /Essai 30 jours/i }).first()).toBeVisible()
  })

  test('Homepage expose la table comparative Liciel vs KOVAS', async ({ page }) => {
    await page.goto('/')
    // Section comparative — repère par mot-clé sobre
    const liciel = page.getByText(/Liciel/i).first()
    await expect(liciel).toBeVisible()
  })
})

test.describe('Refonte — API publique v1 regression (Lot B19/B25)', () => {
  test('GET /api/public/v1/openapi.json reste accessible (regression)', async ({ request }) => {
    const res = await request.get('/api/public/v1/openapi.json')
    expect(res.status()).toBe(200)
    const spec = await res.json()
    expect(spec.openapi).toBe('3.1.0')
  })
})
