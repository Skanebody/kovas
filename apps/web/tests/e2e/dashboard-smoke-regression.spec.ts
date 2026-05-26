/**
 * E2E Playwright — Smoke régression sur les surfaces touchées par les sweeps
 * B79/B80/B81 (28 pages dashboard + 80 sub-composants) + nouvelles routes B82/B83.
 *
 * Objectif : détecter une régression 500 ou un mauvais status redirect (302
 * vers une route morte par ex.) sur les chemins critiques. **Aucun assert sur
 * du contenu** ici — les specs dédiées (refonte-surfaces, dashboard-algos-*,
 * dashboard-mission-flow) couvrent le contenu. Ici on regarde uniquement les
 * status codes.
 *
 * Catégories testées :
 *   1. Pages dashboard `/dashboard/*` (anon → 307 /login, jamais 500)
 *   2. Pages publiques `/*` (anon → 200, jamais 500)
 *   3. Sidebar : items canoniques (post-refonte) accessibles
 *
 * Authority : CLAUDE.md §22 + Lot B79/B80/B81 sweeps.
 */

import { expect, test } from '@playwright/test'

/* ────────────────────────────────────────────────────────────────────────── */
/* Routes /dashboard/* — anon doit être redirigé 307 vers /login              */
/* ────────────────────────────────────────────────────────────────────────── */

const DASHBOARD_ROUTES = [
  '/dashboard',
  '/dashboard/dashboard',
  '/dashboard/dossiers',
  '/dashboard/clients',
  '/dashboard/calendar',
  '/dashboard/capture',
  '/dashboard/facturation',
  '/dashboard/analytics',
  '/dashboard/messages',
  '/dashboard/factures',
  '/dashboard/devis',
  '/dashboard/properties',
  '/dashboard/account',
  '/dashboard/outils',
  '/dashboard/decouvrir',
  '/dashboard/decouvrir/algos', // Lot B82
] as const

test.describe('Smoke régression — routes dashboard protégées (Lot B79/B80/B81/B82/B83)', () => {
  for (const route of DASHBOARD_ROUTES) {
    test(`GET ${route} ne crashe PAS (anon → 307 /login)`, async ({ request }) => {
      const res = await request.get(route, { maxRedirects: 0 })
      // Comportement attendu pour anon :
      //   - 307 (middleware Supabase → /login)
      //   - 200 acceptable si auth bypass en dev
      //   - PAS 500 (régression)
      //   - PAS 404 (page doit exister post-sweeps)
      expect(res.status()).not.toBe(500)
      expect(res.status()).not.toBe(502)
      expect(res.status()).not.toBe(503)
      expect([200, 307]).toContain(res.status())

      if (res.status() === 307) {
        const location = res.headers().location ?? ''
        // La redirection doit pointer vers /login (sécurité), pas vers une
        // route morte ou un autre /dashboard/*
        expect(location).toContain('/login')
      }
    })
  }
})

/* ────────────────────────────────────────────────────────────────────────── */
/* Routes publiques `/*` — anon doit obtenir 200, jamais 500                  */
/* ────────────────────────────────────────────────────────────────────────── */

const PUBLIC_ROUTES = [
  '/',
  '/tarifs',
  '/fonctionnalites',
  '/comparatif',
  '/aide',
  '/contact',
  '/blog',
  '/temoignages',
  '/a-propos',
  '/observatoire',
  '/api-publique',
] as const

test.describe('Smoke régression — pages publiques (Lot B79/B80/B81)', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`GET ${route} retourne 200 (pas de 500 régression)`, async ({ request }) => {
      const res = await request.get(route)
      expect(res.status()).not.toBe(500)
      expect(res.status()).not.toBe(502)
      expect(res.status()).not.toBe(503)
      // Public attendu : 200 (rendu direct). 307/308 toléré si redirect interne.
      expect([200, 301, 307, 308]).toContain(res.status())
    })
  }
})

/* ────────────────────────────────────────────────────────────────────────── */
/* Nouvelles routes B82/B83 — invariants minimaux                             */
/* ────────────────────────────────────────────────────────────────────────── */

test.describe('Smoke régression — nouvelles routes B82/B83 stables', () => {
  test('B82 — /dashboard/decouvrir/algos répond (pas 404 ni 500)', async ({ request }) => {
    const res = await request.get('/dashboard/decouvrir/algos', { maxRedirects: 0 })
    expect(res.status()).not.toBe(404)
    expect(res.status()).not.toBe(500)
    expect([200, 307]).toContain(res.status())
  })

  test('B83 — /dashboard/dossiers/[id]/mission/flow scaffold présent', async ({ request }) => {
    const uuid = '00000000-0000-4000-8000-000000000000'
    const res = await request.get(`/dashboard/dossiers/${uuid}/mission/flow`, {
      maxRedirects: 0,
    })
    // Route existe : anon → 307, auth+inexistant → 404, jamais 500
    expect(res.status()).not.toBe(500)
    expect(res.status()).not.toBe(502)
    expect([307, 404]).toContain(res.status())
  })
})

/* ────────────────────────────────────────────────────────────────────────── */
/* Sidebar — items canoniques exposés dans le HTML post-refonte               */
/* (best-effort — skip si pas de session)                                     */
/* ────────────────────────────────────────────────────────────────────────── */

test.describe('Smoke régression — sidebar items canoniques (post-refonte)', () => {
  test('Sidebar contient les labels canoniques (post-B82 ajout Algorithmes)', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

    if (page.url().includes('/login')) {
      test.skip(true, 'Anon redirigé — sidebar nécessite session')
      return
    }

    const html = await page.content()
    // Items canoniques attendus post-refonte (labels FR)
    // Cf. apps/web/src/lib/sidebar/sidebar-items.ts
    expect(html).toMatch(/Dossiers/i)
    expect(html).toMatch(/Clients/i)
    expect(html).toMatch(/Algorithmes/i)
  })
})
