/**
 * KOVAS — AI cost tracker (refonte P9 — 2026-05-28).
 *
 * Enregistre l'usage IA mensuel par organisation (Whisper, Vision, Claude) et
 * applique les HARD caps silencieusement. Les routes API IA appellent
 * `isAiDegradedMode` AVANT de lancer un appel : si dégradé, elles repassent en
 * parser local (sans Claude/Whisper).
 *
 * Architecture :
 *   - `recordAiUsage(orgId, record)` : append usage + recompute degraded flag
 *   - `isAiDegradedMode(orgId)` : check si mode dégradé actif ce mois
 *
 * Skip si `is_grandfathered = true` (anciens plans : pas de hard caps).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PRICING_PLANS,
  isLegacyPlan,
  type PricingPlanCode,
} from '@/lib/pricing-plans'

export type AiUsageType = 'whisper' | 'vision' | 'claude_input' | 'claude_output'

export interface AiUsageRecord {
  type: AiUsageType
  /** secondes pour whisper, count pour vision, tokens pour claude. */
  amount: number
  /** Coût estimé en centimes EUR. */
  costCents: number
}

export interface DegradedModeStatus {
  degraded: boolean
  reason?: 'whisper_cap' | 'vision_cap'
  /** Date 1er du mois suivant en UTC, où le mode dégradé sera levé. */
  resetAt: Date
}

interface SubscriptionRow {
  organization_id: string
  tier: string | null
  is_grandfathered: boolean | null
  hard_cap_whisper_seconds: number | null
  hard_cap_vision_calls: number | null
}

interface AiUsageRow {
  organization_id: string
  month_iso: string
  whisper_seconds: number
  vision_calls: number
  claude_tokens_input: number
  claude_tokens_output: number
  cost_cents: number
  degraded_mode_at: string | null
}

function currentMonthIso(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value ?? `${now.getUTCFullYear()}`
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${year}-${month}`
}

/** 1er du mois suivant en UTC (= date de reset du mode dégradé). */
function nextMonthResetDate(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0))
}

/**
 * Récupère le subscription + les hard caps effectifs (fallback sur PRICING_PLANS).
 */
async function getCapsForOrg(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{
  isGrandfathered: boolean
  whisperCap: number
  visionCap: number
} | null> {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('organization_id, tier, is_grandfathered, hard_cap_whisper_seconds, hard_cap_vision_calls')
    .eq('organization_id', orgId)
    .maybeSingle<SubscriptionRow>()

  if (!sub || !sub.tier) return null
  if (sub.is_grandfathered === true) {
    return { isGrandfathered: true, whisperCap: Number.POSITIVE_INFINITY, visionCap: Number.POSITIVE_INFINITY }
  }
  if (isLegacyPlan(sub.tier)) {
    return { isGrandfathered: true, whisperCap: Number.POSITIVE_INFINITY, visionCap: Number.POSITIVE_INFINITY }
  }

  const tierCode = sub.tier as PricingPlanCode
  const plan = PRICING_PLANS.find((p) => p.code === tierCode)
  if (!plan) return null

  return {
    isGrandfathered: false,
    whisperCap: sub.hard_cap_whisper_seconds ?? plan.caps.whisperSeconds,
    visionCap: sub.hard_cap_vision_calls ?? plan.caps.visionCalls,
  }
}

/**
 * Enregistre un usage IA (Whisper/Vision/Claude) et met à jour
 * `ai_usage_monthly`. Si l'usage entraîne le franchissement d'un hard cap,
 * `degraded_mode_at` est positionné.
 */
export async function recordAiUsage(
  supabase: SupabaseClient,
  orgId: string,
  record: AiUsageRecord,
): Promise<void> {
  const month = currentMonthIso()
  const caps = await getCapsForOrg(supabase, orgId)

  // Read-modify-write naïf. Acceptable car appel chaud relativement rare
  // (transcription, vision) et tolérance aux race conditions modérée (cap
  // silencieux, dépassement de quelques units pas critique). Pour atomique
  // strict, basculer vers RPC plus tard.
  const { data: existing } = await supabase
    .from('ai_usage_monthly')
    .select('*')
    .eq('organization_id', orgId)
    .eq('month_iso', month)
    .maybeSingle<AiUsageRow>()

  const next: Omit<AiUsageRow, 'organization_id' | 'month_iso'> = {
    whisper_seconds: existing?.whisper_seconds ?? 0,
    vision_calls: existing?.vision_calls ?? 0,
    claude_tokens_input: existing?.claude_tokens_input ?? 0,
    claude_tokens_output: existing?.claude_tokens_output ?? 0,
    cost_cents: (existing?.cost_cents ?? 0) + Math.max(0, record.costCents),
    degraded_mode_at: existing?.degraded_mode_at ?? null,
  }

  if (record.type === 'whisper') next.whisper_seconds += Math.max(0, record.amount)
  else if (record.type === 'vision') next.vision_calls += Math.max(0, record.amount)
  else if (record.type === 'claude_input') next.claude_tokens_input += Math.max(0, record.amount)
  else if (record.type === 'claude_output') next.claude_tokens_output += Math.max(0, record.amount)

  // Compute degraded flag
  if (!caps || caps.isGrandfathered) {
    // Pas de hard cap pour les plans grandfathered : aucun basculement dégradé
  } else if (next.degraded_mode_at === null) {
    const exceededWhisper = next.whisper_seconds >= caps.whisperCap
    const exceededVision = caps.visionCap > 0 && next.vision_calls >= caps.visionCap
    if (exceededWhisper || exceededVision) {
      next.degraded_mode_at = new Date().toISOString()
    }
  }

  await supabase.from('ai_usage_monthly').upsert(
    {
      organization_id: orgId,
      month_iso: month,
      ...next,
    },
    { onConflict: 'organization_id,month_iso' },
  )
}

/**
 * Vérifie si une org est en mode dégradé (hard cap atteint).
 * Lue par les routes API IA pour décider du parcours :
 *   - degraded=false → mode IA complet (Whisper + Claude structuration)
 *   - degraded=true  → parser JS local uniquement + toast user
 */
export async function isAiDegradedMode(
  supabase: SupabaseClient,
  orgId: string,
): Promise<DegradedModeStatus> {
  const month = currentMonthIso()
  const resetAt = nextMonthResetDate()

  const caps = await getCapsForOrg(supabase, orgId)
  if (!caps || caps.isGrandfathered) {
    return { degraded: false, resetAt }
  }

  const { data: row } = await supabase
    .from('ai_usage_monthly')
    .select('whisper_seconds, vision_calls, degraded_mode_at')
    .eq('organization_id', orgId)
    .eq('month_iso', month)
    .maybeSingle<Pick<AiUsageRow, 'whisper_seconds' | 'vision_calls' | 'degraded_mode_at'>>()

  if (!row) return { degraded: false, resetAt }

  // Si une marque degraded existe déjà ce mois : on respecte
  if (row.degraded_mode_at !== null) {
    const reasonW = row.whisper_seconds >= caps.whisperCap
    const reasonV = caps.visionCap > 0 && row.vision_calls >= caps.visionCap
    const reason: DegradedModeStatus['reason'] = reasonW ? 'whisper_cap' : reasonV ? 'vision_cap' : 'whisper_cap'
    return { degraded: true, reason, resetAt }
  }

  // Re-check live (sécurité si la marque n'a pas été posée)
  if (row.whisper_seconds >= caps.whisperCap) {
    return { degraded: true, reason: 'whisper_cap', resetAt }
  }
  if (caps.visionCap > 0 && row.vision_calls >= caps.visionCap) {
    return { degraded: true, reason: 'vision_cap', resetAt }
  }

  return { degraded: false, resetAt }
}

/** Exposé pour les tests unitaires. */
export const __testing = {
  currentMonthIso,
  nextMonthResetDate,
}
