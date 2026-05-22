/**
 * RLS — table `properties` (parc immobilier du cabinet).
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

describeFn('RLS — properties', () => {
  let userA: RlsTestUser
  let userB: RlsTestUser
  let propertyId: string

  beforeAll(async () => {
    userA = await createRlsTestUser('propA')
    userB = await createRlsTestUser('propB')

    const admin = getAdminClient()
    const { data, error } = await admin
      .from('properties')
      .insert({
        organization_id: userA.orgId,
        address: '22 rue du Faubourg',
        city: 'Paris',
        postal_code: '75011',
      })
      .select('id')
      .single()
    if (error) throw error
    propertyId = data?.id as string
  })

  afterAll(async () => {
    if (userA) await cleanupRlsTestUser(userA.userId)
    if (userB) await cleanupRlsTestUser(userB.userId)
  })

  it('userA voit son bien', async () => {
    const { data, error } = await userA.client.from('properties').select('id').eq('id', propertyId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it("userB ne voit pas les biens d'orgA", async () => {
    const { data, error } = await userB.client.from('properties').select('id').eq('id', propertyId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('client anonyme ne voit aucun bien', async () => {
    const { data, error } = await getAnonClient().from('properties').select('id').limit(5)
    if (!error) expect(data).toHaveLength(0)
  })
})
