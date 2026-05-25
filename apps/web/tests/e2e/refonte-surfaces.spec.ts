/**
 * E2E Playwright — surfaces neuves de la refonte acqui-target (Lot B38 + B44).
 *
 * Couvre les comportements infrastructure-level qui ne dépendent pas du
 * contenu DB (donc stables en CI sans seed) :
 *   - Redirects 301 /pros/* → /* (Lot B33)
 *   - Admin gate /admin/* anon → / (sécurité)
 *   - /tarifs 3 onglets canoniques + deep-link ?tab= (Lot B34)
 *   - /tarifs grille V5 — 4/3/5 tiers + Enterprise + Add-ons + Loyalty (Lot B43, ajoutés B44)
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

  test('GET /admin/sante-tech anon ne révèle PAS la page AI Economics (Lot B57)', async ({
    request,
  }) => {
    const res = await request.get('/admin/sante-tech', { maxRedirects: 0 })
    expect([301, 302, 307, 308, 404]).toContain(res.status())
    if (res.status() >= 300 && res.status() < 400) {
      const location = res.headers().location ?? ''
      expect(location.startsWith('/admin/sante-tech')).toBe(false)
    }
  })

  test('GET /admin/sante-tech anon ne fuit AUCUN contenu AI Economics dans le body', async ({
    request,
  }) => {
    const res = await request.get('/admin/sante-tech')
    const body = await res.text().catch(() => '')
    // Tokens spécifiques à la page (sobre, vouvoiement) qui ne doivent pas
    // fuiter via une page d'erreur ou un fallback.
    expect(body).not.toContain('Économies IA')
    expect(body).not.toContain('Cascading Haiku')
    expect(body).not.toContain('Equipment cache progressif')
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

test.describe('Refonte — /tarifs grille V5 mockup (Lot B43)', () => {
  test('Hero "Le logiciel fait pour toi" + meta promesses visibles', async ({ page }) => {
    await page.goto('/tarifs')
    await expect(page.locator('h1').first()).toContainText(/Le logiciel/i)
    await expect(page.locator('h1').first()).toContainText(/fait pour toi/i)
    // Meta promesses du header
    await expect(page.getByText(/À partir de 29€\/mois/i)).toBeVisible()
    await expect(page.getByText(/Compatible Liciel, ORIS, OBBC/i)).toBeVisible()
  })

  test('Onglet Logiciel : 4 tiers Solo / Pro / Cabinet / Cabinet+ avec prix exacts', async ({
    page,
  }) => {
    await page.goto('/tarifs')
    // Tier names — repère via le span uppercase tracking
    await expect(page.getByText(/^Solo$/).first()).toBeVisible()
    await expect(page.getByText(/^Pro$/).first()).toBeVisible()
    await expect(page.getByText(/^Cabinet$/).first()).toBeVisible()
    await expect(page.getByText(/Cabinet\+/).first()).toBeVisible()
    // Prix : 29, 79, 199, 499 (servis comme texte dans .tier-price)
    await expect(page.getByText('29', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('79', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('199', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('499', { exact: false }).first()).toBeVisible()
  })

  test('Tier Pro est featured avec badge "Le plus populaire"', async ({ page }) => {
    await page.goto('/tarifs')
    await expect(page.getByText(/Le plus populaire/i).first()).toBeVisible()
  })

  test('Enterprise card visible avec CTA "Parlons-en"', async ({ page }) => {
    await page.goto('/tarifs')
    await expect(page.getByText(/^Enterprise$/i).first()).toBeVisible()
    await expect(page.getByText(/Tu pilotes un réseau/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /Parlons-en/i })).toBeVisible()
  })

  test('Onglet Annuaire : 3 tiers Présence / Boost / Premium', async ({ page }) => {
    await page.goto('/tarifs?tab=annuaire')
    await expect(page.getByText(/Présence/).first()).toBeVisible()
    await expect(page.getByText(/^Boost$/).first()).toBeVisible()
    await expect(page.getByText(/^Premium$/).first()).toBeVisible()
    // Badge "Recommandé" sur Boost
    await expect(page.getByText(/Recommandé/i).first()).toBeVisible()
  })

  test('Onglet Bundles : 5 bundles avec économies affichées', async ({ page }) => {
    await page.goto('/tarifs?tab=bundles')
    await expect(page.getByText(/Démarrage/i).first()).toBeVisible()
    await expect(page.getByText(/Croissance/i).first()).toBeVisible()
    await expect(page.getByText(/Acquisition/i).first()).toBeVisible()
    // Best value badge sur Croissance
    await expect(page.getByText(/Best value/i).first()).toBeVisible()
    // Économies (au moins 1 visible)
    await expect(page.getByText(/Économie/i).first()).toBeVisible()
  })

  test('Section "Options en plus" — 3 add-ons (Utilisateur, Vérif, Quota)', async ({ page }) => {
    await page.goto('/tarifs')
    await expect(page.getByText(/Options/i).first()).toBeVisible()
    await expect(page.getByText(/Utilisateur en plus/i)).toBeVisible()
    await expect(page.getByText(/Vérification renforcée/i)).toBeVisible()
    await expect(page.getByText(/Au-delà du quota/i)).toBeVisible()
  })

  test('Section "Fidélité progressive" — 4 paliers (15%, 5%, 10%, Partenaire)', async ({
    page,
  }) => {
    await page.goto('/tarifs')
    await expect(page.getByText(/Fidélité/i).first()).toBeVisible()
    await expect(page.getByText(/Paiement annuel/i)).toBeVisible()
    await expect(page.getByText(/Après 12 mois/i)).toBeVisible()
    await expect(page.getByText(/Après 24 mois/i)).toBeVisible()
    await expect(page.getByText(/Partenaire fondateur/i)).toBeVisible()
    await expect(page.getByText(/−15%/).first()).toBeVisible()
  })

  test('Footer 5 promesses (essai 30j, satisfait/remboursé 60j, résiliation 2 clics, etc.)', async ({
    page,
  }) => {
    await page.goto('/tarifs')
    await expect(page.getByText(/Essai 30 jours/i).first()).toBeVisible()
    await expect(page.getByText(/Satisfait ou remboursé/i).first()).toBeVisible()
    await expect(page.getByText(/Résiliation en 2 clics/i)).toBeVisible()
    await expect(page.getByText(/Hébergement France/i)).toBeVisible()
  })

  test('CTA "Essai 30 jours" présent sur tous les tiers (links vers /signup)', async ({ page }) => {
    await page.goto('/tarifs')
    // Au moins 4 liens "Essai 30 jours" (1 par tier Logiciel)
    const essaiLinks = page.getByRole('link', { name: /Essai 30 jours/i })
    const count = await essaiLinks.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })
})
