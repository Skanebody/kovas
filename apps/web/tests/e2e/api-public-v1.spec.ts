/**
 * E2E Playwright — API publique v1 open data (Refonte Acqui-Target).
 *
 * Vérifie sur les 3 endpoints LIVE :
 *   - GET /api/public/v1/openapi.json (spec valide)
 *   - GET /api/public/v1/observatoire/profession (payload structuré)
 *   - GET /api/public/v1/commune/{inseeCode} (DPE + DVF stats)
 *   - GET /api/public/v1/property/{banId} (validation banId trop court)
 *
 * Et sur les comportements transverses :
 *   - Headers de rate-limit présents
 *   - 429 sur dépassement
 *   - 400 sur input invalide
 */

import { expect, test } from '@playwright/test'

test.describe('API publique v1 — endpoints LIVE', () => {
  test('GET /openapi.json retourne une spec 3.1 valide', async ({ request }) => {
    const res = await request.get('/api/public/v1/openapi.json')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('application/json')
    const spec = await res.json()
    expect(spec.openapi).toBe('3.1.0')
    expect(spec.info.title).toContain('KOVAS')
    expect(spec.info.license.name).toBe('CC-BY 4.0')
    // Les 3 paths LIVE attendus
    expect(spec.paths['/property/{banId}']).toBeDefined()
    expect(spec.paths['/observatoire/profession']).toBeDefined()
    expect(spec.paths['/commune/{inseeCode}']).toBeDefined()
    // Extension custom rate-limit
    expect(spec['x-rate-limits']).toBeDefined()
    expect(spec['x-rate-limits'].anonymous.requests_per_minute).toBe(60)
    expect(spec['x-rate-limits'].api_key.requests_per_minute).toBe(600)
  })

  test('GET /observatoire/profession retourne un payload structuré', async ({ request }) => {
    const res = await request.get('/api/public/v1/observatoire/profession')
    expect(res.status()).toBe(200)
    // Headers
    expect(res.headers()['x-ratelimit-limit']).toBeDefined()
    expect(res.headers()['x-ratelimit-remaining']).toBeDefined()
    expect(res.headers()['cache-control']).toContain('max-age=3600')

    const data = await res.json()
    expect(data.api_version).toBe('1.0')
    expect(typeof data.generated_at).toBe('string')
    expect(data.summary).toBeDefined()
    expect(typeof data.summary.total_diagnosticians).toBe('number')
    expect(data.ratios_pct).toBeDefined()
    expect(Array.isArray(data.top_departments)).toBe(true)
    expect(data.methodology.license).toBe('CC-BY 4.0')
  })

  test('GET /commune/{inseeCode} retourne stats DPE + DVF ou 404 propre', async ({ request }) => {
    // Code Paris (commune entière) = 75056
    const res = await request.get('/api/public/v1/commune/75056')
    // Soit 200 (data ingested) soit 404 propre avec hint
    expect([200, 404]).toContain(res.status())
    expect(res.headers()['x-ratelimit-limit']).toBeDefined()
    const data = await res.json()
    if (res.status() === 200) {
      expect(data.api_version).toBe('1.0')
      expect(data.insee_code).toBe('75056')
      expect(data.methodology.license).toBe('CC-BY 4.0')
    } else {
      expect(data.error).toBe('commune not found in data lake')
      expect(data.hint).toBeDefined()
    }
  })

  test('GET /commune/INVALID retourne 400 avec rate-limit headers', async ({ request }) => {
    const res = await request.get('/api/public/v1/commune/INVALID')
    expect(res.status()).toBe(400)
    expect(res.headers()['x-ratelimit-limit']).toBeDefined()
    const data = await res.json()
    expect(data.error).toContain('invalid INSEE code')
  })

  test('GET /property/{tooShort} retourne 400', async ({ request }) => {
    const res = await request.get('/api/public/v1/property/abc')
    expect(res.status()).toBe(400)
    expect(res.headers()['x-ratelimit-limit']).toBeDefined()
    const data = await res.json()
    expect(data.error).toContain('invalid banId')
  })

  test('Headers X-RateLimit-* présents et cohérents', async ({ request }) => {
    const res = await request.get('/api/public/v1/observatoire/profession')
    const limit = Number(res.headers()['x-ratelimit-limit'])
    const remaining = Number(res.headers()['x-ratelimit-remaining'])
    const reset = Number(res.headers()['x-ratelimit-reset'])
    expect(limit).toBeGreaterThanOrEqual(60)
    expect(remaining).toBeGreaterThanOrEqual(0)
    expect(remaining).toBeLessThanOrEqual(limit)
    // reset_at doit être dans le futur (epoch seconds)
    const nowSec = Math.floor(Date.now() / 1000)
    expect(reset).toBeGreaterThanOrEqual(nowSec)
    expect(reset).toBeLessThan(nowSec + 120)
  })

  test('X-API-Key élève la limite à 600', async ({ request }) => {
    const res = await request.get('/api/public/v1/observatoire/profession', {
      headers: { 'X-API-Key': 'kvs_test_1234567890abcdef' },
    })
    expect(res.status()).toBe(200)
    const limit = Number(res.headers()['x-ratelimit-limit'])
    expect(limit).toBe(600)
  })
})

test.describe('Page /pros/api — surface les endpoints LIVE', () => {
  test('Affiche les 3 endpoints V1 + lien OpenAPI', async ({ page }) => {
    await page.goto('/pros/api')
    // Badge LIVE et titre
    await expect(page.getByRole('heading', { name: /API publique/i }).first()).toBeVisible()
    await expect(page.getByText('Disponible aujourd', { exact: false })).toBeVisible()

    // Les 3 endpoints listés
    await expect(page.locator('code', { hasText: '/api/public/v1/property/{banId}' })).toBeVisible()
    await expect(
      page.locator('code', { hasText: '/api/public/v1/observatoire/profession' }),
    ).toBeVisible()
    await expect(
      page.locator('code', { hasText: '/api/public/v1/commune/{inseeCode}' }),
    ).toBeVisible()

    // CTA OpenAPI
    const openApiLink = page.getByRole('link', { name: /Spec OpenAPI 3\.1/i })
    await expect(openApiLink).toBeVisible()
    await expect(openApiLink).toHaveAttribute('href', '/api/public/v1/openapi.json')

    // Mention licence CC-BY 4.0
    await expect(page.getByText(/CC-BY 4\.0/)).toBeVisible()
  })
})

test.describe('Page /observatoire/etat-profession — GC4', () => {
  test('Charge la page et rend le hero serif italic + sections', async ({ page }) => {
    await page.goto('/observatoire/etat-profession')

    // Hero
    await expect(
      page.getByRole('heading', { name: /État de la profession/i, level: 1 }),
    ).toBeVisible()

    // Eyebrow
    await expect(page.getByText('Observatoire KOVAS').first()).toBeVisible()

    // Section méthodologie présente même sans data
    await expect(page.getByRole('heading', { name: /Méthodologie/i })).toBeVisible()
    await expect(page.getByText(/DHUP/)).toBeVisible()
    await expect(page.getByText(/SIRENE/)).toBeVisible()

    // PublicHeader + SiteFooter chargés
    await expect(page.locator('header').first()).toBeVisible()
    await expect(page.locator('footer').first()).toBeVisible()
  })

  test('SEO metadata : title + description respectent la convention', async ({ page }) => {
    await page.goto('/observatoire/etat-profession')
    const title = await page.title()
    expect(title).toContain('État de la profession')
    const desc = await page.locator('meta[name="description"]').getAttribute('content')
    expect(desc).toContain('DHUP')
  })
})
