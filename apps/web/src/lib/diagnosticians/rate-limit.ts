/**
 * Rate-limit anti-abus sur les routes claim.
 *
 * Stratégie V1 (sans Redis) : compte les claim_requests insérées par
 * la même IP dans la dernière heure. Au-delà du seuil → 429.
 *
 * Limites par défaut :
 * - 5 demandes/h par IP (toutes méthodes confondues)
 * - 10 demandes/h par diagnostician_id (cible) toutes IP confondues
 *
 * Notes :
 * - Pas atomique → 2 requêtes simultanées peuvent passer le seuil.
 *   Acceptable pour V1 (anti-abus, pas anti-DoS).
 * - Migration V2 : Upstash Redis avec sliding window précis.
 */

import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '@kovas/database/types'

const PER_IP_PER_HOUR = 5
const PER_DIAG_PER_HOUR = 10

export interface RateLimitResult {
  allowed: boolean
  reason?: 'ip_exceeded' | 'target_exceeded'
  retryAfterSec?: number
}

/**
 * Vérifie qu'une IP n'a pas dépassé PER_IP_PER_HOUR claim attempts
 * sur la dernière heure (toutes cibles confondues).
 */
export async function checkClaimRateLimit(opts: {
  ipAddress: string | null
  diagnosticianId: string
}): Promise<RateLimitResult> {
  const { ipAddress, diagnosticianId } = opts

  // Sans IP → on autorise (proxy mal configuré, dev local) mais on log
  if (!ipAddress) return { allowed: true }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  // biome-ignore lint/suspicious/noExplicitAny: types regen post-merge A1+A4
  const adminAny = admin as any

  // Count par IP
  const { count: ipCount } = await adminAny
    .from('claim_requests')
    .select('id', { count: 'exact', head: true })
    .eq('ip_address', ipAddress)
    .gte('created_at', oneHourAgo)

  if (typeof ipCount === 'number' && ipCount >= PER_IP_PER_HOUR) {
    return { allowed: false, reason: 'ip_exceeded', retryAfterSec: 3600 }
  }

  // Count par cible (diagnostician_id) — protège contre brute force d'une fiche
  const { count: diagCount } = await adminAny
    .from('claim_requests')
    .select('id', { count: 'exact', head: true })
    .eq('diagnostician_id', diagnosticianId)
    .gte('created_at', oneHourAgo)

  if (typeof diagCount === 'number' && diagCount >= PER_DIAG_PER_HOUR) {
    return { allowed: false, reason: 'target_exceeded', retryAfterSec: 3600 }
  }

  return { allowed: true }
}

/**
 * Extrait l'IP source d'une Request, en respectant les en-têtes Vercel/Cloudflare.
 * Retourne null si non extractible (dev local sans proxy).
 */
export function extractIpFromRequest(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    // Premier IP de la liste = client réel
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = request.headers.get('x-real-ip')
  if (real) return real
  // Cloudflare
  const cf = request.headers.get('cf-connecting-ip')
  if (cf) return cf
  return null
}
