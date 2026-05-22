/**
 * E2E (project tablet) — affichage sur iPad Pro 11 (834×1194).
 */

import { expect, test } from '@playwright/test'

test.describe('Responsive — tablet (iPad Pro 11)', () => {
  test('dashboard rend en layout tablet', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
    const width = await page.evaluate(() => window.innerWidth)
    expect(width).toBeGreaterThanOrEqual(700)
  })
})
