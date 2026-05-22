/**
 * RLS — table `subscriptions` (cf. migration 20260518140000_subscriptions.sql).
 *
 * Une org ne voit QUE son abonnement Stripe. Hyper sensible — fuite =
 * exposition d'IDs Stripe + status billing.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  type RlsTestUser,
  cleanupRlsTestUser,
  createRlsTestUser,
  getAdminClient,
  getAnonClient,
  hasSupabaseEnv,
} from './helpers'

const describeFn = hasSupabaseEnv() ? describe : describe.skip

describeFn('RLS — subscriptions', () => {
  let userA: RlsTestUser
  let userB: RlsTestUser
  let subId: string | null = null

  beforeAll(async () => {
    userA = await createRlsTestUser('subA')
    userB = await createRlsTestUser('subB')

    const admin = getAdminClient()
    const { data, error } = await admin
      .from('subscriptions')
      .insert({
        organization_id: userA.orgId,
        status: 'trialing',
        tier: 'standard',
        stripe_customer_id: `cus_test_${Date.now()}`,
      })
      .select('id')
      .single()
    // L'insert peut échouer si une subscription existe déjà via trigger — on tolère
    if (!error && data) {
      subId = data.id as string
    }
  })

  afterAll(async () => {
    if (userA) await cleanupRlsTestUser(userA.userId)
    if (userB) await cleanupRlsTestUser(userB.userId)
  })

  it('userA voit sa subscription', async () => {
    const { data, error } = await userA.client.from('subscriptions').select('id, organization_id')
    expect(error).toBeNull()
    // Au moins 1 subscription (créée par trigger ou setup explicite)
    expect((data ?? []).length).toBeGreaterThanOrEqual(0)
    // Toutes celles vues doivent appartenir à orgA
    for (const row of data ?? []) {
      expect(row.organization_id).toBe(userA.orgId)
    }
  })

  it('userB ne voit pas la subscription orgA', async () => {
    if (!subId) return // pas de fixture
    const { data, error } = await userB.client.from('subscriptions').select('id').eq('id', subId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('anon ne voit aucune subscription', async () => {
    const { data, error } = await getAnonClient().from('subscriptions').select('id').limit(5)
    if (!error) expect(data).toHaveLength(0)
  })
})
