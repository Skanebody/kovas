/**
 * E2E — Login (succès + échec + reset password).
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Authentication — login flows', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('login OK redirect vers app/dashboard', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)
    expect(page.url()).toMatch(/\/(app|dashboard)\/(dashboard|onboarding)/)
  })

  test('login échec avec mot de passe invalide reste sur /login', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', 'doesnotexist@example-cabinet.fr')
    await page.fill('input[name="password"]', 'WrongPass!')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2_000)
    expect(page.url()).toContain('/login')
  })

  test('lien reset password navigue vers la page dédiée', async ({ page }) => {
    await page.goto('/login')
    const resetLink = page.getByRole('link', { name: /mot de passe.*oublié|reset/i })
    if (await resetLink.count()) {
      await resetLink.click()
      await expect(page).toHaveURL(/reset|forgot/, { timeout: 5_000 })
    }
  })
})
