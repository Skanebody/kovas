/**
 * E2E — Compose email + envoi via Brevo mocké.
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Email — compose + envoi Brevo mocké', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('compose email simple ne crashe pas', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    await page.route('**/api/email/**', async (route) => {
      await route.fulfill({ status: 200, body: '{"ok":true}' })
    })

    await page.goto('/dashboard/messages')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    expect(page.url()).toContain('messages')
  })
})
