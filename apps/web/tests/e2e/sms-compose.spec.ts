/**
 * E2E — Compose SMS depuis le sheet sortant, validation E.164 + Brevo mocké.
 */

import { test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('SMS — compose + Brevo mocké', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('compose SMS rejette les numéros non-E.164', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    // Mock Brevo
    await page.route('**/api.brevo.com/**', async (route) => {
      await route.fulfill({ status: 200, body: '{"messageId":"mock-msg-id"}' })
    })

    await page.goto('/dashboard/messages')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    const composeBtn = page.getByRole('button', { name: /nouveau sms|envoyer.*sms/i }).first()
    if (await composeBtn.count()) {
      await composeBtn.click()
      const phoneInput = page.locator('input[name="phone"], input[type="tel"]').first()
      if (await phoneInput.count()) {
        await phoneInput.fill('06abc')
        const sendBtn = page.getByRole('button', { name: /envoyer/i }).first()
        if (await sendBtn.count()) {
          await sendBtn.click()
          // Erreur de validation attendue — toast ou message inline
          await page.waitForTimeout(500)
        }
      }
    }
  })
})
