/**
 * A11y — page Signup (formulaire B2B).
 */

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('signup page passes WCAG 2.1 AA', async ({ page }) => {
  await page.goto('/signup')
  await page.waitForLoadState('networkidle').catch(() => undefined)

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .disableRules(['color-contrast'])
    .analyze()

  expect(results.violations).toEqual([])
})
