/**
 * RLS — table `missions` (couche 2 industrialisation).
 *
 * Politiques attendues (cf. migrations/20260518000000_init_schema.sql) :
 *   - SELECT/INSERT/UPDATE autorisés aux membres de l'organisation propriétaire
 *   - Aucun accès anonyme
 *   - Pas de fuite cross-org (userB ne peut pas voir les missions de userA)
 *
 * Le test crée un property+mission appartenant à userA puis vérifie l'isolation.
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

describeFn('RLS — missions', () => {
  let userA: RlsTestUser
  let userB: RlsTestUser
  let missionId: string
  let propertyId: string

  beforeAll(async () => {
    userA = await createRlsTestUser('A')
    userB = await createRlsTestUser('B')

    const admin = getAdminClient()
    const { data: prop, error: propErr } = await admin
      .from('properties')
      .insert({
        organization_id: userA.orgId,
        address: '10 rue de la Paix',
        city: 'Paris',
        postal_code: '75008',
      })
      .select('id')
      .single()
    if (propErr || !prop) throw new Error(`property setup failed: ${propErr?.message}`)
    propertyId = prop.id as string

    const { data: mission, error: misErr } = await admin
      .from('missions')
      .insert({
        organization_id: userA.orgId,
        property_id: propertyId,
        reference: makeReference('MIS'),
        type: 'dpe_vente',
        status: 'draft',
      })
      .select('id')
      .single()
    if (misErr || !mission) throw new Error(`mission setup failed: ${misErr?.message}`)
    missionId = mission.id as string
  })

  afterAll(async () => {
    if (userA) await cleanupRlsTestUser(userA.userId)
    if (userB) await cleanupRlsTestUser(userB.userId)
  })

  it('userA voit sa propre mission', async () => {
    const { data, error } = await userA.client
      .from('missions')
      .select('id, organization_id')
      .eq('id', missionId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data?.[0]?.organization_id).toBe(userA.orgId)
  })

  it("userB NE VOIT PAS la mission de l'org A", async () => {
    const { data, error } = await userB.client.from('missions').select('id').eq('id', missionId)
    // RLS renvoie un set vide sans erreur — le filtrage est silencieux
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('client anonyme ne voit aucune mission', async () => {
    const anon = getAnonClient()
    const { data, error } = await anon.from('missions').select('id').limit(10)
    // soit erreur (auth required) soit set vide selon la version PostgREST
    if (!error) expect(data).toHaveLength(0)
  })

  it("userB ne peut PAS insérer une mission dans l'org A", async () => {
    const { error } = await userB.client.from('missions').insert({
      organization_id: userA.orgId,
      property_id: propertyId,
      reference: makeReference('MIS'),
      type: 'dpe_vente',
      status: 'draft',
    })
    expect(error).toBeTruthy()
    expect(error?.code).toMatch(/42501|PGRST/)
  })
})
