/**
 * RLS — table `clients` (carnet d'adresses du cabinet).
 *
 * Les fiches client sont strictement organisationnelles : aucun partage cross-org.
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

describeFn('RLS — clients', () => {
  let userA: RlsTestUser
  let userB: RlsTestUser
  let clientId: string

  beforeAll(async () => {
    userA = await createRlsTestUser('clientA')
    userB = await createRlsTestUser('clientB')

    const admin = getAdminClient()
    const { data, error } = await admin
      .from('clients')
      .insert({
        organization_id: userA.orgId,
        type: 'particulier',
        display_name: 'M. Test Client',
        first_name: 'Test',
        last_name: 'Client',
      })
      .select('id')
      .single()
    if (error) throw error
    clientId = data?.id as string
  })

  afterAll(async () => {
    if (userA) await cleanupRlsTestUser(userA.userId)
    if (userB) await cleanupRlsTestUser(userB.userId)
  })

  it('userA voit son client', async () => {
    const { data, error } = await userA.client.from('clients').select('id').eq('id', clientId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it("userB ne voit pas les clients d'orgA (cloison stricte RGPD)", async () => {
    const { data, error } = await userB.client.from('clients').select('id').eq('id', clientId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('client anonyme ne voit aucun client', async () => {
    const { data, error } = await getAnonClient().from('clients').select('id').limit(5)
    if (!error) expect(data).toHaveLength(0)
  })

  it("userB ne peut pas mettre à jour les clients d'orgA", async () => {
    const { error, data } = await userB.client
      .from('clients')
      .update({ display_name: 'Hacker' })
      .eq('id', clientId)
      .select()
    // Soit pas de row affectée (RLS filter), soit erreur — les deux acceptables
    if (!error) expect(data ?? []).toHaveLength(0)
  })
})
