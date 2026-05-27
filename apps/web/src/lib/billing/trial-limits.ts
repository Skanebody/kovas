import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * KOVAS — Limites silencieuses de l'essai gratuit 30 jours
 *
 * Politique (cf. CLAUDE.md §6 + spec utilisateur 2026-05-22) :
 *   - CB enregistrée obligatoire à la souscription
 *   - Débit automatique à J+30
 *   - Pendant les 30 jours d'essai, hard caps silencieux anti-abus :
 *       • 30 missions / mois
 *       • 5h de transcription Whisper / mois (18 000 secondes)
 *       • 100 photos Vision IA / mois
 *       • 50 messages Claude chatbot / mois
 *
 * Au dépassement : message gracieux + CTA upgrade vers un forfait payant.
 * Le compte reste utilisable pour les actions hors quotas (lecture, exports, etc.).
 *
 * Implémentation : on s'appuie sur `subscriptions.status = 'trialing'` pour détecter
 * la période d'essai, et sur `ai_usage_monthly` (whisper, vision, claude) + `missions`
 * (count du mois courant) pour lire les compteurs déjà tenus par les workflows existants.
 */

export type TrialLimitedAction =
  | 'mission_create'
  | 'whisper_transcription'
  | 'vision_photo_analyze'
  | 'claude_chat_message'

export interface TrialLimitConfig {
  /** Plafond mensuel pour cette action pendant l'essai. */
  cap: number
  /** Unité humaine pour message d'erreur (ex: 'missions', 'minutes Whisper'). */
  unitLabel: string
  /** Label long pour la modal d'upgrade. */
  longLabel: string
}

/** Caps officiels de l'essai gratuit 30 jours — source de vérité. */
export const TRIAL_LIMITS: Record<TrialLimitedAction, TrialLimitConfig> = {
  mission_create: {
    cap: 30,
    unitLabel: 'missions',
    longLabel: 'Création de missions',
  },
  whisper_transcription: {
    // 5h = 18 000 secondes ; on raisonne en secondes pour cohérence avec ai_usage_monthly.
    cap: 5 * 60 * 60,
    unitLabel: 'secondes de transcription Whisper',
    longLabel: 'Transcription vocale Whisper',
  },
  vision_photo_analyze: {
    cap: 100,
    unitLabel: 'analyses Vision IA',
    longLabel: 'Analyse Vision IA des photos',
  },
  claude_chat_message: {
    cap: 50,
    unitLabel: 'messages assistant IA',
    longLabel: 'Messages assistant Claude',
  },
}

export type TrialLimitVerdict =
  | { kind: 'ok'; used: number; cap: number; remaining: number }
  | {
      kind: 'limit_reached'
      action: TrialLimitedAction
      used: number
      cap: number
      message: string
      ctaHref: string
    }
  | { kind: 'not_in_trial' }

/* ─── Lectures DB ─── */

interface SubscriptionTrialRow {
  status: string | null
  current_period_end: string | null
}

interface AiUsageRow {
  whisper_seconds: number
  vision_calls: number
}

/**
 * Vrai SSI la subscription de l'org est en statut `trialing` (essai 30j non encore débité).
 * Memoized par requête via React cache appelant (le caller décide).
 */
async function isOrganizationInTrial(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const sb = supabase as unknown as {
    from: (t: 'subscriptions') => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{ data: SubscriptionTrialRow | null }>
        }
      }
    }
  }
  const { data } = await sb
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!data) return false
  return (data.status ?? '') === 'trialing'
}

/**
 * YYYY-MM Europe/Paris pour cohérence avec `ai_usage_monthly.month_iso`
 * et avec les Edge Functions worker.
 */
function currentMonthIsoParis(): string {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
  })
  const parts = fmt.formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value ?? `${now.getUTCFullYear()}`
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${year}-${month}`
}

/**
 * Lit `ai_usage_monthly` pour l'org × mois courant.
 * Retourne { whisper_seconds: 0, vision_calls: 0 } si pas de ligne.
 */
async function getAiUsageThisMonth(supabase: SupabaseClient, orgId: string): Promise<AiUsageRow> {
  const sb = supabase as unknown as {
    from: (t: 'ai_usage_monthly') => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          eq: (
            col: string,
            val: string,
          ) => {
            maybeSingle: () => Promise<{ data: AiUsageRow | null }>
          }
        }
      }
    }
  }
  const { data } = await sb
    .from('ai_usage_monthly')
    .select('whisper_seconds, vision_calls')
    .eq('organization_id', orgId)
    .eq('month_iso', currentMonthIsoParis())
    .maybeSingle()
  return data ?? { whisper_seconds: 0, vision_calls: 0 }
}

/**
 * Compte les missions créées ce mois-ci (Europe/Paris) pour l'org.
 * Filtre `deleted_at IS NULL`.
 */
async function getMissionsCreatedThisMonth(
  supabase: SupabaseClient,
  orgId: string,
): Promise<number> {
  const fmtDay = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const now = new Date()
  const parts = fmtDay.formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value ?? `${now.getUTCFullYear()}`
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  const startOfMonthIso = `${year}-${month}-01T00:00:00.000Z`

  const sb = supabase as unknown as {
    from: (t: 'missions') => {
      select: (
        cols: string,
        opts: { count: 'exact'; head: true },
      ) => {
        eq: (
          col: string,
          val: string,
        ) => {
          is: (
            col: string,
            val: null,
          ) => {
            gte: (col: string, val: string) => Promise<{ count: number | null }>
          }
        }
      }
    }
  }
  const { count } = await sb
    .from('missions')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .gte('created_at', startOfMonthIso)
  return count ?? 0
}

/**
 * Lit `user_usage_quotas.chatbot_messages_used` (déjà tenu par le quota-tracker).
 * Retourne 0 si pas de ligne pour le mois courant.
 */
async function getClaudeMessagesThisMonth(
  supabase: SupabaseClient,
  orgId: string,
): Promise<number> {
  const fmtDay = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const now = new Date()
  const parts = fmtDay.formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value ?? `${now.getUTCFullYear()}`
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  const period = `${year}-${month}-01`

  const sb = supabase as unknown as {
    from: (t: 'user_usage_quotas') => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          eq: (
            col: string,
            val: string,
          ) => {
            maybeSingle: () => Promise<{ data: { chatbot_messages_used: number } | null }>
          }
        }
      }
    }
  }
  const { data } = await sb
    .from('user_usage_quotas')
    .select('chatbot_messages_used')
    .eq('organization_id', orgId)
    .eq('period_month', period)
    .maybeSingle()
  return data ? Number(data.chatbot_messages_used) || 0 : 0
}

/* ─── API publique ─── */

/**
 * Vérifie si l'action `action` est autorisée pour l'org `orgId` au regard des
 * limites de l'essai gratuit 30 jours.
 *
 * Logique :
 *   1. Si l'org n'est pas en `trialing` → `{ kind: 'not_in_trial' }` (laisse passer)
 *   2. Sinon, lit le compteur courant + cap configuré
 *   3. Si used + delta > cap → `{ kind: 'limit_reached', message, ctaHref }`
 *   4. Sinon → `{ kind: 'ok', remaining }`
 *
 * NB : ne modifie aucun compteur. À appeler AVANT l'action.
 */
export async function checkTrialLimit(
  supabase: SupabaseClient,
  orgId: string,
  action: TrialLimitedAction,
  delta = 1,
): Promise<TrialLimitVerdict> {
  if (!(await isOrganizationInTrial(supabase, orgId))) {
    return { kind: 'not_in_trial' }
  }
  const config = TRIAL_LIMITS[action]

  let used = 0
  if (action === 'mission_create') {
    used = await getMissionsCreatedThisMonth(supabase, orgId)
  } else if (action === 'whisper_transcription') {
    const u = await getAiUsageThisMonth(supabase, orgId)
    used = Number(u.whisper_seconds) || 0
  } else if (action === 'vision_photo_analyze') {
    const u = await getAiUsageThisMonth(supabase, orgId)
    used = Number(u.vision_calls) || 0
  } else if (action === 'claude_chat_message') {
    used = await getClaudeMessagesThisMonth(supabase, orgId)
  }

  if (used + delta > config.cap) {
    return {
      kind: 'limit_reached',
      action,
      used,
      cap: config.cap,
      message: `Vous avez atteint la limite de l'essai gratuit (${config.longLabel} : ${config.cap} ${config.unitLabel} / mois). Passez à un forfait payant pour continuer sans limite.`,
      ctaHref: '/dashboard/upgrade/logiciel',
    }
  }
  return { kind: 'ok', used, cap: config.cap, remaining: config.cap - used }
}

/**
 * Variante "throw" pour usage dans server actions / API routes critiques.
 * Lève `TrialLimitExceededError` si la limite est atteinte ; sinon ne fait rien.
 */
export async function assertTrialLimitNotExceeded(
  supabase: SupabaseClient,
  orgId: string,
  action: TrialLimitedAction,
  delta = 1,
): Promise<void> {
  const verdict = await checkTrialLimit(supabase, orgId, action, delta)
  if (verdict.kind === 'limit_reached') {
    throw new TrialLimitExceededError(verdict.message, {
      action: verdict.action,
      used: verdict.used,
      cap: verdict.cap,
      ctaHref: verdict.ctaHref,
    })
  }
}

export interface TrialLimitExceededDetails {
  action: TrialLimitedAction
  used: number
  cap: number
  ctaHref: string
}

export class TrialLimitExceededError extends Error {
  readonly details: TrialLimitExceededDetails
  constructor(message: string, details: TrialLimitExceededDetails) {
    super(message)
    this.name = 'TrialLimitExceededError'
    this.details = details
  }
}
