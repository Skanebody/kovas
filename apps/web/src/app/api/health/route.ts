/**
 * Endpoint de monitoring santé infrastructure.
 *
 * Vérifie en parallèle les 5 services critiques :
 * - Supabase (Postgres + Auth)
 * - Stripe (paiements + abonnements)
 * - Anthropic (Claude — structuration vocale, vision)
 * - Groq (LLM fallback / fast inference)
 * - Brevo (SMS rappel J-1)
 *
 * Réponse :
 * - 200 si all healthy
 * - 503 si dégradé (au moins 1 service down)
 *
 * Consommé par Better Stack (uptime monitoring 60s × 3 régions) +
 * banner in-app temps réel.
 */
import { NextResponse } from 'next/server'
import { isStripeConfigured, getStripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CheckStatus = 'ok' | 'error' | 'skipped'

interface ServiceCheck {
  service: string
  status: CheckStatus
  latency_ms: number
  error?: string
}

interface HealthResponse {
  status: 'healthy' | 'degraded'
  timestamp: string
  checks: ServiceCheck[]
}

const HEALTH_TIMEOUT_MS = 3000

/**
 * Wrappe une promesse avec un timeout strict. Évite qu'un service lent ne fasse
 * exploser la latence du endpoint /api/health (consommé par uptime checker).
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms),
    ),
  ])
}

async function checkSupabase(): Promise<ServiceCheck> {
  const start = Date.now()
  try {
    const supabase = await createClient()
    // Requête légère : `count` sur une table toujours présente. Le builder
    // Postgrest est thenable mais pas une Promise stricte — on l'enveloppe dans
    // une fonction async pour rester compatible avec withTimeout<T>.
    const result = await withTimeout(
      (async () =>
        await supabase
          .from('organizations')
          .select('id', { head: true, count: 'exact' })
          .limit(1))(),
      HEALTH_TIMEOUT_MS,
    )
    if (result.error) throw new Error(result.error.message)
    return { service: 'supabase', status: 'ok', latency_ms: Date.now() - start }
  } catch (err) {
    return {
      service: 'supabase',
      status: 'error',
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : 'unknown error',
    }
  }
}

async function checkStripe(): Promise<ServiceCheck> {
  const start = Date.now()
  if (!isStripeConfigured()) {
    return { service: 'stripe', status: 'skipped', latency_ms: 0 }
  }
  try {
    const stripe = getStripe()
    await withTimeout(stripe.balance.retrieve(), HEALTH_TIMEOUT_MS)
    return { service: 'stripe', status: 'ok', latency_ms: Date.now() - start }
  } catch (err) {
    return {
      service: 'stripe',
      status: 'error',
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : 'unknown error',
    }
  }
}

async function checkAnthropic(): Promise<ServiceCheck> {
  const start = Date.now()
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { service: 'anthropic', status: 'skipped', latency_ms: 0 }
  }
  try {
    const res = await withTimeout(
      fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      }),
      HEALTH_TIMEOUT_MS,
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { service: 'anthropic', status: 'ok', latency_ms: Date.now() - start }
  } catch (err) {
    return {
      service: 'anthropic',
      status: 'error',
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : 'unknown error',
    }
  }
}

async function checkGroq(): Promise<ServiceCheck> {
  const start = Date.now()
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { service: 'groq', status: 'skipped', latency_ms: 0 }
  }
  try {
    const res = await withTimeout(
      fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      HEALTH_TIMEOUT_MS,
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { service: 'groq', status: 'ok', latency_ms: Date.now() - start }
  } catch (err) {
    return {
      service: 'groq',
      status: 'error',
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : 'unknown error',
    }
  }
}

async function checkBrevo(): Promise<ServiceCheck> {
  const start = Date.now()
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    return { service: 'brevo', status: 'skipped', latency_ms: 0 }
  }
  try {
    const res = await withTimeout(
      fetch('https://api.brevo.com/v3/account', {
        method: 'GET',
        headers: { 'api-key': apiKey, accept: 'application/json' },
      }),
      HEALTH_TIMEOUT_MS,
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { service: 'brevo', status: 'ok', latency_ms: Date.now() - start }
  } catch (err) {
    return {
      service: 'brevo',
      status: 'error',
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : 'unknown error',
    }
  }
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const checks = await Promise.all([
    checkSupabase(),
    checkStripe(),
    checkAnthropic(),
    checkGroq(),
    checkBrevo(),
  ])

  const hasError = checks.some((c) => c.status === 'error')
  const body: HealthResponse = {
    status: hasError ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    checks,
  }

  return NextResponse.json(body, {
    status: hasError ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
