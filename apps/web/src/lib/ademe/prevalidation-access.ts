/**
 * KOVAS — Accès au DÉTAIL de la pré-validation ADEME (modèle freemium).
 *
 * Décision Benjamin (2026-05-29) : la pré-validation est PAYANTE en freemium.
 *  - Verdict global (vert / orange / rouge + score) → GRATUIT pour tous.
 *  - Détail des corrections (liste des points + fix suggérés) → PAYANT.
 *
 * Le détail est débloqué si :
 *  - l'add-on « Pack Conformité » (`addon_conformite_avancee`) est actif, OU
 *  - le plan inclut le cockpit ADEME avancé (`cockpit_ademe_mode2` : Cabinet /
 *    all_inclusive) — ces tiers l'ont déjà compris dans leur offre.
 */

import { planHasFeature } from '@/lib/billing/feature-gates'
import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Code de l'add-on payant qui débloque le détail (cf. pricing-plans ADDON_MODULES). */
export const PREVALIDATION_DETAIL_ADDON = 'addon_conformite_avancee'

interface AddonJoinRow {
  status: string
  addon_modules: { module_code: string } | { module_code: string }[] | null
}

/**
 * Renvoie `true` si l'organisation a accès au détail des corrections.
 * Sinon, l'UI n'affiche que le verdict global + un CTA pour débloquer.
 */
export async function hasPrevalidationDetailAccess(
  supabase: SupabaseClient<Database>,
  orgId: string,
  planCode: string | null | undefined,
): Promise<boolean> {
  // Plan haut de gamme (Cabinet / all_inclusive) → inclus.
  if (planHasFeature(planCode, 'cockpit_ademe_mode2')) return true

  // Sinon : add-on payant actif ?
  const { data } = await supabase
    .from('user_addons')
    .select('status, addon_modules!inner(module_code)')
    .eq('organization_id', orgId)
    .in('status', ['active', 'trialing'])

  const rows = (data ?? []) as unknown as AddonJoinRow[]
  return rows.some((row) => {
    const mod = row.addon_modules
    const code = Array.isArray(mod) ? mod[0]?.module_code : mod?.module_code
    return code === PREVALIDATION_DETAIL_ADDON
  })
}
