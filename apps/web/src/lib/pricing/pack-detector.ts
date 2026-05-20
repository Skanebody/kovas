/**
 * KOVAS — Détection automatique d'un pack applicable (Partition B).
 *
 * Règle : un pack matche si la liste `diagnostics` est EXACTEMENT égale
 * (ensemble) à `selectedDiagnostics`. Si plusieurs packs matchent, on prend
 * le moins cher (best-for-client).
 *
 * Note : on utilise `SupabaseClient` minimal typing — la table `user_pricing_packs`
 * n'est pas encore dans les types générés du paquet `@kovas/database`.
 */

import type { PricingDiagnosticType } from './pricing-templates'

export interface ApplicablePack {
  packId: string
  packName: string
  packPriceHt: number
  packPriceTtc: number
  savingsVsItemized: number
  savingsPercent: number
}

interface PackRow {
  id: string
  name: string
  diagnostics: string[]
  price_ht: number
  is_active: boolean
}

interface PackQueryResult {
  data: PackRow[] | null
  error: { message: string } | null
}

interface MinimalSupabase {
  from: (table: string) => unknown
}

export async function detectApplicablePack(
  userId: string,
  selectedDiagnostics: PricingDiagnosticType[],
  itemizedSubtotalHt: number,
  totalTtcFactor: number,
  supabase: MinimalSupabase,
): Promise<ApplicablePack | undefined> {
  // Cast minimal — la table n'est pas dans le type Database généré.
  const query = supabase.from('user_pricing_packs') as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        eq: (col: string, val: boolean) => Promise<PackQueryResult>
      }
    }
  }

  const { data, error } = await query
    .select('id, name, diagnostics, price_ht, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error || !data || data.length === 0) {
    return undefined
  }

  const selectedSet = new Set(selectedDiagnostics)
  const matches = data.filter((pack) => {
    if (!Array.isArray(pack.diagnostics) || pack.diagnostics.length !== selectedSet.size) {
      return false
    }
    // Egalité d'ensembles (case-sensitive — diagnostics tous en MAJUSCULES).
    return pack.diagnostics.every((d) => selectedSet.has(d as PricingDiagnosticType))
  })

  if (matches.length === 0) {
    return undefined
  }

  // Sélection du pack le moins cher (best-for-client).
  const best = matches.reduce((min, cur) => (cur.price_ht < min.price_ht ? cur : min), matches[0])

  const packPriceHt = round2(Number(best.price_ht))
  const savingsVsItemized = round2(Math.max(0, itemizedSubtotalHt - packPriceHt))
  const savingsPercent =
    itemizedSubtotalHt > 0 ? round2((savingsVsItemized / itemizedSubtotalHt) * 100) : 0

  return {
    packId: best.id,
    packName: best.name,
    packPriceHt,
    packPriceTtc: round2(packPriceHt * totalTtcFactor),
    savingsVsItemized,
    savingsPercent,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
