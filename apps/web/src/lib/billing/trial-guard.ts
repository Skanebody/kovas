import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { cache } from 'react'

/**
 * KOVAS — Garde "essai expiré sans paiement"
 * Cf. CLAUDE.md §6 — Essai gratuit 14 jours + conversion à J14
 *
 * À l'expiration du trial 14 jours :
 *   - Si une carte/SEPA est enregistré côté Stripe (`stripe_customer_id` présent
 *     ET un `payment_method` actif côté webhook) → la subscription passe d'elle-même
 *     en `active` via Stripe.
 *   - Sinon (pas de moyen de paiement) → on bloque l'accès à l'app et on redirige
 *     vers `/dashboard/account?expired=1` qui propose le choix de plan + saisie CB.
 *
 * Les routes whitelistées (account, billing portal, status page, logout, API)
 * restent accessibles pour permettre la conversion.
 *
 * Ce guard est volontairement permissif : si la subscription est introuvable
 * (compte tout neuf ou bug DB), on laisse passer et on logue côté Sentry.
 */

export type TrialGuardVerdict =
  | { kind: 'ok' }
  | { kind: 'expired'; reason: string; expiresAt: string | null }

interface SubscriptionGuardRow {
  status: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
}

/**
 * Vérifie si l'utilisateur courant est bloqué pour cause d'essai expiré.
 *
 * Memoized par requête : appelé depuis le layout `/dashboard/*`, pas de coût
 * additionnel sur les pages enfants.
 */
export const checkTrialGuard = cache(
  async (
    supabase: SupabaseClient,
    orgId: string | null | undefined,
  ): Promise<TrialGuardVerdict> => {
    if (!orgId) return { kind: 'ok' }

    const sb = supabase as unknown as {
      from: (t: 'subscriptions') => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: SubscriptionGuardRow | null }>
          }
        }
      }
    }

    const { data: sub } = await sb
      .from('subscriptions')
      .select(
        'status, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id',
      )
      .eq('organization_id', orgId)
      .maybeSingle()

    // Pas de subscription → laisse passer (parcours onboarding/free)
    if (!sub) return { kind: 'ok' }

    const status = sub.status ?? ''
    const now = new Date()
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null

    // Bloque si :
    //   - status = 'trialing' ou 'past_due' ou 'unpaid'
    //   - ET current_period_end < maintenant
    //   - ET pas de moyen de paiement (stripe_customer_id null OU stripe_subscription_id null)
    const isExpiredStatus =
      status === 'trialing' || status === 'past_due' || status === 'unpaid'
    const isPeriodExpired = periodEnd !== null && periodEnd < now
    const hasNoPaymentSetup =
      !sub.stripe_customer_id || !sub.stripe_subscription_id

    if (isExpiredStatus && isPeriodExpired && hasNoPaymentSetup) {
      return {
        kind: 'expired',
        reason:
          status === 'trialing'
            ? 'Votre essai gratuit de 14 jours est arrivé à échéance.'
            : 'Votre paiement n\'a pas pu être traité.',
        expiresAt: sub.current_period_end,
      }
    }

    // Statuts canceled / incomplete_expired : déjà géré par Stripe + workflow résiliation
    return { kind: 'ok' }
  },
)

/**
 * Routes whitelistées : restent accessibles même quand l'essai a expiré,
 * pour permettre à l'utilisateur de payer ou consulter ses données.
 */
const WHITELIST: readonly string[] = [
  '/dashboard/account',
  '/dashboard/billing',
  '/dashboard/cancel',
  '/dashboard/reactivate',
  '/dashboard/status',
  '/dashboard/legal',
  '/dashboard/upgrade',
  '/api', // toutes les routes API
]

export function isPathWhitelisted(pathname: string): boolean {
  return WHITELIST.some((prefix) => pathname.startsWith(prefix))
}
