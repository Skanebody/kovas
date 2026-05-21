/**
 * Tests déterministes pour assignVariant (node:test).
 *
 * Exécution :
 *   pnpm --filter @kovas/web exec node --test --import tsx \
 *     src/lib/ab-testing/assign.test.ts
 *
 * Aucune dépendance externe (pas de vitest dans le repo à ce jour).
 * Le seul objectif : vérifier l'assignation déterministe et la
 * distribution approximative selon les weights.
 */

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { type ABExperiment, assignVariant } from './assign'

const runningExp: ABExperiment = {
  key: 'email-1-tone',
  status: 'running',
  variants: [
    { name: 'control', weight: 50 },
    { name: 'variant_a', weight: 50 },
  ],
}

const draftExp: ABExperiment = {
  ...runningExp,
  status: 'draft',
}

test('même user + même expérience ⇒ même variant (déterministe)', () => {
  for (const sid of [
    'session-aaaa',
    'session-bbbb',
    'a3f1c2e4-0011-4220-8333-aabbccddeeff',
    'user_12345',
  ]) {
    const first = assignVariant(runningExp, sid)
    for (let i = 0; i < 10; i++) {
      assert.equal(assignVariant(runningExp, sid), first)
    }
  }
})

test('experiment status != running ⇒ retourne toujours premier variant (control)', () => {
  assert.equal(assignVariant(draftExp, 'session-aaaa'), 'control')
  assert.equal(assignVariant({ ...runningExp, status: 'paused' }, 'session-aaaa'), 'control')
  assert.equal(assignVariant({ ...runningExp, status: 'completed' }, 'session-aaaa'), 'control')
})

test('distribution 50/50 sur 10 000 users est entre 47% et 53%', () => {
  let controlCount = 0
  let variantACount = 0
  for (let i = 0; i < 10_000; i++) {
    const v = assignVariant(runningExp, `session-${i}`)
    if (v === 'control') controlCount++
    else if (v === 'variant_a') variantACount++
  }
  const ratio = controlCount / 10_000
  assert.ok(ratio > 0.47 && ratio < 0.53, `ratio control=${ratio} hors fourchette`)
  assert.equal(controlCount + variantACount, 10_000)
})

test('distribution pondérée 80/20 respectée à ±2 points', () => {
  const exp: ABExperiment = {
    key: 'weighted',
    status: 'running',
    variants: [
      { name: 'control', weight: 80 },
      { name: 'variant_a', weight: 20 },
    ],
  }
  let controlCount = 0
  for (let i = 0; i < 10_000; i++) {
    if (assignVariant(exp, `user-${i}`) === 'control') controlCount++
  }
  const ratio = controlCount / 10_000
  assert.ok(ratio > 0.78 && ratio < 0.82, `ratio control=${ratio} hors fourchette 80%`)
})

test('experiment sans variants ⇒ retourne "control" par défaut', () => {
  const exp: ABExperiment = { key: 'empty', status: 'running', variants: [] }
  assert.equal(assignVariant(exp, 'sid'), 'control')
})

test('total weight = 0 ⇒ retourne fallback premier variant', () => {
  const exp: ABExperiment = {
    key: 'zero-weight',
    status: 'running',
    variants: [
      { name: 'control', weight: 0 },
      { name: 'variant_a', weight: 0 },
    ],
  }
  assert.equal(assignVariant(exp, 'sid'), 'control')
})
