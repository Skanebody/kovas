'use server'

/**
 * KOVAS — Server actions pour l'upsell intelligent (L1).
 *
 * Trois actions :
 *   - startTrialAction(target)   → démarre un essai 14j sur un addon/pack
 *   - dismissSuggestionAction(id) → user clique "Plus tard"
 *   - markSuggestionShownAction(id) → affichage in-app (drawer/modal)
 *
 * Les conversions remontent dans upsell_suggestions.status = 'converted'.
 */

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  type AddonCode,
  type AddonPackCode,
  type PricingPlanCode,
  ADDON_MODULES,
  ADDON_PACKS,
  PRICING_PLANS,
} from '@/lib/pricing-plans'
import { trackBehaviorEvent } from './track-event'

export interface UpsellActionResult {
  success?: true
  error?: string
  redirectTo?: string
}

const ADDON_CODE_SET = new Set<string>(ADDON_MODULES.map((a) => a.code))
const PACK_CODE_SET = new Set<string>(ADDON_PACKS.map((p) => p.code))
const PLAN_CODE_SET = new Set<string>(PRICING_PLANS.map((p) => p.code))

function classifyTarget(
  target: string,
): { kind: 'addon'; code: AddonCode } | { kind: 'pack'; code: AddonPackCode } | { kind: 'tier_upgrade'; code: PricingPlanCode } | null {
  if (ADDON_CODE_SET.has(target)) return { kind: 'addon', code: target as AddonCode }
  if (PACK_CODE_SET.has(target)) return { kind: 'pack', code: target as AddonPackCode }
  if (PLAN_CODE_SET.has(target)) return { kind: 'tier_upgrade', code: target as PricingPlanCode }
  return null
}

/**
 * Démarre un essai 14 jours sur un add-on ou un pack. Pour un upgrade tier,
 * on redirige vers /pricing/checkout (pas d'essai 14j sur les tiers, c'est
 * un changement d'abonnement payant).
 */
export async function startTrialAction(target: string, trigger?: string): Promise<UpsellActionResult> {
  if (!target || typeof target !== 'string' || target.length > 60) {
    return { error: 'Cible invalide' }
  }

  const classification = classifyTarget(target)
  if (!classification) {
    return { error: 'Cible inconnue' }
  }

  const { supabase, user, orgId } = await getCurrentUser()

  // Upgrade tier : redirect checkout
  if (classification.kind === 'tier_upgrade') {
    await markAsConverted(supabase, user.id, target)
    await trackBehaviorEvent(supabase, user.id, 'mission_created', {
      organizationId: orgId,
      eventData: { trigger: trigger ?? 'upsell_action', target },
    }).catch(() => undefined)
    return {
      success: true,
      redirectTo: `/pricing/checkout?plan=${encodeURIComponent(classification.code)}`,
    }
  }

  // Essai 14j sur addon ou pack
  const { data: subRow } = (await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('organization_id', orgId)
    .maybeSingle()) as { data: { id: string; status: string } | null }

  if (!subRow || !['trialing', 'active', 'past_due'].includes(subRow.status)) {
    return {
      error:
        'Aucun abonnement actif. Souscrivez à un forfait avant de démarrer un essai module.',
    }
  }

  // Récupère l'addon_modules.id depuis module_code
  const sb = supabase as unknown as {
    from(t: 'addon_modules'): {
      select(cols: string): {
        eq(col: string, val: string): {
          maybeSingle(): Promise<{ data: { id: string } | null }>
        }
      }
    }
  }
  const { data: moduleRow } = await sb
    .from('addon_modules')
    .select('id')
    .eq('module_code', target)
    .maybeSingle()

  if (!moduleRow) {
    return { error: 'Module inconnu' }
  }

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const sbTrials = supabase as unknown as {
    from(t: 'module_trials'): {
      insert(rows: Record<string, unknown>): Promise<{
        error: { code?: string; message: string } | null
      }>
    }
  }

  const { error: insertError } = await sbTrials.from('module_trials').insert({
    organization_id: orgId,
    user_id: user.id,
    module_id: moduleRow.id,
    subscription_id: subRow.id,
    trial_ends_at: trialEndsAt,
    trial_duration_days: 14,
    status: 'active',
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return { error: 'Un essai est déjà en cours sur ce module' }
    }
    if (
      insertError.code === '42P01' ||
      insertError.message?.includes('does not exist')
    ) {
      return {
        error: "Essais module indisponibles — fonctionnalité bientôt activée.",
      }
    }
    return { error: insertError.message }
  }

  await markAsConverted(supabase, user.id, target)

  revalidatePath('/app/account')
  revalidatePath('/app/dashboard')
  return { success: true }
}

/**
 * Marque une suggestion comme dismissed ("Plus tard").
 */
export async function dismissSuggestionAction(suggestionId: string): Promise<UpsellActionResult> {
  if (!suggestionId) return { error: 'Suggestion invalide' }
  const { supabase, user } = await getCurrentUser()
  const sb = supabase as unknown as {
    from(t: 'upsell_suggestions'): {
      update(rows: Record<string, unknown>): {
        eq(c: string, v: string): {
          eq(c: string, v: string): Promise<{ error: { message: string } | null }>
        }
      }
    }
  }
  const { error } = await sb
    .from('upsell_suggestions')
    .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
    .eq('id', suggestionId)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  return { success: true }
}

/**
 * Marque une suggestion comme affichée in-app (drawer/modal ouverts).
 * Idempotent : passe de pending → shown_in_app, n'écrase pas converted/dismissed.
 */
export async function markSuggestionShownAction(suggestionId: string): Promise<UpsellActionResult> {
  if (!suggestionId) return { error: 'Suggestion invalide' }
  const { supabase, user } = await getCurrentUser()
  const sb = supabase as unknown as {
    from(t: 'upsell_suggestions'): {
      update(rows: Record<string, unknown>): {
        eq(c: string, v: string): {
          eq(c: string, v: string): {
            eq(c: string, v: string): Promise<{ error: { message: string } | null }>
          }
        }
      }
    }
  }
  const { error } = await sb
    .from('upsell_suggestions')
    .update({ status: 'shown_in_app', shown_in_app_at: new Date().toISOString() })
    .eq('id', suggestionId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
  if (error) return { error: error.message }
  return { success: true }
}

/**
 * Helper interne : passe toutes les suggestions pending d'un user pour une
 * target donnée en status='converted'.
 */
async function markAsConverted(
  supabase: unknown,
  userId: string,
  target: string,
): Promise<void> {
  const sb = supabase as {
    from(t: 'upsell_suggestions'): {
      update(rows: Record<string, unknown>): {
        eq(c: string, v: string): {
          eq(c: string, v: string): {
            in(c: string, v: readonly string[]): Promise<{ error: unknown }>
          }
        }
      }
    }
  }
  await sb
    .from('upsell_suggestions')
    .update({ status: 'converted', converted_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('suggested_target', target)
    .in('status', ['pending', 'shown_in_app', 'shown_email'])
}
