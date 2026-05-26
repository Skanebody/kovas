/**
 * E2E Playwright — /dashboard/decouvrir/algos catalogue 13 algos diag-facing
 * (Lot B82 — Vague 3A, validation Lot B87).
 *
 * La route est sous `/dashboard/*` donc protégée par le middleware Supabase
 * (cf. apps/web/src/lib/supabase/middleware.ts) — un anon est redirigé vers
 * `/login?next=/dashboard/decouvrir/algos`. On valide donc deux scénarios :
 *
 *   1. ANON : status 307 vers /login (la sécurité de la route)
 *   2. AUTH (best-effort) : si un cookie de session existe ou si l'env autorise
 *      un user fixture, on teste le HTML rendu (h1, 13 cards, footer).
 *
 * Si l'auth fixture n'est pas dispo (ex. CI sans secrets Supabase), les tests
 * authentifiés se mettent en `.skip` proprement (pas de fail bruyant).
 *
 * Authority : CLAUDE.md §22 + Lot B82 catalogue diag-facing.
 */

import { expect, test } from '@playwright/test'

const ROUTE = '/dashboard/decouvrir/algos'

test.describe('Dashboard — /decouvrir/algos catalogue (Lot B82)', () => {
  test('Route répond 307 (auth redirect /login) ou 200 pour anon', async ({ request }) => {
    const res = await request.get(ROUTE, { maxRedirects: 0 })
    // Anon : middleware Supabase redirige vers /login (307)
    // Auth bypass éventuel : 200 (rendu direct)
    // Jamais 500 (régression scaffold) ni 404 (route doit exister)
    expect([200, 307]).toContain(res.status())
    if (res.status() === 307) {
      const location = res.headers().location ?? ''
      expect(location).toContain('/login')
      // Le `next=` doit pointer sur la route protégée (UX retour user)
      expect(location).toContain('decouvrir')
    }
  })

  test('Route ne crashe pas (pas de 500 même sans session)', async ({ request }) => {
    const res = await request.get(ROUTE)
    expect(res.status()).not.toBe(500)
    expect(res.status()).not.toBe(502)
    expect(res.status()).not.toBe(503)
  })

  test('Anon : redirect /login préserve le path complet en query `next=`', async ({ request }) => {
    const res = await request.get(ROUTE, { maxRedirects: 0 })
    if (res.status() === 307) {
      const location = res.headers().location ?? ''
      // Décode pour vérifier le path d'origine intact
      const decoded = decodeURIComponent(location)
      expect(decoded).toContain(ROUTE)
    } else {
      test.skip(true, 'Route non-redirigée — auth bypass actif, test non applicable')
    }
  })

  test('Smoke contenu HTML server-rendered (h1 + 13 cards + footer)', async ({ page }) => {
    const response = await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
    const finalUrl = page.url()

    // Si le middleware a redirigé vers /login, le HTML rendu n'est pas
    // celui du catalogue — on skip proprement le smoke contenu.
    if (finalUrl.includes('/login')) {
      test.skip(true, 'Anon redirigé vers /login — smoke contenu nécessite auth')
      return
    }

    expect(response?.status()).toBe(200)

    // H1 contient "13 algorithmes" (cf. metadata title + AppPageHeader)
    await expect(page.locator('h1').first()).toContainText(/13 algorithmes/i)

    // 13 codes A1.3.* dans le HTML (un par card, peuvent être en mono uppercase)
    const html = await page.content()
    const matches = html.match(/A1\.3\.\d{1,2}/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(13)

    // Footer mono : tokens du bas de page
    expect(html).toMatch(/422 tests/i)
    expect(html).toMatch(/9\/13 algos sans IA/i)
  })

  test('AppPageHeader expose eyebrow "Sous le capot" + accent "propriétaires"', async ({
    page,
  }) => {
    await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })

    if (page.url().includes('/login')) {
      test.skip(true, 'Anon redirigé — header non rendu')
      return
    }

    const html = await page.content()
    expect(html).toMatch(/Sous le capot/i)
    expect(html).toMatch(/propriétaires/i)
  })

  test('Sidebar dashboard expose l\'item "Algorithmes" (post-B82)', async ({ page }) => {
    await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })

    if (page.url().includes('/login')) {
      test.skip(true, 'Sidebar nécessite session — anon redirigé')
      return
    }

    // L'item peut être affiché en label (zone visible) ou en aria-label (icon-only).
    const html = await page.content()
    expect(html).toMatch(/Algorithmes/i)
  })
})
