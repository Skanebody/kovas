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

import {
  ADDON_PACKS,
  type AddonCode,
  type AddonPackCode,
  type PricingPlanCode,
  resolveTierToPlanCode,
} from '@/lib/pricing-plans'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cache } from 'react'
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

const PACK_CODE_SET = new Set<string>(ADDON_PACKS.map((p) => p.code))

/**
 * Normalise un tier brut (DB) vers le code PricingPlanCode canonique.
 * Délègue au helper centralisé `resolveTierToPlanCode()` de pricing-plans.ts
 * (cf. §6bis). Toute évolution de la grille tarifaire doit être faite là.
 */
function normalizePlanCode(raw: string | null | undefined): PricingPlanCode | null {
  return resolveTierToPlanCode(raw)
}

/**
 * Charge l'UserAccess depuis Supabase pour l'org du user.
 *
 * `userId` + `orgId` doivent venir de getCurrentUser() côté caller.
 */
export const loadUserAccess = cache(
  async (supabase: SupabaseClient, orgId: string | null | undefined): Promise<UserAccess> => {
    if (!orgId) {
      return { planCode: null, activeAddons: [], activePacks: [] }
    }

    const sb = supabase as unknown as {
      from(table: 'subscriptions'): {
        select(columns: string): {
          eq(
            col: string,
            val: string,
          ): {
            maybeSingle(): Promise<{ data: SubscriptionRow | null }>
          }
        }
      }
    }

    const sbAddons = supabase as unknown as {
      from(table: 'user_addons'): {
        select(columns: string): {
          eq(
            col: string,
            val: string,
          ): {
            in(
              col: string,
              vals: readonly string[],
            ): Promise<{
              data: Array<{
                status: string
                addon_modules: { module_code: string } | null
              }> | null
            }>
          }
        }
      }
    }

    // La colonne `plan_code` n'existe pas encore dans toutes les DBs (introduite
    // par la migration Phase B). On tente d'abord avec, et si la requête échoue
    // on retombe sur `tier` seul (legacy). Sans ce fallback, la requête entière
    // renvoie null → planCode null → sidebar tombe en mode "free".
    const trySelect = async (columns: string) =>
      sb.from('subscriptions').select(columns).eq('organization_id', orgId).maybeSingle()

    let subData: SubscriptionRow | null = null
    const subWithPlanCode = await trySelect('plan_code, tier')
    if (subWithPlanCode.data) {
      subData = subWithPlanCode.data
    } else {
      const subTierOnly = await trySelect('tier')
      subData = subTierOnly.data
        ? ({ tier: subTierOnly.data.tier ?? null, plan_code: null } as SubscriptionRow)
        : null
    }

    const addonsRes = await sbAddons
      .from('user_addons')
      .select('status, addon_modules!inner(module_code)')
      .eq('organization_id', orgId)
      .in('status', ['active', 'trialing'])

    const planCode = normalizePlanCode(subData?.plan_code) ?? normalizePlanCode(subData?.tier)

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
  async (supabase: SupabaseClient, userId: string): Promise<PendingSuggestionRow[]> => {
    const sb = supabase as unknown as {
      from(table: 'upsell_suggestions'): {
        select(columns: string): {
          eq(
            col: string,
            val: string,
          ): {
            eq(
              col: string,
              val: string,
            ): {
              order(
                col: string,
                opts: { ascending: boolean },
              ): {
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
