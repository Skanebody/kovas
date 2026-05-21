/**
 * KOVAS — Chargeur server-side de l'accès utilisateur et des suggestions
 * pending pour la sidebar et le DiscoverDrawer.
 *
 * Memoized par requête (React cache) → un seul fetch par layout/page.
 *
 * Sources consultées :
 *   - subscriptions.plan_code (puis fallback tier legacy)
 *   - user_addons (status active / trialing)
 *   - upsell_suggestions (status pending) limit 5 best priority
 */

import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type AddonCode,
  type AddonPackCode,
  type PricingPlanCode,
  ADDON_PACKS,
  PRICING_PLANS,
} from '@/lib/pricing-plans'
import type { UserAccess } from './access-control'

interface SubscriptionRow {
  plan_code: string | null
  tier: string | null
}

interface PendingSuggestionRow {
  id: string
  suggestion_type: 'addon' | 'pack' | 'tier_upgrade'
  suggested_target: string
  reason_label: string
  reason_benefit: string
  estimated_value_eur: number | null
  priority: number
  status: string
  created_at: string
}

const PLAN_CODE_SET = new Set<string>(PRICING_PLANS.map((p) => p.code))
const PACK_CODE_SET = new Set<string>(ADDON_PACKS.map((p) => p.code))

const LEGACY_TIER_TO_PLAN_CODE: Record<string, PricingPlanCode> = {
  decouverte: 'decouverte',
  standard: 'pro',
  volume: 'all_inclusive',
  founder: 'pro',
  decouverte_legacy: 'decouverte',
  standard_legacy: 'pro',
  volume_legacy: 'all_inclusive',
  founder_legacy: 'pro',
}

function normalizePlanCode(raw: string | null | undefined): PricingPlanCode | null {
  if (!raw) return null
  if (PLAN_CODE_SET.has(raw)) return raw as PricingPlanCode
  const legacy = LEGACY_TIER_TO_PLAN_CODE[raw]
  return legacy ?? null
}

/**
 * Charge l'UserAccess depuis Supabase pour l'org du user.
 *
 * `userId` + `orgId` doivent venir de getCurrentUser() côté caller.
 */
export const loadUserAccess = cache(
  async (
    supabase: SupabaseClient,
    orgId: string | null | undefined,
  ): Promise<UserAccess> => {
    if (!orgId) {
      return { planCode: null, activeAddons: [], activePacks: [] }
    }

    const sb = supabase as unknown as {
      from(table: 'subscriptions'): {
        select(columns: string): {
          eq(col: string, val: string): {
            maybeSingle(): Promise<{ data: SubscriptionRow | null }>
          }
        }
      }
    }

    const sbAddons = supabase as unknown as {
      from(table: 'user_addons'): {
        select(columns: string): {
          eq(col: string, val: string): {
            in(col: string, vals: readonly string[]): Promise<{ data: Array<{
              status: string
              addon_modules: { module_code: string } | null
            }> | null }>
          }
        }
      }
    }

    const [subRes, addonsRes] = await Promise.all([
      sb
        .from('subscriptions')
        .select('plan_code, tier')
        .eq('organization_id', orgId)
        .maybeSingle(),
      sbAddons
        .from('user_addons')
        .select('status, addon_modules!inner(module_code)')
        .eq('organization_id', orgId)
        .in('status', ['active', 'trialing']),
    ])

    const planCode =
      normalizePlanCode(subRes.data?.plan_code) ?? normalizePlanCode(subRes.data?.tier)

    const activeAddons: AddonCode[] = []
    const activePacks: AddonPackCode[] = []

    for (const row of addonsRes.data ?? []) {
      const code = row.addon_modules?.module_code
      if (!code) continue
      if (PACK_CODE_SET.has(code)) {
        activePacks.push(code as AddonPackCode)
      } else {
        activeAddons.push(code as AddonCode)
      }
    }

    return { planCode, activeAddons, activePacks }
  },
)

/**
 * Récupère les suggestions d'upsell pending (max 5) pour un user.
 * Triées par priority desc. Lecture authentifiée via RLS.
 */
export const loadPendingSuggestions = cache(
  async (
    supabase: SupabaseClient,
    userId: string,
  ): Promise<PendingSuggestionRow[]> => {
    const sb = supabase as unknown as {
      from(table: 'upsell_suggestions'): {
        select(columns: string): {
          eq(col: string, val: string): {
            eq(col: string, val: string): {
              order(col: string, opts: { ascending: boolean }): {
                limit(n: number): Promise<{ data: PendingSuggestionRow[] | null }>
              }
            }
          }
        }
      }
    }

    const res = await sb
      .from('upsell_suggestions')
      .select(
        'id, suggestion_type, suggested_target, reason_label, reason_benefit, estimated_value_eur, priority, status, created_at',
      )
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .limit(5)

    return res.data ?? []
  },
)

export type PendingUpsellSuggestion = PendingSuggestionRow
