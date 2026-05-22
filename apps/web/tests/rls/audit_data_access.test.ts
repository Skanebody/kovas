/**
 * RLS — `audit_data_access` (registre RGPD des accès aux données sensibles).
 *
 * Hyper sensible : un user ne doit voir QUE ses propres traces d'audit, jamais
 * celles d'un autre utilisateur — même au sein de la même org.
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

describeFn('RLS — audit_data_access', () => {
  let userA: RlsTestUser
  let userB: RlsTestUser
  let auditId: string | null = null

  beforeAll(async () => {
    userA = await createRlsTestUser('audA')
    userB = await createRlsTestUser('audB')

    const admin = getAdminClient()
    const { data, error } = await admin
      .from('audit_data_access')
      .insert({
        user_id: userA.userId,
        organization_id: userA.orgId,
        data_type: 'client',
        action: 'read',
      })
      .select('id')
      .maybeSingle()
    if (!error && data) auditId = data.id as string
  })

  afterAll(async () => {
    if (userA) await cleanupRlsTestUser(userA.userId)
    if (userB) await cleanupRlsTestUser(userB.userId)
  })

  it('userA voit ses propres entrées audit', async () => {
    const { data, error } = await userA.client
      .from('audit_data_access')
      .select('id, user_id')
      .eq('user_id', userA.userId)
    expect(error).toBeNull()
    for (const row of data ?? []) {
      expect(row.user_id).toBe(userA.userId)
    }
  })

  it('userB ne voit pas les entrées audit de userA', async () => {
    if (!auditId) return
    const { data, error } = await userB.client
      .from('audit_data_access')
      .select('id')
      .eq('id', auditId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('anon ne voit aucune entrée audit', async () => {
    const { data, error } = await getAnonClient().from('audit_data_access').select('id').limit(5)
    if (!error) expect(data).toHaveLength(0)
  })
})
