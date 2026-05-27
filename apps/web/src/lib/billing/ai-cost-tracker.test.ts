/**
 * Tests unitaires ai-cost-tracker (refonte P9).
 *
 * Couverture :
 *   - currentMonthIso : format Paris correct
 *   - nextMonthResetDate : 1er du mois suivant
 *   - isAiDegradedMode : flow complet (legacy, sous cap, au-dessus cap)
 *   - recordAiUsage : upsert + déclenchement degraded_mode_at
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  type DegradedModeStatus,
  __testing,
  isAiDegradedMode,
  recordAiUsage,
} from './ai-cost-tracker'

const { currentMonthIso, nextMonthResetDate } = __testing

/* ============================================================
   currentMonthIso / nextMonthResetDate
   ============================================================ */

test('currentMonthIso — format YYYY-MM', () => {
  const out = currentMonthIso()
  assert.match(out, /^\d{4}-(0[1-9]|1[0-2])$/, 'doit être YYYY-MM')
})

test('nextMonthResetDate — strictement dans le futur', () => {
  const out = nextMonthResetDate()
  assert.ok(out.getTime() > Date.now(), 'doit être dans le futur')
  assert.equal(out.getUTCDate(), 1, 'doit être le 1er du mois')
  assert.equal(out.getUTCHours(), 0)
})

/* ============================================================
   Mocks Supabase
   ============================================================ */

interface MockState {
  subscription?: {
    organization_id: string
    tier: string | null
    is_grandfathered: boolean | null
    hard_cap_whisper_seconds: number | null
    hard_cap_vision_calls: number | null
  } | null
  aiUsage?: {
    whisper_seconds: number
    vision_calls: number
    claude_tokens_input: number
    claude_tokens_output: number
    cost_cents: number
    degraded_mode_at: string | null
  } | null
}

function buildMockSupabase(state: MockState): {
  client: unknown
  upserts: Array<Record<string, unknown>>
} {
  const upserts: Array<Record<string, unknown>> = []
  const client = {
    from(table: string) {
      const isSubscription = table === 'subscriptions'
      const isAiUsage = table === 'ai_usage_monthly'
      const builder = {
        select() {
          return builder
        },
        eq() {
          return builder
        },
        async maybeSingle<T>() {
          if (isSubscription) {
            return { data: (state.subscription ?? null) as T | null, error: null }
          }
          if (isAiUsage) {
            return { data: (state.aiUsage ?? null) as T | null, error: null }
          }
          return { data: null, error: null }
        },
        async upsert(row: Record<string, unknown>) {
          upserts.push({ table, row })
          return { data: null, error: null }
        },
      }
      return builder
    },
  }
  return { client, upserts }
}

/* ============================================================
   isAiDegradedMode
   ============================================================ */

test("isAiDegradedMode — pas d'abonnement → degraded=false", async () => {
  const { client } = buildMockSupabase({ subscription: null })
  const out = await isAiDegradedMode(client as never, 'org-1')
  assert.equal(out.degraded, false)
})

test('isAiDegradedMode — abonnement grandfathered → degraded=false (pas de hard caps)', async () => {
  const { client } = buildMockSupabase({
    subscription: {
      organization_id: 'org-1',
      tier: 'volume_legacy',
      is_grandfathered: true,
      hard_cap_whisper_seconds: null,
      hard_cap_vision_calls: null,
    },
  })
  const out = await isAiDegradedMode(client as never, 'org-1')
  assert.equal(out.degraded, false, 'legacy users ne sont JAMAIS dégradés')
})

test('isAiDegradedMode — pro sous cap whisper → degraded=false', async () => {
  const { client } = buildMockSupabase({
    subscription: {
      organization_id: 'org-1',
      tier: 'pro',
      is_grandfathered: false,
      hard_cap_whisper_seconds: 30 * 3600,
      hard_cap_vision_calls: 200,
    },
    aiUsage: {
      whisper_seconds: 5 * 3600, // 5h sur 30h
      vision_calls: 50,
      claude_tokens_input: 0,
      claude_tokens_output: 0,
      cost_cents: 0,
      degraded_mode_at: null,
    },
  })
  const out = await isAiDegradedMode(client as never, 'org-1')
  assert.equal(out.degraded, false)
})

test('isAiDegradedMode — whisper au cap → degraded=true, reason=whisper_cap', async () => {
  const { client } = buildMockSupabase({
    subscription: {
      organization_id: 'org-1',
      tier: 'pro',
      is_grandfathered: false,
      hard_cap_whisper_seconds: 30 * 3600,
      hard_cap_vision_calls: 200,
    },
    aiUsage: {
      whisper_seconds: 30 * 3600, // pile au cap
      vision_calls: 0,
      claude_tokens_input: 0,
      claude_tokens_output: 0,
      cost_cents: 0,
      degraded_mode_at: null,
    },
  })
  const out: DegradedModeStatus = await isAiDegradedMode(client as never, 'org-1')
  assert.equal(out.degraded, true)
  assert.equal(out.reason, 'whisper_cap')
})

test('isAiDegradedMode — vision au cap (whisper sous cap) → degraded=true, reason=vision_cap', async () => {
  const { client } = buildMockSupabase({
    subscription: {
      organization_id: 'org-1',
      tier: 'pro',
      is_grandfathered: false,
      hard_cap_whisper_seconds: 30 * 3600,
      hard_cap_vision_calls: 200,
    },
    aiUsage: {
      whisper_seconds: 100,
      vision_calls: 200, // pile au cap
      claude_tokens_input: 0,
      claude_tokens_output: 0,
      cost_cents: 0,
      degraded_mode_at: null,
    },
  })
  const out: DegradedModeStatus = await isAiDegradedMode(client as never, 'org-1')
  assert.equal(out.degraded, true)
  assert.equal(out.reason, 'vision_cap')
})

test('isAiDegradedMode — vision cap = 0 (essential) → jamais déclenché par vision', async () => {
  const { client } = buildMockSupabase({
    subscription: {
      organization_id: 'org-1',
      tier: 'essential',
      is_grandfathered: false,
      hard_cap_whisper_seconds: 5 * 3600,
      hard_cap_vision_calls: 0, // vision indisponible Essential
    },
    aiUsage: {
      whisper_seconds: 100,
      vision_calls: 100, // > 0 mais cap=0 = pas de vision
      claude_tokens_input: 0,
      claude_tokens_output: 0,
      cost_cents: 0,
      degraded_mode_at: null,
    },
  })
  const out = await isAiDegradedMode(client as never, 'org-1')
  // Vision cap 0 ne déclenche pas (cap > 0 requis)
  assert.equal(out.degraded, false)
})

test('isAiDegradedMode — degraded_mode_at déjà set → degraded=true', async () => {
  const { client } = buildMockSupabase({
    subscription: {
      organization_id: 'org-1',
      tier: 'pro',
      is_grandfathered: false,
      hard_cap_whisper_seconds: 30 * 3600,
      hard_cap_vision_calls: 200,
    },
    aiUsage: {
      whisper_seconds: 30 * 3600 + 100, // au-dessus du cap
      vision_calls: 0,
      claude_tokens_input: 0,
      claude_tokens_output: 0,
      cost_cents: 0,
      degraded_mode_at: '2026-05-15T12:00:00Z',
    },
  })
  const out = await isAiDegradedMode(client as never, 'org-1')
  assert.equal(out.degraded, true)
})

/* ============================================================
   recordAiUsage
   ============================================================ */

test('recordAiUsage — premier enregistrement Whisper → upsert avec compteur initialisé', async () => {
  const { client, upserts } = buildMockSupabase({
    subscription: {
      organization_id: 'org-1',
      tier: 'pro',
      is_grandfathered: false,
      hard_cap_whisper_seconds: 30 * 3600,
      hard_cap_vision_calls: 200,
    },
    aiUsage: null,
  })
  await recordAiUsage(client as never, 'org-1', {
    type: 'whisper',
    amount: 600, // 10 minutes
    costCents: 12,
  })
  assert.equal(upserts.length, 1)
  const row = upserts[0]!.row as Record<string, number | string | null>
  assert.equal(row.organization_id, 'org-1')
  assert.equal(row.whisper_seconds, 600)
  assert.equal(row.vision_calls, 0)
  assert.equal(row.cost_cents, 12)
  assert.equal(row.degraded_mode_at, null)
})

test('recordAiUsage — Whisper qui franchit le cap → degraded_mode_at posé', async () => {
  const { client, upserts } = buildMockSupabase({
    subscription: {
      organization_id: 'org-1',
      tier: 'pro',
      is_grandfathered: false,
      hard_cap_whisper_seconds: 30 * 3600,
      hard_cap_vision_calls: 200,
    },
    aiUsage: {
      whisper_seconds: 29 * 3600 + 3500, // 29h 58min 20s
      vision_calls: 0,
      claude_tokens_input: 0,
      claude_tokens_output: 0,
      cost_cents: 0,
      degraded_mode_at: null,
    },
  })
  await recordAiUsage(client as never, 'org-1', {
    type: 'whisper',
    amount: 200, // ajoute 3min 20s → total 30h 1min 40s > 30h cap
    costCents: 5,
  })
  const row = upserts[0]!.row as Record<string, number | string | null>
  assert.notEqual(row.degraded_mode_at, null, 'degraded_mode_at doit être posé')
})

test('recordAiUsage — Vision en plan Essential (cap=0) → pas de degraded', async () => {
  const { client, upserts } = buildMockSupabase({
    subscription: {
      organization_id: 'org-1',
      tier: 'essential',
      is_grandfathered: false,
      hard_cap_whisper_seconds: 5 * 3600,
      hard_cap_vision_calls: 0,
    },
    aiUsage: null,
  })
  await recordAiUsage(client as never, 'org-1', {
    type: 'vision',
    amount: 1,
    costCents: 10,
  })
  const row = upserts[0]!.row as Record<string, number | string | null>
  assert.equal(row.vision_calls, 1)
  assert.equal(row.degraded_mode_at, null, 'cap=0 ne déclenche pas dégradé (cap>0 requis)')
})

test('recordAiUsage — grandfathered → pas de degraded mode même au-dessus du cap', async () => {
  const { client, upserts } = buildMockSupabase({
    subscription: {
      organization_id: 'org-1',
      tier: 'standard_legacy',
      is_grandfathered: true,
      hard_cap_whisper_seconds: null,
      hard_cap_vision_calls: null,
    },
    aiUsage: {
      whisper_seconds: 1000 * 3600, // énorme
      vision_calls: 0,
      claude_tokens_input: 0,
      claude_tokens_output: 0,
      cost_cents: 0,
      degraded_mode_at: null,
    },
  })
  await recordAiUsage(client as never, 'org-1', {
    type: 'whisper',
    amount: 60,
    costCents: 1,
  })
  const row = upserts[0]!.row as Record<string, number | string | null>
  assert.equal(row.degraded_mode_at, null, 'legacy users ne basculent JAMAIS en degraded')
})

test('recordAiUsage — accumule cost_cents correctement', async () => {
  const { client, upserts } = buildMockSupabase({
    subscription: {
      organization_id: 'org-1',
      tier: 'pro',
      is_grandfathered: false,
      hard_cap_whisper_seconds: 30 * 3600,
      hard_cap_vision_calls: 200,
    },
    aiUsage: {
      whisper_seconds: 100,
      vision_calls: 5,
      claude_tokens_input: 1000,
      claude_tokens_output: 500,
      cost_cents: 42,
      degraded_mode_at: null,
    },
  })
  await recordAiUsage(client as never, 'org-1', {
    type: 'claude_input',
    amount: 500,
    costCents: 8,
  })
  const row = upserts[0]!.row as Record<string, number | string | null>
  assert.equal(row.cost_cents, 50, '42 + 8 = 50')
  assert.equal(row.claude_tokens_input, 1500, '1000 + 500 = 1500')
})
