/**
 * RLS — table `quotes` (devis émis par le cabinet).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  type RlsTestUser,
  cleanupRlsTestUser,
  createRlsTestUser,
  getAdminClient,
  getAnonClient,
  hasSupabaseEnv,
  makeReference,
} from './helpers'

const describeFn = hasSupabaseEnv() ? describe : describe.skip

describeFn('RLS — quotes', () => {
  let userA: RlsTestUser
  let userB: RlsTestUser
  let quoteId: string

  beforeAll(async () => {
    userA = await createRlsTestUser('quoteA')
    userB = await createRlsTestUser('quoteB')

    const admin = getAdminClient()
    const { data: client } = await admin
      .from('clients')
      .insert({
        organization_id: userA.orgId,
        type: 'particulier',
        display_name: 'Client devis',
      })
      .select('id')
      .single()

    const { data, error } = await admin
      .from('quotes')
      .insert({
        organization_id: userA.orgId,
        client_id: client?.id,
        reference: makeReference('DEV'),
        status: 'draft',
        amount_ht: 250,
        amount_tva: 50,
        amount_ttc: 300,
      })
      .select('id')
      .single()
    if (error) throw error
    quoteId = data?.id as string
  })

  afterAll(async () => {
    if (userA) await cleanupRlsTestUser(userA.userId)
    if (userB) await cleanupRlsTestUser(userB.userId)
  })

  it('userA voit son devis', async () => {
    const { data, error } = await userA.client.from('quotes').select('id').eq('id', quoteId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('userB ne voit pas le devis orgA', async () => {
    const { data, error } = await userB.client.from('quotes').select('id').eq('id', quoteId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('anon ne voit aucun devis', async () => {
    const { data, error } = await getAnonClient().from('quotes').select('id').limit(5)
    if (!error) expect(data).toHaveLength(0)
  })
})
