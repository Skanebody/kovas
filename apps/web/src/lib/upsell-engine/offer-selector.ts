/**
 * KOVAS — Système 5 : Upsell engine — offer selector.
 *
 * Pure function qui sélectionne LA meilleure opportunity à présenter au user
 * maintenant. Combine `triggers.ts` (détection), `opportunity-scorer.ts`
 * (scoring) et la logique cooldown sur les recent_offers.
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §8 (Upsell engine) + §11 (retention).
 *
 * Workflow :
 *   1. Skip si cluster='churning' + health_score<40 → priorité retention.
 *   2. Skip si upsell_timing_score<30 → mauvais timing global.
 *   3. Détecte opportunities via `detectAllOpportunities`.
 *   4. Filtre cooldown (recent_offers avec même code).
 *   5. Score via `rankOpportunities`.
 *   6. Skip si top composite_score<30.
 *   7. Sinon action='send' avec top 1.
 *
 * Avatar SOBRE PROFESSIONNEL — tutoiement. Déterministe, testable, zéro IO.
 */

import { type ScoredOpportunity, type UserSignals, rankOpportunities } from './opportunity-scorer'
import { type UpsellOpportunity, type UserUpsellContext, detectAllOpportunities } from './triggers'

export interface RecentOfferRecord {
  /** Code de l'opportunity (ex : 'quota_80') */
  opportunity_code: string
  /** ISO date d'envoi */
  sent_at: string
  result: 'pending' | 'opened' | 'clicked' | 'converted' | 'ignored'
}

export interface OfferDecision {
  action: 'send' | 'skip'
  selected_opportunity?: ScoredOpportunity
  /** Phrase humaine expliquant la décision */
  reason: string
  /** True si une offer du même code est en cooldown */
  cooldown_active?: boolean
  /** Recommandation pour la prochaine évaluation (en jours) */
  next_check_recommended_in_days?: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RETENTION_HEALTH_THRESHOLD = 40
const MIN_UPSELL_TIMING_SCORE = 30
const MIN_COMPOSITE_SCORE = 30

const COOLDOWN_HARD_DAYS = 7
const COOLDOWN_IGNORED_DAYS = 30
const COOLDOWN_CONVERTED_DAYS = 90

// Days in ms — utilisé pour comparer ISO timestamps
const MS_PER_DAY = 1000 * 60 * 60 * 24

// ---------------------------------------------------------------------------
// Helpers : cooldown
// ---------------------------------------------------------------------------

interface CooldownStatus {
  blocked: boolean
  remaining_days: number
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime()
  const b = new Date(isoB).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY
  return Math.abs(b - a) / MS_PER_DAY
}

/**
 * Détermine si une opportunity est en cooldown selon les offers récents.
 *
 * Règles :
 *   - Même code envoyé < 7 jours → bloqué.
 *   - Même code envoyé < 30 jours + result='ignored' → bloqué.
 *   - Même code envoyé < 90 jours + result='converted' → bloqué (déjà converti).
 *
 * @param now ISO date courante (injecté pour testabilité)
 */
export function isOpportunityInCooldown(
  opportunity_code: string,
  recent_offers: ReadonlyArray<RecentOfferRecord>,
  now: string,
): CooldownStatus {
  let maxRemaining = 0
  let blocked = false

  for (const offer of recent_offers) {
    if (offer.opportunity_code !== opportunity_code) continue
    const days = daysBetween(offer.sent_at, now)

    // Règle 1 : < 7 jours = bloqué dur
    if (days < COOLDOWN_HARD_DAYS) {
      blocked = true
      const remaining = COOLDOWN_HARD_DAYS - days
      if (remaining > maxRemaining) maxRemaining = remaining
      continue
    }

    // Règle 2 : < 30 jours + ignored
    if (days < COOLDOWN_IGNORED_DAYS && offer.result === 'ignored') {
      blocked = true
      const remaining = COOLDOWN_IGNORED_DAYS - days
      if (remaining > maxRemaining) maxRemaining = remaining
      continue
    }

    // Règle 3 : < 90 jours + converted
    if (days < COOLDOWN_CONVERTED_DAYS && offer.result === 'converted') {
      blocked = true
      const remaining = COOLDOWN_CONVERTED_DAYS - days
      if (remaining > maxRemaining) maxRemaining = remaining
    }
  }

  return {
    blocked,
    remaining_days: Math.ceil(maxRemaining),
  }
}

// ---------------------------------------------------------------------------
// Helper : filter opportunities not in cooldown
// ---------------------------------------------------------------------------

function filterOutCooldownedOpportunities(
  opportunities: ReadonlyArray<UpsellOpportunity>,
  recent_offers: ReadonlyArray<RecentOfferRecord>,
  now: string,
): { allowed: UpsellOpportunity[]; max_cooldown_days: number } {
  const allowed: UpsellOpportunity[] = []
  let maxCooldownDays = 0
  for (const op of opportunities) {
    const status = isOpportunityInCooldown(op.trigger_code, recent_offers, now)
    if (!status.blocked) {
      allowed.push(op)
    } else if (status.remaining_days > maxCooldownDays) {
      maxCooldownDays = status.remaining_days
    }
  }
  return { allowed, max_cooldown_days: maxCooldownDays }
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Décide quelle opportunity envoyer au user maintenant.
 *
 * @param user_context Stats user (quota, missions, reviews, etc.)
 * @param user_signals Signaux composites (timing, health, cluster, tenure)
 * @param recent_offers Historique des 90 derniers jours
 * @param now ISO date courante (default : Date.now), injecté pour test
 *
 * @example
 * ```ts
 * const decision = decideOffer(context, signals, recent_offers)
 * if (decision.action === 'send') {
 *   await sendEmail(decision.selected_opportunity)
 * }
 * ```
 */
export function decideOffer(
  user_context: UserUpsellContext,
  user_signals: UserSignals,
  recent_offers: ReadonlyArray<RecentOfferRecord>,
  now: string = new Date().toISOString(),
): OfferDecision {
  // 1. Priorité retention : churning + health bas
  if (
    user_signals.cluster === 'churning' &&
    user_signals.health_score != null &&
    user_signals.health_score < RETENTION_HEALTH_THRESHOLD
  ) {
    return {
      action: 'skip',
      reason: `User en churning avec health score ${user_signals.health_score}/100 — priorité retention, pas d'upsell.`,
      next_check_recommended_in_days: 14,
    }
  }

  // 2. Skip si timing global mauvais
  if (user_signals.upsell_timing_score < MIN_UPSELL_TIMING_SCORE) {
    return {
      action: 'skip',
      reason: `Score timing upsell trop bas (${user_signals.upsell_timing_score}/100) — attendre meilleure fenêtre.`,
      next_check_recommended_in_days: 7,
    }
  }

  // 3. Détecte opportunities
  const allOpportunities = detectAllOpportunities(user_context)
  if (allOpportunities.length === 0) {
    return {
      action: 'skip',
      reason: 'Aucune opportunity détectée pour ce user à ce moment.',
      next_check_recommended_in_days: 14,
    }
  }

  // 4. Filtre cooldown
  const { allowed, max_cooldown_days } = filterOutCooldownedOpportunities(
    allOpportunities,
    recent_offers,
    now,
  )
  if (allowed.length === 0) {
    return {
      action: 'skip',
      reason: 'Toutes les opportunities détectées sont en cooldown actif.',
      cooldown_active: true,
      next_check_recommended_in_days: Math.max(1, max_cooldown_days),
    }
  }

  // 5. Score les opportunities restantes
  const ranked = rankOpportunities(allowed, user_signals)
  const top = ranked[0]
  if (top == null) {
    return {
      action: 'skip',
      reason: 'Aucune opportunity scorée.',
      next_check_recommended_in_days: 14,
    }
  }

  // 6. Skip si composite trop bas
  if (top.composite_score < MIN_COMPOSITE_SCORE) {
    return {
      action: 'skip',
      reason: `Meilleure opportunity (${top.trigger_code}) a un score ${top.composite_score}/100, sous le seuil ${MIN_COMPOSITE_SCORE}.`,
      next_check_recommended_in_days: 14,
    }
  }

  // 7. Send
  return {
    action: 'send',
    selected_opportunity: top,
    reason: `Top opportunity sélectionnée : ${top.trigger_code} (score composite ${top.composite_score}/100, prob conversion ${Math.round(top.estimated_conversion_prob * 100)}%).`,
  }
}
