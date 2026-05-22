/**
 * RLS — `client_photo_requests` (cf. migration 20260612100000_client_photo_requests.sql).
 *
 * Workflow récupération photo client via SMS — chaque demande est strictement
 * scoped à l'organisation émettrice.
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

describeFn('RLS — client_photo_requests', () => {
  let userA: RlsTestUser
  let userB: RlsTestUser
  let requestId: string | null = null

  beforeAll(async () => {
    userA = await createRlsTestUser('cprA')
    userB = await createRlsTestUser('cprB')

    const admin = getAdminClient()
    const { data: prop } = await admin
      .from('properties')
      .insert({
        organization_id: userA.orgId,
        address: '1 quai du Port',
        city: 'Marseille',
        postal_code: '13002',
      })
      .select('id')
      .single()

    const { data: mission } = await admin
      .from('missions')
      .insert({
        organization_id: userA.orgId,
        property_id: prop?.id,
        reference: makeReference('MIS'),
        type: 'dpe_vente',
        status: 'draft',
      })
      .select('id')
      .single()

    const { data, error } = await admin
      .from('client_photo_requests')
      .insert({
        mission_id: mission?.id,
        organization_id: userA.orgId,
        token: `cpr_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        photo_description: 'Photo de la chaudière en chaufferie sous-sol',
      })
      .select('id')
      .maybeSingle()
    if (!error && data) requestId = data.id as string
  })

  afterAll(async () => {
    if (userA) await cleanupRlsTestUser(userA.userId)
    if (userB) await cleanupRlsTestUser(userB.userId)
  })

  it('userA voit ses demandes de photo client', async () => {
    if (!requestId) return
    const { data, error } = await userA.client
      .from('client_photo_requests')
      .select('id')
      .eq('id', requestId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it("userB ne voit pas les demandes d'orgA", async () => {
    if (!requestId) return
    const { data, error } = await userB.client
      .from('client_photo_requests')
      .select('id')
      .eq('id', requestId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('anon ne voit aucune demande', async () => {
    const { data, error } = await getAnonClient()
      .from('client_photo_requests')
      .select('id')
      .limit(5)
    if (!error) expect(data).toHaveLength(0)
  })
})
