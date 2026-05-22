/**
 * E2E — Endpoint /api/health retourne 200 ou 503 (observabilité Lot Q-7).
 */

import { expect, test } from '@playwright/test'

test.describe('Health endpoint — /api/health', () => {
  test('GET /api/health retourne 200 ou 503 + JSON valide', async ({ request }) => {
    const response = await request.get('/api/health')
    expect([200, 503]).toContain(response.status())
    const body = await response.json()
    expect(body).toHaveProperty('status')
    expect(['healthy', 'degraded', 'ok', 'down', 'error']).toContain(body.status)
    expect(Array.isArray(body.checks)).toBe(true)
  })
})
