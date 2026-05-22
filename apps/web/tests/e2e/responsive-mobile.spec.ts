/**
 * E2E (project mobile-chrome) — vérifie l'affichage sur Pixel 5 (375×851).
 *
 * Le testProjects "mobile-chrome" et "mobile-safari" pickent ce fichier via
 * testMatch dans playwright.config.ts.
 */

import { expect, test } from '@playwright/test'

test.describe('Responsive — mobile viewport (Pixel 5)', () => {
  test('homepage rend correctement sur mobile', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
    // Le viewport ne doit pas avoir d'overflow horizontal cassant
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 5
    })
    expect(overflow).toBe(false)
  })

  test('page pricing visible sur mobile', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.locator('h1').first()).toBeVisible()
  })
})
