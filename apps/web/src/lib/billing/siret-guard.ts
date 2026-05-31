import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { cache } from 'react'

/**
 * KOVAS — Garde "SIRET obligatoire après paiement".
 *
 * Funnel sans friction (décision Benjamin 2026-05-30) : on ne demande plus le
 * SIRET au signup. Le SIRET ne devient obligatoire qu'UNE FOIS LA CB ENREGISTRÉE
 * (subscription Stripe créée avec `stripe_customer_id` + `stripe_subscription_id`).
 * Tant que l'organisation n'a pas de SIRET vérifié à ce stade, on redirige vers
 * `/dashboard/account/verify-siret` (page whitelistée par `trial-guard`).
 *
 * Volontairement permissif : pas d'orgId, pas de subscription (= avant paiement),
 * ou SIRET déjà présent → `ok` (aucune friction avant le paiement).
 */

export type SiretGuardVerdict = { kind: 'ok' } | { kind: 'missing' }

interface OrgSiretRow {
  siret: string | null
}

interface SubPaymentRow {
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

export const checkSiretGuard = cache(
  async (
    supabase: SupabaseClient,
    orgId: string | null | undefined,
  ): Promise<SiretGuardVerdict> => {
    if (!orgId) return { kind: 'ok' }

    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>
          }
        }
      }
    }

    // 1. L'organisation a-t-elle déjà un SIRET ? Si oui → rien à exiger.
    const { data: org } = (await sb
      .from('organizations')
      .select('siret')
      .eq('id', orgId)
      .maybeSingle()) as { data: OrgSiretRow | null }

    if (org && typeof org.siret === 'string' && org.siret.trim().length > 0) {
      return { kind: 'ok' }
    }

    // 2. Un SIRET a-t-il déjà été fourni via cabinet_trials (ancien flux : le SIRET
    //    vivait dans cabinet_trials, pas dans organizations) ? Si oui → ne pas
    //    verrouiller les comptes existants déjà payants.
    const { data: trial } = (await sb
      .from('cabinet_trials')
      .select('id')
      .eq('organization_id', orgId)
      .maybeSingle()) as { data: { id: string } | null }

    if (trial) return { kind: 'ok' }

    // 3. Pas de SIRET nulle part : on ne l'exige QUE si la CB a été enregistrée
    //    (subscription Stripe créée). Avant le paiement → onboarding sans friction.
    const { data: sub } = (await sb
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('organization_id', orgId)
      .maybeSingle()) as { data: SubPaymentRow | null }

    const hasPaymentSetup =
      !!sub &&
      typeof sub.stripe_customer_id === 'string' &&
      sub.stripe_customer_id.length > 0 &&
      typeof sub.stripe_subscription_id === 'string' &&
      sub.stripe_subscription_id.length > 0

    return hasPaymentSetup ? { kind: 'missing' } : { kind: 'ok' }
  },
)
