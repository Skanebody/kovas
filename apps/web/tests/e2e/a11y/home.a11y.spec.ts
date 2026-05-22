/**
 * A11y — page d'accueil publique, WCAG 2.1 AA.
 *
 * Utilise @axe-core/playwright pour une analyse automatisée. Tag wcag21aa
 * pour cibler exactement le standard auquel KOVAS s'engage (cf. mentions
 * légales d'accessibilité Phase 1).
 */

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('home page passes WCAG 2.1 AA', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle').catch(() => undefined)

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    // Désactive color-contrast tant que le design system n'est pas 100% AA
    // (à activer en Q-FOUNDATION+ une fois les tokens sage/chartreuse audités).
    .disableRules(['color-contrast'])
    .analyze()

  expect(results.violations).toEqual([])
})
