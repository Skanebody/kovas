/**
 * Tests unitaires behavioral-triggers (KOVAS L1 — Upsell).
 *
 * Exécutable via `node --test --import tsx <path>`.
 * Couvre les 10 règles métier (R1 à R10) une par une.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { type BehaviorContext, evaluateAllRules } from './behavioral-triggers'

function makeCtx(overrides: Partial<BehaviorContext>): BehaviorContext {
  return {
    userId: 'u1',
    events: [],
    currentAccess: { planCode: null, activeAddons: [], activePacks: [] },
    currentUsage: {
      missionsCount30d: 0,
      invoicesCount30d: 0,
      leadsReceived30d: 0,
      leadsResponded30d: 0,
      whisperUsagePct: 0,
      storageUsagePct: 0,
      missionsUsagePct: 0,
      visionUsagePct: 0,
    },
    ...overrides,
  }
}

test('R1 — >20 factures sans Factur-X → suggère facturx_ppf', () => {
  const ctx = makeCtx({
    currentUsage: {
      missionsCount30d: 0,
      invoicesCount30d: 25,
      leadsReceived30d: 0,
      leadsResponded30d: 0,
      whisperUsagePct: 0,
      storageUsagePct: 0,
      missionsUsagePct: 0,
      visionUsagePct: 0,
    },
  })
  const out = evaluateAllRules(ctx)
  assert.ok(
    out.find((s) => s.target === 'facturx_ppf'),
    'Factur-X attendu',
  )
})

test('R1 — Pack Cabinet déjà actif → pas de suggestion Factur-X', () => {
  const ctx = makeCtx({
    currentUsage: {
      missionsCount30d: 0,
      invoicesCount30d: 25,
      leadsReceived30d: 0,
      leadsResponded30d: 0,
      whisperUsagePct: 0,
      storageUsagePct: 0,
      missionsUsagePct: 0,
      visionUsagePct: 0,
    },
    currentAccess: { planCode: 'pro', activeAddons: [], activePacks: ['pack_cabinet'] },
  })
  const out = evaluateAllRules(ctx)
  assert.equal(
    out.find((s) => s.target === 'facturx_ppf'),
    undefined,
  )
})

test('R2 — >5 leads, <30% réponse, tier Essential → upgrade Pro', () => {
  const ctx = makeCtx({
    currentAccess: { planCode: 'essential', activeAddons: [], activePacks: [] },
    currentUsage: {
      missionsCount30d: 0,
      invoicesCount30d: 0,
      leadsReceived30d: 10,
      leadsResponded30d: 2, // 20%
      whisperUsagePct: 0,
      storageUsagePct: 0,
      missionsUsagePct: 0,
      visionUsagePct: 0,
    },
  })
  const out = evaluateAllRules(ctx)
  assert.ok(out.find((s) => s.target === 'pro' && s.suggestionType === 'tier_upgrade'))
})

test('R3 — pennylane_attempted sans addon → suggère pennylane_sync', () => {
  const ctx = makeCtx({
    events: [{ type: 'pennylane_attempted', data: {}, createdAt: new Date() }],
  })
  const out = evaluateAllRules(ctx)
  assert.ok(out.find((s) => s.target === 'pennylane_sync'))
})

test('R4 — whisper 90% → suggère upgrade tier', () => {
  const ctx = makeCtx({
    currentAccess: { planCode: 'decouverte', activeAddons: [], activePacks: [] },
    currentUsage: {
      missionsCount30d: 0,
      invoicesCount30d: 0,
      leadsReceived30d: 0,
      leadsResponded30d: 0,
      whisperUsagePct: 90,
      storageUsagePct: 0,
      missionsUsagePct: 0,
      visionUsagePct: 0,
    },
  })
  const out = evaluateAllRules(ctx)
  // Découverte → suivant = pro
  assert.ok(out.find((s) => s.target === 'pro' && s.suggestionType === 'tier_upgrade'))
})

test('R5 — storage 85% → suggère upgrade tier', () => {
  const ctx = makeCtx({
    currentAccess: { planCode: 'pro', activeAddons: [], activePacks: [] },
    currentUsage: {
      missionsCount30d: 0,
      invoicesCount30d: 0,
      leadsReceived30d: 0,
      leadsResponded30d: 0,
      whisperUsagePct: 0,
      storageUsagePct: 85,
      missionsUsagePct: 0,
      visionUsagePct: 0,
    },
  })
  const out = evaluateAllRules(ctx)
  assert.ok(out.find((s) => s.target === 'all_inclusive'))
})

test('R6 — missions 95% → suggère upgrade tier', () => {
  const ctx = makeCtx({
    currentAccess: { planCode: 'decouverte', activeAddons: [], activePacks: [] },
    currentUsage: {
      missionsCount30d: 58,
      invoicesCount30d: 0,
      leadsReceived30d: 0,
      leadsResponded30d: 0,
      whisperUsagePct: 0,
      storageUsagePct: 0,
      missionsUsagePct: 95,
      visionUsagePct: 0,
    },
  })
  const out = evaluateAllRules(ctx)
  assert.ok(out.find((s) => s.target === 'pro'))
})

test('R7 — Essential et 35 missions → suggère Découverte', () => {
  const ctx = makeCtx({
    currentAccess: { planCode: 'essential', activeAddons: [], activePacks: [] },
    currentUsage: {
      missionsCount30d: 35,
      invoicesCount30d: 0,
      leadsReceived30d: 0,
      leadsResponded30d: 0,
      whisperUsagePct: 0,
      storageUsagePct: 0,
      missionsUsagePct: 0,
      visionUsagePct: 0,
    },
  })
  const out = evaluateAllRules(ctx)
  assert.ok(out.find((s) => s.target === 'decouverte'))
})

test('R8 — analytics_attempted sans Pro → upgrade Pro', () => {
  const ctx = makeCtx({
    currentAccess: { planCode: 'decouverte', activeAddons: [], activePacks: [] },
    events: [{ type: 'analytics_attempted', data: {}, createdAt: new Date() }],
  })
  const out = evaluateAllRules(ctx)
  assert.ok(out.find((s) => s.target === 'pro' && s.suggestionType === 'tier_upgrade'))
})

test('R8 — analytics_attempted avec Pro déjà actif → pas de suggestion Pro', () => {
  const ctx = makeCtx({
    currentAccess: { planCode: 'pro', activeAddons: [], activePacks: [] },
    events: [{ type: 'analytics_attempted', data: {}, createdAt: new Date() }],
  })
  const out = evaluateAllRules(ctx)
  assert.equal(
    out.find((s) => s.target === 'pro'),
    undefined,
  )
})

test('R9 — bilingual attempted sans addon → suggère pack_international', () => {
  const ctx = makeCtx({
    events: [{ type: 'bilingual_report_attempted', data: {}, createdAt: new Date() }],
  })
  const out = evaluateAllRules(ctx)
  assert.ok(out.find((s) => s.target === 'pack_international' && s.suggestionType === 'pack'))
})

test('R10 — vision 82% → suggère upgrade tier', () => {
  const ctx = makeCtx({
    currentAccess: { planCode: 'pro', activeAddons: [], activePacks: [] },
    currentUsage: {
      missionsCount30d: 0,
      invoicesCount30d: 0,
      leadsReceived30d: 0,
      leadsResponded30d: 0,
      whisperUsagePct: 0,
      storageUsagePct: 0,
      missionsUsagePct: 0,
      visionUsagePct: 82,
    },
  })
  const out = evaluateAllRules(ctx)
  assert.ok(out.find((s) => s.target === 'all_inclusive'))
})

test('No-trigger global — user calme sans signal → 0 suggestion', () => {
  const ctx = makeCtx({
    currentAccess: { planCode: 'pro', activeAddons: [], activePacks: [] },
    currentUsage: {
      missionsCount30d: 50,
      invoicesCount30d: 5,
      leadsReceived30d: 3,
      leadsResponded30d: 3,
      whisperUsagePct: 30,
      storageUsagePct: 40,
      missionsUsagePct: 30,
      visionUsagePct: 20,
    },
  })
  const out = evaluateAllRules(ctx)
  assert.equal(out.length, 0)
})

test('Priorité — plusieurs règles déclenchées sont triées priority desc', () => {
  const ctx = makeCtx({
    currentAccess: { planCode: 'essential', activeAddons: [], activePacks: [] },
    currentUsage: {
      missionsCount30d: 35, // R7 priority 72
      invoicesCount30d: 30, // R1 priority 80
      leadsReceived30d: 0,
      leadsResponded30d: 0,
      whisperUsagePct: 0,
      storageUsagePct: 0,
      missionsUsagePct: 0,
      visionUsagePct: 0,
    },
  })
  const out = evaluateAllRules(ctx)
  assert.ok(out.length >= 2)
  // Priorité décroissante
  for (let i = 1; i < out.length; i++) {
    assert.ok(out[i - 1].priority >= out[i].priority)
  }
})
