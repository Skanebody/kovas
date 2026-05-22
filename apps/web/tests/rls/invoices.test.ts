/**
 * RLS — table `invoices` (factures émises par le cabinet, sensible RGPD).
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

describeFn('RLS — invoices', () => {
  let userA: RlsTestUser
  let userB: RlsTestUser
  let invoiceId: string

  beforeAll(async () => {
    userA = await createRlsTestUser('invA')
    userB = await createRlsTestUser('invB')

    const admin = getAdminClient()
    const { data, error } = await admin
      .from('invoices')
      .insert({
        organization_id: userA.orgId,
        reference: makeReference('FAC'),
        status: 'issued',
        amount_ht: 250,
        amount_tva: 50,
        amount_ttc: 300,
      })
      .select('id')
      .single()
    if (error) throw error
    invoiceId = data?.id as string
  })

  afterAll(async () => {
    if (userA) await cleanupRlsTestUser(userA.userId)
    if (userB) await cleanupRlsTestUser(userB.userId)
  })

  it('userA voit sa facture', async () => {
    const { data, error } = await userA.client.from('invoices').select('id').eq('id', invoiceId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('userB ne voit pas la facture orgA', async () => {
    const { data, error } = await userB.client.from('invoices').select('id').eq('id', invoiceId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('anon ne voit aucune facture', async () => {
    const { data, error } = await getAnonClient().from('invoices').select('id').limit(5)
    if (!error) expect(data).toHaveLength(0)
  })

  it('userB ne peut pas marquer payée une facture orgA', async () => {
    const { error, data } = await userB.client
      .from('invoices')
      .update({ status: 'paid' })
      .eq('id', invoiceId)
      .select()
    if (!error) expect(data ?? []).toHaveLength(0)
  })
})
