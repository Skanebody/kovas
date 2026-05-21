/**
 * Tests unitaires fair-use-monitor (refonte P9).
 *
 * Exécutable via `node --test --import tsx <path>` (tsx ou ts-node).
 * On utilise `node:test` + `node:assert` (stable Node 18+).
 *
 * Couverture :
 *   - suggestUpgradeTier : recommandation tier au-dessus du courant
 *   - monthIsoFor : conversion timezone Paris
 *   - monthBounds : bornes 1er/dernier jour
 *   - checkFairUseStatus : flow complet avec mocks Supabase
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  __testing,
  checkFairUseStatus,
  type FairUseStatus,
} from './fair-use-monitor'

const { suggestUpgradeTier, monthIsoFor, monthBounds } = __testing

/* ============================================================
   suggestUpgradeTier
   ============================================================ */

test('suggestUpgradeTier — essential dépassé léger → decouverte', () => {
  // 75 missions sur Essential (cap 50) → suggère Découverte (cap 100)
  const out = suggestUpgradeTier(75, 'essential')
  assert.equal(out, 'decouverte')
})

test('suggestUpgradeTier — pro dépassé moyen → all_inclusive', () => {
  // 250 missions sur Pro (cap 200) → suggère All Inclusive (cap 350)
  const out = suggestUpgradeTier(250, 'pro')
  assert.equal(out, 'all_inclusive')
})

test('suggestUpgradeTier — cabinet déjà au max → cabinet (lui-même)', () => {
  // 600 missions sur Cabinet (cap 500) → renvoie Cabinet (le plus gros)
  const out = suggestUpgradeTier(600, 'cabinet')
  assert.equal(out, 'cabinet')
})

test('suggestUpgradeTier — saute plusieurs tiers si besoin', () => {
  // 400 missions sur Essential (cap 50) → saute jusqu'à All Inclusive (cap 350)... attendons : 400 > 350 → Cabinet
  const out = suggestUpgradeTier(400, 'essential')
  assert.equal(out, 'cabinet')
})

test('suggestUpgradeTier — volume exactement au cap supérieur → ce tier', () => {
  // 100 missions sur Essential → Découverte (cap 100, inclus)
  const out = suggestUpgradeTier(100, 'essential')
  assert.equal(out, 'decouverte')
})

/* ============================================================
   monthIsoFor
   ============================================================ */

test('monthIsoFor — format YYYY-MM correct', () => {
  const d = new Date('2026-05-15T14:30:00Z')
  const out = monthIsoFor(d)
  assert.equal(out, '2026-05')
})

test('monthIsoFor — bascule fin de mois Paris (UTC J-1 23h → mai Paris J+1 01h)', () => {
  // 2026-05-31 23:30 UTC = 2026-06-01 01:30 Paris (CEST)
  const d = new Date('2026-05-31T23:30:00Z')
  const out = monthIsoFor(d)
  assert.equal(out, '2026-06')
})

/* ============================================================
   monthBounds
   ============================================================ */

test('monthBounds — mai 2026 → 01/05 → 01/06', () => {
  const { startIso, endIso } = monthBounds('2026-05')
  assert.equal(startIso, '2026-05-01T00:00:00.000Z')
  assert.equal(endIso, '2026-06-01T00:00:00.000Z')
})

test('monthBounds — décembre → janvier année suivante', () => {
  const { startIso, endIso } = monthBounds('2026-12')
  assert.equal(startIso, '2026-12-01T00:00:00.000Z')
  assert.equal(endIso, '2027-01-01T00:00:00.000Z')
})

/* ============================================================
   checkFairUseStatus — mocks Supabase
   ============================================================ */

type MockQueryBuilder = {
  select: (cols: string, opts?: { count?: 'exact'; head?: boolean }) => MockQueryBuilder
  eq: (col: string, val: unknown) => MockQueryBuilder
  is: (col: string, val: unknown) => MockQueryBuilder
  gte: (col: string, val: unknown) => MockQueryBuilder
  lt: (col: string, val: unknown) => MockQueryBuilder
  maybeSingle: <T>() => Promise<{ data: T | null; error: null }>
  /** Pour les requêtes head:true qui renvoient un count. */
  then?: never
}

interface MockResponse {
  subscription?: unknown
  missionCount?: number
}

function buildMockSupabase(resp: MockResponse): unknown {
  return {
    from(table: string) {
      const isMissions = table === 'missions'
      const builder: MockQueryBuilder = {
        select(_cols: string, opts?: { count?: 'exact'; head?: boolean }) {
          if (opts?.count === 'exact' && opts?.head === true) {
            // Pour les counts sur missions, on retourne directement count
            const promise = Promise.resolve({
              data: null,
              error: null,
              count: resp.missionCount ?? 0,
            })
            // chaîne fluide qui se résout finalement
            return new Proxy(builder, {
              get(_t, prop) {
                if (prop === 'then') {
                  return promise.then.bind(promise)
                }
                return Reflect.get(builder, prop, builder)
              },
            }) as MockQueryBuilder
          }
          return builder
        },
        eq() {
          return builder
        },
        is() {
          return builder
        },
        gte() {
          return builder
        },
        lt() {
          return builder
        },
        async maybeSingle<T>() {
          if (isMissions) {
            return { data: null as T | null, error: null }
          }
          return { data: (resp.subscription ?? null) as T | null, error: null }
        },
      }
      return builder
    },
  }
}

test('checkFairUseStatus — pas d\'abonnement → null', async () => {
  const supabase = buildMockSupabase({ subscription: null })
  const out = await checkFairUseStatus(supabase as never, 'org-1')
  assert.equal(out, null)
})

test('checkFairUseStatus — abonnement grandfathered → null', async () => {
  const supabase = buildMockSupabase({
    subscription: {
      organization_id: 'org-1',
      tier: 'standard_legacy',
      is_grandfathered: true,
      fair_use_cap_missions: null,
      status: 'active',
    },
    missionCount: 80,
  })
  const out = await checkFairUseStatus(supabase as never, 'org-1')
  assert.equal(out, null, 'legacy users ne doivent JAMAIS être touchés par fair-use')
})

test('checkFairUseStatus — pro sous cap → withinCap=true, recommendation=continue', async () => {
  const supabase = buildMockSupabase({
    subscription: {
      organization_id: 'org-1',
      tier: 'pro',
      is_grandfathered: false,
      fair_use_cap_missions: 200,
      status: 'active',
    },
    missionCount: 150,
  })
  const out = (await checkFairUseStatus(supabase as never, 'org-1')) as FairUseStatus
  assert.ok(out)
  assert.equal(out.withinCap, true)
  assert.equal(out.missionsCount, 150)
  assert.equal(out.missionsCap, 200)
  assert.equal(out.recommendation, 'continue')
  assert.equal(out.suggestedTier, undefined)
})

test('checkFairUseStatus — pro au-dessus cap → consider_upgrade + suggestedTier', async () => {
  const supabase = buildMockSupabase({
    subscription: {
      organization_id: 'org-1',
      tier: 'pro',
      is_grandfathered: false,
      fair_use_cap_missions: 200,
      status: 'active',
    },
    missionCount: 250,
  })
  const out = (await checkFairUseStatus(supabase as never, 'org-1')) as FairUseStatus
  assert.ok(out)
  assert.equal(out.withinCap, false)
  assert.equal(out.missionsCount, 250)
  assert.equal(out.recommendation, 'consider_upgrade')
  assert.equal(out.suggestedTier, 'all_inclusive')
})

test('checkFairUseStatus — tier inconnu → null', async () => {
  const supabase = buildMockSupabase({
    subscription: {
      organization_id: 'org-1',
      tier: 'bogus_tier',
      is_grandfathered: false,
      fair_use_cap_missions: null,
      status: 'active',
    },
    missionCount: 50,
  })
  const out = await checkFairUseStatus(supabase as never, 'org-1')
  assert.equal(out, null)
})

test('checkFairUseStatus — fallback cap si fair_use_cap_missions=null en DB', async () => {
  // fair_use_cap_missions à null en DB → fallback sur PRICING_PLANS (essential = 50)
  const supabase = buildMockSupabase({
    subscription: {
      organization_id: 'org-1',
      tier: 'essential',
      is_grandfathered: false,
      fair_use_cap_missions: null,
      status: 'active',
    },
    missionCount: 40,
  })
  const out = (await checkFairUseStatus(supabase as never, 'org-1')) as FairUseStatus
  assert.ok(out)
  assert.equal(out.missionsCap, 50, 'fallback sur PRICING_PLANS essential.fairUse.missionsSoftCap')
})
