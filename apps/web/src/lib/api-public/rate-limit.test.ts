/**
 * Vitest — Rate limiter (in-memory fallback uniquement, Upstash skip si pas configuré).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkRateLimit, rateLimitHeaders } from './rate-limit'

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://kovas.fr/api/public/v1/test', { headers })
}

describe('checkRateLimit (in-memory fallback)', () => {
  beforeEach(() => {
    // Ensure Upstash disabled for these tests
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows first request and decrements remaining', async () => {
    const res = await checkRateLimit(makeRequest({ 'x-forwarded-for': '203.0.113.1' }), {
      prefix: 'test:basic',
      limit: 3,
      windowSeconds: 60,
    })
    expect(res.allowed).toBe(true)
    expect(res.limit).toBe(3)
    expect(res.remaining).toBe(2)
    expect(res.source).toBe('memory')
  })

  it('refuses past the limit and returns retry_after', async () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.2' })
    const r1 = await checkRateLimit(req, { prefix: 'test:exceed', limit: 2, windowSeconds: 60 })
    const r2 = await checkRateLimit(req, { prefix: 'test:exceed', limit: 2, windowSeconds: 60 })
    const r3 = await checkRateLimit(req, { prefix: 'test:exceed', limit: 2, windowSeconds: 60 })
    expect(r1.allowed).toBe(true)
    expect(r2.allowed).toBe(true)
    expect(r3.allowed).toBe(false)
    expect(r3.retry_after).toBeGreaterThan(0)
  })

  it('uses higher limit when X-API-Key provided', async () => {
    const reqAnon = makeRequest({ 'x-forwarded-for': '203.0.113.3' })
    const reqKey = makeRequest({
      'x-forwarded-for': '203.0.113.3',
      'x-api-key': 'k_1234567890abcdef',
    })
    const anonRes = await checkRateLimit(reqAnon, { prefix: 'test:keys' })
    const keyRes = await checkRateLimit(reqKey, { prefix: 'test:keys' })
    // anon = 60, key = 600
    expect(anonRes.limit).toBe(60)
    expect(keyRes.limit).toBe(600)
  })

  it('separates compteurs par préfixe', async () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.4' })
    const a1 = await checkRateLimit(req, { prefix: 'test:p1', limit: 1, windowSeconds: 60 })
    const a2 = await checkRateLimit(req, { prefix: 'test:p1', limit: 1, windowSeconds: 60 })
    const b1 = await checkRateLimit(req, { prefix: 'test:p2', limit: 1, windowSeconds: 60 })
    expect(a1.allowed).toBe(true)
    expect(a2.allowed).toBe(false)
    // Préfixe différent : compteur fresh
    expect(b1.allowed).toBe(true)
  })

  it('rateLimitHeaders builds standard X-RateLimit-* headers', () => {
    const headers = rateLimitHeaders({
      allowed: true,
      limit: 60,
      remaining: 42,
      reset_at: 1717255200,
      retry_after: 0,
      source: 'memory',
    })
    expect(headers['X-RateLimit-Limit']).toBe('60')
    expect(headers['X-RateLimit-Remaining']).toBe('42')
    expect(headers['X-RateLimit-Reset']).toBe('1717255200')
    expect(headers['X-RateLimit-Source']).toBe('memory')
    expect(headers['Retry-After']).toBeUndefined()
  })

  it('rateLimitHeaders includes Retry-After when refused', () => {
    const headers = rateLimitHeaders({
      allowed: false,
      limit: 60,
      remaining: 0,
      reset_at: 1717255260,
      retry_after: 47,
      source: 'memory',
    })
    expect(headers['Retry-After']).toBe('47')
  })
})
