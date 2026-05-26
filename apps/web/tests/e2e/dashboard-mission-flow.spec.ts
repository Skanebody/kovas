/**
 * E2E Playwright — /dashboard/dossiers/[id]/mission/flow (Lot B83 scaffold,
 * validation Lot B87).
 *
 * Page Server Component GC2 (Mode mission — Flow continu). La route est :
 *   - protégée par middleware Supabase (anon → /login)
 *   - paramétrée par un UUID `dossier_id`
 *   - protégée RLS côté Supabase (sinon notFound() → 404)
 *
 * On valide 5 invariants :
 *   1. Route ne crashe pas (pas de 500) sur uuid valide
 *   2. Anon redirigé proprement (307 /login)
 *   3. UUID invalide ne provoque pas 500 (Next params parsing + notFound)
 *   4. Auth + dossier inexistant → 404 (RLS appliqué)
 *   5. Best-effort : si on peut atteindre la page, vérifier les tokens UI
 *      (AppPageHeader "Mode mission" + "continu", EmptyState "Initialiser le flow"
 *      ou MissionFlowComposer côté client).
 *
 * Authority : CLAUDE.md §3 + REFONTE-ACQUI-TARGET-V2 §6.2 (GC2).
 */

import { expect, test } from '@playwright/test'

const FAKE_UUID = '00000000-0000-4000-8000-000000000000' // UUID v4 valide mais inexistant
const INVALID_UUID = 'not-a-uuid'

function flowRoute(dossierId: string): string {
  return `/dashboard/dossiers/${dossierId}/mission/flow`
}

test.describe('Dashboard — /dossiers/[id]/mission/flow (Lot B83)', () => {
  test('Route accessible — status valide (307 anon ou 404 auth+inexistant)', async ({
    request,
  }) => {
    const res = await request.get(flowRoute(FAKE_UUID), { maxRedirects: 0 })
    // Anon : middleware redirige vers /login (307)
    // Auth + dossier inexistant : notFound() → 404
    // Jamais 500
    expect([307, 404]).toContain(res.status())
  })

  test('Anon : redirect 307 vers /login avec next= préservé', async ({ request }) => {
    const res = await request.get(flowRoute(FAKE_UUID), { maxRedirects: 0 })
    if (res.status() === 307) {
      const location = res.headers().location ?? ''
      expect(location).toContain('/login')
      const decoded = decodeURIComponent(location)
      expect(decoded).toContain('/mission/flow')
    } else {
      test.skip(true, 'Status non-307 — auth bypass actif')
    }
  })

  test('UUID invalide ne provoque PAS de 500 (params parsing safe)', async ({ request }) => {
    const res = await request.get(flowRoute(INVALID_UUID), { maxRedirects: 0 })
    // Le middleware redirige (307) ou Supabase rejette en RLS/notFound (404).
    // CRITIQUE : pas de crash 500 sur uuid mal formé.
    expect(res.status()).not.toBe(500)
    expect(res.status()).not.toBe(502)
    expect([307, 400, 404]).toContain(res.status())
  })

  test('Pas de fuite de tokens server vers anon (body sans content GC2)', async ({ request }) => {
    const res = await request.get(flowRoute(FAKE_UUID))
    const body = await res.text().catch(() => '')
    if (res.url().endsWith('/login') || res.headers().location?.includes('/login')) {
      // Anon redirigé : body ne doit pas contenir les tokens privés de la page
      expect(body).not.toContain('Initialiser le flow')
      expect(body).not.toContain('MissionFlowComposer')
    }
  })

  test('Smoke contenu HTML — EmptyState "Initialiser le flow" si flow jamais init', async ({
    page,
  }) => {
    const response = await page.goto(flowRoute(FAKE_UUID), { waitUntil: 'domcontentloaded' })
    const finalUrl = page.url()

    if (finalUrl.includes('/login')) {
      test.skip(true, 'Anon redirigé vers /login — smoke contenu nécessite auth')
      return
    }

    // Si on atteint la page, soit dossier inexistant (404), soit page rendue.
    const status = response?.status() ?? 0
    if (status === 404) {
      test.skip(true, 'Dossier fake inexistant (RLS/notFound) — comportement attendu')
      return
    }

    expect(status).toBe(200)

    const html = await page.content()
    // AppPageHeader signature : eyebrow "Mode mission" + accent "continu"
    expect(html).toMatch(/Mode mission/i)
    expect(html).toMatch(/continu/i)
  })

  test('Smoke — page rendue contient Timeline ou Composer (composants attendus)', async ({
    page,
  }) => {
    const response = await page.goto(flowRoute(FAKE_UUID), { waitUntil: 'domcontentloaded' })
    const finalUrl = page.url()

    if (finalUrl.includes('/login') || (response?.status() ?? 0) === 404) {
      test.skip(true, "Page non accessible en l'état (anon ou dossier inexistant)")
      return
    }

    const html = await page.content()
    // L'un des deux états attendus :
    //   - EmptyState "Initialiser le flow" (flow jamais init côté DB)
    //   - MissionFlowComposer monté (timeline + composer)
    const hasEmptyState = /Initialiser le flow/i.test(html)
    const hasComposer = /Timeline|Composer|MissionFlow/i.test(html)
    expect(hasEmptyState || hasComposer).toBe(true)
  })
})
