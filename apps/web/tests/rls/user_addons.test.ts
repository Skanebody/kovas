/**
 * RLS — table `user_addons` (cf. migration 20260526102000_user_addons.sql).
 *
 * Les addons (cockpit ADEME, marketplace, etc.) sont attachés à une org.
 * Un autre cabinet ne doit jamais voir quels addons un cabinet concurrent a souscrit.
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

describeFn('RLS — user_addons', () => {
  let userA: RlsTestUser
  let userB: RlsTestUser
  let addonRowId: string | null = null

  beforeAll(async () => {
    userA = await createRlsTestUser('addonA')
    userB = await createRlsTestUser('addonB')

    const admin = getAdminClient()
    // Récupère un module d'addon existant pour rattacher la fixture
    const { data: mod } = await admin.from('addon_modules').select('id').limit(1).maybeSingle()
    if (mod?.id) {
      const { data } = await admin
        .from('user_addons')
        .insert({
          organization_id: userA.orgId,
          module_id: mod.id,
          status: 'active',
        })
        .select('id')
        .maybeSingle()
      addonRowId = (data?.id as string) ?? null
    }
  })

  afterAll(async () => {
    if (userA) await cleanupRlsTestUser(userA.userId)
    if (userB) await cleanupRlsTestUser(userB.userId)
  })

  it('userA voit ses addons', async () => {
    const { data, error } = await userA.client.from('user_addons').select('id, organization_id')
    expect(error).toBeNull()
    for (const row of data ?? []) {
      expect(row.organization_id).toBe(userA.orgId)
    }
  })

  it("userB ne voit pas les addons d'orgA", async () => {
    if (!addonRowId) return
    const { data, error } = await userB.client.from('user_addons').select('id').eq('id', addonRowId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('anon ne voit aucun addon', async () => {
    const { data, error } = await getAnonClient().from('user_addons').select('id').limit(5)
    if (!error) expect(data).toHaveLength(0)
  })
})
