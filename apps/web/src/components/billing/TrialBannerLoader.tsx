import { getCurrentUser } from '@/lib/auth/current-user'
import { KOVAS_TIERS } from '@/lib/stripe-config'
import { TrialBanner } from './TrialBanner'

/**
 * Server component qui charge l'état d'essai courant et rend le `TrialBanner`
 * client uniquement si l'utilisateur est en `trialing` avec une `trial_ends_at` future.
 *
 * Branchage dans `app/app/layout.tsx`. Coût : 1 SELECT léger par requête layout
 * (déjà memoized par React `cache()` côté getCurrentUser).
 */
export async function TrialBannerLoader() {
  const { supabase, orgId } = await getCurrentUser()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier, status, trial_ends_at, is_in_trial')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!sub?.is_in_trial || !sub.trial_ends_at) return null

  const tier = KOVAS_TIERS.find((t) => t.id === sub.tier)
  if (!tier) return null

  return (
    <TrialBanner
      trialEndsAt={sub.trial_ends_at}
      monthlyPriceCents={tier.priceMonthlyCents}
      tierLabel={tier.label}
    />
  )
}
