/**
 * KOVAS — Rate limits anti-spam V1 pour quote_requests.
 *
 * Table SQL `quote_request_rate_limits` avec UNIQUE(key, bucket_start_at).
 * Stratégie : fenêtre glissante "fixed window" par tranche d'1h
 * (simple à maintenir en V1, suffisamment précis pour les seuils définis).
 *
 * Clés :
 *  - 'ip:<addr>'                      → 3 demandes / 24h
 *  - 'email:<addr>'                   → 5 demandes / 7j
 *  - 'email_diag:<addr>:<diag_uuid>'  → 1 demande / 24h
 *
 * V1.5 : remplacer par Redis (Upstash) avec sliding window précis si abus détecté.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface RateLimitConfig {
  ipRequests24h: number
  emailToDiag24h: number
  emailTotal7d: number
}

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  ipRequests24h: 3,
  emailToDiag24h: 1,
  emailTotal7d: 5,
}

export interface RateLimitVerdict {
  allowed: boolean
  remaining: number
  resetAt: Date
}

/**
 * Vérifie un compteur sur une fenêtre glissante (en heures).
 * N'incrémente PAS — usage `checkRateLimit` puis `recordRateLimitHit` séparément
 * pour permettre une stratégie "fail-open" sur erreur DB.
 */
export async function checkRateLimit(
  // biome-ignore lint/suspicious/noExplicitAny: client générique service_role
  supabase: SupabaseClient<any, any, any>,
  key: string,
  windowHours: number,
  maxCount: number,
): Promise<RateLimitVerdict> {
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000)
  const resetAt = new Date(Date.now() + windowHours * 60 * 60 * 1000)

  // biome-ignore lint/suspicious/noExplicitAny: dynamic table not in generated types
  const { data, error } = await (supabase as any)
    .from('quote_request_rate_limits')
    .select('count, bucket_start_at')
    .eq('key', key)
    .gte('bucket_start_at', windowStart.toISOString())

  if (error) {
    // Fail-open : si la DB rate, on autorise (mieux que bloquer tout le monde)
    console.error('[rate-limits] check failed', { key, error })
    return { allowed: true, remaining: maxCount, resetAt }
  }

  const rows = (data ?? []) as Array<{ count: number; bucket_start_at: string }>
  const total = rows.reduce((acc, r) => acc + (r.count ?? 0), 0)
  const remaining = Math.max(0, maxCount - total)
  return {
    allowed: total < maxCount,
    remaining,
    resetAt,
  }
}

/**
 * Enregistre 1 hit pour chaque clé fournie sur la fenêtre courante (bucket d'1h).
 * Idempotent : UNIQUE(key, bucket_start_at) + ON CONFLICT increment count.
 */
export async function recordRateLimitHit(
  // biome-ignore lint/suspicious/noExplicitAny: client générique
  supabase: SupabaseClient<any, any, any>,
  keys: string[],
): Promise<void> {
  if (keys.length === 0) return

  // Bucket = début de l'heure courante (UTC, idempotent)
  const now = new Date()
  const bucketStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      0,
      0,
      0,
    ),
  ).toISOString()

  // upsert + increment via RPC simple : tentative insert, fallback update si conflict
  for (const key of keys) {
    // biome-ignore lint/suspicious/noExplicitAny: dynamic table
    const { error: insertErr } = await (supabase as any)
      .from('quote_request_rate_limits')
      .insert({ key, bucket_start_at: bucketStart, count: 1 })

    if (insertErr) {
      // Conflict probable — incrémente
      // biome-ignore lint/suspicious/noExplicitAny: dynamic table
      const { data: row } = await (supabase as any)
        .from('quote_request_rate_limits')
        .select('id, count')
        .eq('key', key)
        .eq('bucket_start_at', bucketStart)
        .maybeSingle()

      if (row && typeof row.id === 'string') {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic table
        await (supabase as any)
          .from('quote_request_rate_limits')
          .update({ count: (row.count ?? 0) + 1 })
          .eq('id', row.id)
      }
    }
  }
}

export function ipKey(ip: string): string {
  return `ip:${ip.trim().toLowerCase()}`
}

export function emailKey(email: string): string {
  return `email:${email.trim().toLowerCase()}`
}

export function emailDiagKey(email: string, diagId: string): string {
  return `email_diag:${email.trim().toLowerCase()}:${diagId}`
}

/**
 * Tente toutes les vérifications anti-spam et retourne la première violation,
 * ou null si tout passe.
 */
export interface MultiRateLimitFailure {
  reason: 'ip_24h' | 'email_diag_24h' | 'email_7d'
  resetAt: Date
}

export async function checkAllRateLimits(
  // biome-ignore lint/suspicious/noExplicitAny: client générique
  supabase: SupabaseClient<any, any, any>,
  ctx: { ip: string | null; email: string; diagnosticianId: string | null },
  config: RateLimitConfig = DEFAULT_RATE_LIMITS,
): Promise<MultiRateLimitFailure | null> {
  // 1. IP 24h
  if (ctx.ip) {
    const verdict = await checkRateLimit(supabase, ipKey(ctx.ip), 24, config.ipRequests24h)
    if (!verdict.allowed) {
      return { reason: 'ip_24h', resetAt: verdict.resetAt }
    }
  }

  // 2. Email → même diag 24h (si diag spécifique)
  if (ctx.diagnosticianId) {
    const verdict = await checkRateLimit(
      supabase,
      emailDiagKey(ctx.email, ctx.diagnosticianId),
      24,
      config.emailToDiag24h,
    )
    if (!verdict.allowed) {
      return { reason: 'email_diag_24h', resetAt: verdict.resetAt }
    }
  }

  // 3. Email total 7 jours
  const verdict = await checkRateLimit(supabase, emailKey(ctx.email), 24 * 7, config.emailTotal7d)
  if (!verdict.allowed) {
    return { reason: 'email_7d', resetAt: verdict.resetAt }
  }

  return null
}
