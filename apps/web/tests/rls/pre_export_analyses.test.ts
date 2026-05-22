/**
 * RLS — `pre_export_analyses` (module pré-vérification, sensible :
 * contient les findings IA + score + données ADEME comparatives).
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

describeFn('RLS — pre_export_analyses', () => {
  let userA: RlsTestUser
  let userB: RlsTestUser
  let analysisId: string | null = null

  beforeAll(async () => {
    userA = await createRlsTestUser('peaA')
    userB = await createRlsTestUser('peaB')

    const admin = getAdminClient()
    const { data: prop } = await admin
      .from('properties')
      .insert({
        organization_id: userA.orgId,
        address: '5 rue Sainte-Catherine',
        city: 'Lyon',
        postal_code: '69002',
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
      .from('pre_export_analyses')
      .insert({
        mission_id: mission?.id,
        organization_id: userA.orgId,
        diagnostician_id: userA.userId,
        risk_score: 35,
        findings: [],
      })
      .select('id')
      .maybeSingle()
    if (!error && data) analysisId = data.id as string
  })

  afterAll(async () => {
    if (userA) await cleanupRlsTestUser(userA.userId)
    if (userB) await cleanupRlsTestUser(userB.userId)
  })

  it('userA voit son analyse pré-export', async () => {
    if (!analysisId) return
    const { data, error } = await userA.client
      .from('pre_export_analyses')
      .select('id, risk_score')
      .eq('id', analysisId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it("userB ne voit pas l'analyse orgA", async () => {
    if (!analysisId) return
    const { data, error } = await userB.client
      .from('pre_export_analyses')
      .select('id')
      .eq('id', analysisId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('anon ne voit aucune analyse', async () => {
    const { data, error } = await getAnonClient().from('pre_export_analyses').select('id').limit(5)
    if (!error) expect(data).toHaveLength(0)
  })
})
