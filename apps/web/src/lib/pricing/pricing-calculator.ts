/**
 * KOVAS — Calculateur de prix indicatif (Partition B).
 *
 * Orchestration des sous-calculs :
 *   1. Charge la config tarifaire user (`user_pricing_config`)
 *   2. Si `has_configured = false` → retourne `hasPricingConfigured: false`
 *   3. Calcule les prix itemized (basePrice × modulation par diagnostic)
 *   4. Détecte un pack applicable (substitution si matchant)
 *   5. Ajoute frais de déplacement
 *   6. Ajoute majorations (urgence / weekend / soirée)
 *   7. Applique TVA (franchise ou 20%)
 *
 * Important :
 * - Ce module ne fait QUE du calcul indicatif (jamais facture/devis).
 * - Aucune mutation DB ici — seulement SELECT.
 */

import { type Majoration, calculateMajorations } from './majorations-calculator'
import { type ApplicablePack, detectApplicablePack } from './pack-detector'
import {
  type DiagnosticPricing,
  type MajorationsConfig,
  type PricingDiagnosticType,
  type PropertyType,
  type TravelFeesConfig,
  getModulationForProperty,
} from './pricing-templates'
import { calculateTravelFees } from './travel-fees-calculator'
import { type VatStatus, calculateVat } from './vat-calculator'

export type PricingDisplayMode = 'ht_and_ttc' | 'ttc_only' | 'ht_only'

export interface PricingEstimateInput {
  userId: string
  diagnostics: PricingDiagnosticType[]
  propertyType: PropertyType
  surface: number
  travelDistanceKm?: number
  isUrgent?: boolean
  isWeekend?: boolean
  isEvening?: boolean
}

export interface PriceLineItem {
  diagnostic: PricingDiagnosticType
  basePrice: number
  appliedModulation: number
  priceHt: number
}

export interface PricingEstimate {
  hasPricingConfigured: boolean
  itemizedPrices: PriceLineItem[]
  itemizedSubtotalHt: number
  itemizedSubtotalTtc: number
  applicablePack?: ApplicablePack
  travelFeesHt: number
  travelFeesDescription: string
  majorationsHt: number
  majorationsDetails: Majoration[]
  totalHt: number
  totalTva: number
  totalTtc: number
  vatApplicable: boolean
  vatRate: number
  vatNote?: string
  displayMode: PricingDisplayMode
}

interface PricingConfigJson {
  diagnostics?: Partial<Record<PricingDiagnosticType, DiagnosticPricing>>
  travelFees?: TravelFeesConfig
  majorations?: MajorationsConfig
}

interface PricingConfigRow {
  user_id: string
  vat_status: VatStatus
  vat_rate: number
  display_mode: PricingDisplayMode
  has_configured: boolean
  pricing_config: PricingConfigJson | null
}

interface ConfigQueryResult {
  data: PricingConfigRow | null
  error: { message: string } | null
}

interface MinimalSupabase {
  from: (table: string) => unknown
}

const EMPTY_ESTIMATE_TEMPLATE: Pick<
  PricingEstimate,
  | 'itemizedPrices'
  | 'itemizedSubtotalHt'
  | 'itemizedSubtotalTtc'
  | 'travelFeesHt'
  | 'travelFeesDescription'
  | 'majorationsHt'
  | 'majorationsDetails'
  | 'totalHt'
  | 'totalTva'
  | 'totalTtc'
  | 'vatApplicable'
  | 'vatRate'
> = {
  itemizedPrices: [],
  itemizedSubtotalHt: 0,
  itemizedSubtotalTtc: 0,
  travelFeesHt: 0,
  travelFeesDescription: '',
  majorationsHt: 0,
  majorationsDetails: [],
  totalHt: 0,
  totalTva: 0,
  totalTtc: 0,
  vatApplicable: false,
  vatRate: 0,
}

export async function estimatePricing(
  input: PricingEstimateInput,
  supabase: MinimalSupabase,
): Promise<PricingEstimate> {
  // ============================================
  // 1. Charge config user
  // ============================================
  const configQuery = supabase.from('user_pricing_config') as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<ConfigQueryResult>
      }
    }
  }

  const { data: config, error } = await configQuery
    .select('user_id, vat_status, vat_rate, display_mode, has_configured, pricing_config')
    .eq('user_id', input.userId)
    .maybeSingle()

  if (error || !config || !config.has_configured) {
    return {
      hasPricingConfigured: false,
      displayMode: 'ht_and_ttc',
      ...EMPTY_ESTIMATE_TEMPLATE,
    }
  }

  // ============================================
  // 2. Décomposition de la config jsonb
  // ============================================
  const cfg = config.pricing_config ?? {}
  const diagnosticsCfg = cfg.diagnostics ?? {}
  const travelFeesCfg: TravelFeesConfig = cfg.travelFees ?? {
    includedRadiusKm: 0,
    pricePerKmBeyond: 0,
    capAmount: 0,
  }
  const majorationsCfg: MajorationsConfig = cfg.majorations ?? {
    urgency48h: 0,
    weekend: 0,
    evening: 0,
  }

  // ============================================
  // 3. Itemized prices
  // ============================================
  const itemizedPrices: PriceLineItem[] = input.diagnostics.map((diagnostic) => {
    const pricing = diagnosticsCfg[diagnostic]
    if (!pricing) {
      // Diagnostic non configuré → 0 (pas d'erreur, on dégrade gracieusement)
      return { diagnostic, basePrice: 0, appliedModulation: 1, priceHt: 0 }
    }
    const modulation = getModulationForProperty(
      pricing.modulations,
      input.propertyType,
      input.surface,
    )
    const priceHt = round2(pricing.basePrice * modulation)
    return {
      diagnostic,
      basePrice: pricing.basePrice,
      appliedModulation: modulation,
      priceHt,
    }
  })

  const itemizedSubtotalHt = round2(itemizedPrices.reduce((sum, line) => sum + line.priceHt, 0))

  // Pré-calcul TVA factor pour pack detector (besoin du TTC du pack)
  const ttcFactor = config.vat_status === 'franchise_vat' ? 1 : 1 + Number(config.vat_rate)
  const itemizedSubtotalTtc = round2(
    config.vat_status === 'franchise_vat' ? itemizedSubtotalHt : itemizedSubtotalHt * ttcFactor,
  )

  // ============================================
  // 4. Pack detection
  // ============================================
  const applicablePack = await detectApplicablePack(
    input.userId,
    input.diagnostics,
    itemizedSubtotalHt,
    ttcFactor,
    supabase,
  )

  // ============================================
  // 5. Travel fees
  // ============================================
  const distance = input.travelDistanceKm ?? 0
  const travel = calculateTravelFees(travelFeesCfg, distance)

  // ============================================
  // 6. Majorations
  // ============================================
  const majo = calculateMajorations(majorationsCfg, {
    isUrgent: input.isUrgent ?? false,
    isWeekend: input.isWeekend ?? false,
    isEvening: input.isEvening ?? false,
  })

  // ============================================
  // 7. Totaux + TVA
  // ============================================
  const baseHt = applicablePack ? applicablePack.packPriceHt : itemizedSubtotalHt
  const totalHt = round2(baseHt + travel.amountHt + majo.totalAmountHt)

  const vat = calculateVat(totalHt, config.vat_status, Number(config.vat_rate))

  return {
    hasPricingConfigured: true,
    itemizedPrices,
    itemizedSubtotalHt,
    itemizedSubtotalTtc,
    applicablePack,
    travelFeesHt: travel.amountHt,
    travelFeesDescription: travel.description,
    majorationsHt: majo.totalAmountHt,
    majorationsDetails: majo.details,
    totalHt,
    totalTva: vat.vatAmount,
    totalTtc: vat.totalTtc,
    vatApplicable: vat.vatApplicable,
    vatRate: vat.vatRate,
    vatNote: vat.vatNote,
    displayMode: config.display_mode,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
