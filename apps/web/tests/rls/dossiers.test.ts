/**
 * RLS — table `dossiers` (workflow refonte cf. migrations/20260518150000_dossiers.sql).
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

describeFn('RLS — dossiers', () => {
  let userA: RlsTestUser
  let userB: RlsTestUser
  let dossierId: string

  beforeAll(async () => {
    userA = await createRlsTestUser('dossA')
    userB = await createRlsTestUser('dossB')

    const admin = getAdminClient()
    const { data: prop } = await admin
      .from('properties')
      .insert({
        organization_id: userA.orgId,
        address: '15 avenue Montaigne',
        city: 'Paris',
        postal_code: '75008',
      })
      .select('id')
      .single()
    const propertyId = prop?.id as string

    const { data, error } = await admin
      .from('dossiers')
      .insert({
        organization_id: userA.orgId,
        property_id: propertyId,
        reference: makeReference('DOS'),
        status: 'draft',
      })
      .select('id')
      .single()
    if (error) throw error
    dossierId = data?.id as string
  })

  afterAll(async () => {
    if (userA) await cleanupRlsTestUser(userA.userId)
    if (userB) await cleanupRlsTestUser(userB.userId)
  })

  it('userA voit son dossier', async () => {
    const { data, error } = await userA.client.from('dossiers').select('id').eq('id', dossierId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('userB ne voit pas le dossier orgA', async () => {
    const { data, error } = await userB.client.from('dossiers').select('id').eq('id', dossierId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('anon ne voit aucun dossier', async () => {
    const { data, error } = await getAnonClient().from('dossiers').select('id').limit(5)
    if (!error) expect(data).toHaveLength(0)
  })
})
