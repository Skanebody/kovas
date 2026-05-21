/**
 * KOVAS — Fair-use monitor (refonte P9 — 2026-05-28).
 *
 * Modèle all-you-can-eat : missions illimitées sous fair-use cap par tier.
 * Si une organisation dépasse son soft cap trois mois consécutifs, on
 * suggère le tier au-dessus par email.
 *
 * Architecture :
 *   - `checkFairUseStatus` : lecture du statut courant (live)
 *   - `processFairUseAlerts` : cron mensuel, agrège + envoie les emails
 *
 * Skip si `is_grandfathered = true` (anciens plans → logique surplus
 * historique conservée, pas de fair-use).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PRICING_PLANS,
  isLegacyPlan,
  type PricingPlanCode,
} from '@/lib/pricing-plans'

/** Statut fair-use courant pour une organisation. */
export interface FairUseStatus {
  withinCap: boolean
  missionsCount: number
  missionsCap: number
  monthIso: string
  recommendation: 'continue' | 'consider_upgrade' | 'upgrade_required'
  suggestedTier?: PricingPlanCode
}

/** Résultat du cron mensuel. */
export interface ProcessFairUseAlertsResult {
  organizationsScanned: number
  newOverages: number
  alertsSent: number
  errors: number
}

/** Tier le plus petit dont le cap couvre le volume mensuel donné. */
function suggestUpgradeTier(missionsCount: number, currentTier: PricingPlanCode): PricingPlanCode | undefined {
  // Ordre canonique des tiers (du plus petit cap au plus grand)
  const tiersSorted = [...PRICING_PLANS].sort(
    (a, b) => a.caps.missions - b.caps.missions,
  )
  const currentIdx = tiersSorted.findIndex((p) => p.code === currentTier)
  // On cherche le premier tier strictement au-dessus du courant qui couvre le volume
  for (let i = currentIdx + 1; i < tiersSorted.length; i += 1) {
    const tier = tiersSorted[i]
    if (tier && missionsCount <= tier.caps.missions) {
      return tier.code
    }
  }
  // Si rien ne suffit, on suggère le plus gros tier disponible (Cabinet)
  return tiersSorted[tiersSorted.length - 1]?.code
}

/** Calcule la chaîne YYYY-MM en timezone Paris pour une date donnée. */
function monthIsoFor(date: Date): string {
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = parts.find((p) => p.type === 'year')?.value ?? `${date.getUTCFullYear()}`
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${year}-${month}`
}

/** Renvoie le 1er et le dernier jour ISO du mois donné en timezone Paris. */
function monthBounds(monthIso: string): { startIso: string; endIso: string } {
  const [yearStr, monthStr] = monthIso.split('-')
  const year = Number(yearStr)
  const monthIdx = Number(monthStr) - 1 // JS month 0-indexed
  const start = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0))
  const end = new Date(Date.UTC(year, monthIdx + 1, 1, 0, 0, 0))
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

interface SubscriptionRow {
  organization_id: string
  tier: string | null
  is_grandfathered: boolean | null
  fair_use_cap_missions: number | null
  status: string | null
}

/**
 * Vérifie le statut fair-use pour une organisation au mois courant.
 *
 * Renvoie `null` si :
 *   - L'organisation n'a pas d'abonnement actif
 *   - L'abonnement est grandfathered (logique surplus historique, pas de fair-use)
 *   - Le tier n'est pas reconnu
 */
export async function checkFairUseStatus(
  supabase: SupabaseClient,
  orgId: string,
): Promise<FairUseStatus | null> {
  // 1) Lecture abonnement
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('organization_id, tier, is_grandfathered, fair_use_cap_missions, status')
    .eq('organization_id', orgId)
    .maybeSingle<SubscriptionRow>()

  if (!sub || !sub.tier) return null
  if (sub.is_grandfathered === true) return null // anciens plans : pas de fair-use
  if (isLegacyPlan(sub.tier)) return null

  const tierCode = sub.tier as PricingPlanCode
  const plan = PRICING_PLANS.find((p) => p.code === tierCode)
  if (!plan) return null

  const cap = sub.fair_use_cap_missions ?? plan.caps.missions
  const nowParisIso = monthIsoFor(new Date())
  const { startIso, endIso } = monthBounds(nowParisIso)

  // 2) Comptage missions ce mois (Paris time)
  const { count } = await supabase
    .from('missions')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .gte('created_at', startIso)
    .lt('created_at', endIso)

  const missionsCount = count ?? 0
  const withinCap = missionsCount <= cap

  let recommendation: FairUseStatus['recommendation'] = 'continue'
  let suggested: PricingPlanCode | undefined
  if (!withinCap) {
    suggested = suggestUpgradeTier(missionsCount, tierCode)
    // Sur le mois courant : on suggère "consider_upgrade" (pas encore confirmé
    // sur 3 mois). Le passage à "upgrade_required" se fait dans le cron.
    recommendation = 'consider_upgrade'
  }

  return {
    withinCap,
    missionsCount,
    missionsCap: cap,
    monthIso: nowParisIso,
    recommendation,
    suggestedTier: suggested,
  }
}

/**
 * Cron mensuel : pour chaque organisation au-dessus du cap N mois consécutifs,
 * envoie un email upgrade. Idempotent : ne renvoie pas le mail si déjà envoyé
 * pour le mois courant.
 *
 * À appeler le 1er du mois 8h CET via supabase cron (cf. Edge Function).
 */
export async function processFairUseAlerts(
  supabase: SupabaseClient,
): Promise<ProcessFairUseAlertsResult> {
  const result: ProcessFairUseAlertsResult = {
    organizationsScanned: 0,
    newOverages: 0,
    alertsSent: 0,
    errors: 0,
  }

  // Mois "audité" = mois précédent
  const now = new Date()
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15)
  const monthIso = monthIsoFor(lastMonthDate)
  const { startIso, endIso } = monthBounds(monthIso)

  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('organization_id, tier, is_grandfathered, fair_use_cap_missions, status')
    .in('status', ['active', 'trialing'])
    .neq('is_grandfathered', true)

  if (error || !subs) {
    result.errors += 1
    return result
  }

  for (const sub of subs as SubscriptionRow[]) {
    result.organizationsScanned += 1
    if (!sub.tier || isLegacyPlan(sub.tier)) continue

    const tierCode = sub.tier as PricingPlanCode
    const plan = PRICING_PLANS.find((p) => p.code === tierCode)
    if (!plan) continue

    const cap = sub.fair_use_cap_missions ?? plan.caps.missions

    const { count } = await supabase
      .from('missions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', sub.organization_id)
      .is('deleted_at', null)
      .gte('created_at', startIso)
      .lt('created_at', endIso)

    const missionsCount = count ?? 0
    if (missionsCount <= cap) {
      // Mois sous le cap : reset éventuel du compteur de mois consécutifs
      // (insertion d'une ligne reset, ou skip si rien à faire). On choisit
      // de NE PAS écrire si jamais en dépassement (économise des inserts).
      continue
    }

    // Mois en dépassement : calcul du compteur consécutif
    const { data: prevAlert } = await supabase
      .from('fair_use_alerts')
      .select('consecutive_months_over')
      .eq('organization_id', sub.organization_id)
      .order('month_iso', { ascending: false })
      .limit(1)
      .maybeSingle<{ consecutive_months_over: number }>()

    const consecutive = (prevAlert?.consecutive_months_over ?? 0) + 1

    const { error: insertErr } = await supabase.from('fair_use_alerts').upsert(
      {
        organization_id: sub.organization_id,
        month_iso: monthIso,
        missions_count: missionsCount,
        cap_threshold: cap,
        consecutive_months_over: consecutive,
      },
      { onConflict: 'organization_id,month_iso' },
    )
    if (insertErr) {
      result.errors += 1
      continue
    }
    result.newOverages += 1

    // Email d'upgrade après 3 mois consécutifs
    if (consecutive >= 3) {
      const suggested = suggestUpgradeTier(missionsCount, tierCode)
      // L'envoi effectif Resend est délégué à l'Edge Function. Ici on marque
      // juste l'intention via email_sent_at = now(). L'Edge Function relit
      // les lignes où email_sent_at IS NULL AND consecutive >= 3.
      const { error: markErr } = await supabase
        .from('fair_use_alerts')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('organization_id', sub.organization_id)
        .eq('month_iso', monthIso)
        .is('email_sent_at', null)
      if (markErr) {
        result.errors += 1
        continue
      }
      result.alertsSent += 1
      // Le suggested tier est passé à l'Edge Function via la jointure metadata
      // (ou simplement recalculé là-bas).
      void suggested
    }
  }

  return result
}

/** Helpers exposés pour les tests unitaires. */
export const __testing = {
  suggestUpgradeTier,
  monthIsoFor,
  monthBounds,
}
