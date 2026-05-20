/**
 * POST /api/pricing/detect-pack
 *
 * Body : `{ diagnostics: PricingDiagnosticType[], propertyType?, surface? }`
 *
 * Pour un set de diagnostics donné, détecte le pack le moins cher applicable
 * (correspondance EXACTE des diagnostics). Utilise les prix unitaires du user
 * pour calculer le itemized subtotal de référence.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { detectApplicablePack } from '@/lib/pricing/pack-detector'
import {
  type DiagnosticPricing,
  type PricingDiagnosticType,
  type PropertyType,
  getModulationForProperty,
} from '@/lib/pricing/pricing-templates'
import { NextResponse } from 'next/server'

const VALID_DIAGNOSTICS: PricingDiagnosticType[] = [
  'DPE',
  'AMIANTE',
  'PLOMB',
  'GAZ',
  'ELEC',
  'TERMITES',
  'CARREZ',
  'BOUTIN',
  'ERP',
]

const VALID_PROPERTY_TYPES: PropertyType[] = ['studio', 'appartement', 'maison', 'local']

interface ConfigRow {
  vat_status: 'with_vat' | 'franchise_vat'
  vat_rate: number
  has_configured: boolean
  pricing_config: { diagnostics?: Partial<Record<PricingDiagnosticType, DiagnosticPricing>> } | null
}

interface SelectQuery {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      maybeSingle: () => Promise<{ data: ConfigRow | null; error: { message: string } | null }>
    }
  }
}

interface BodyInput {
  diagnostics?: unknown
  propertyType?: unknown
  surface?: unknown
}

export async function POST(request: Request) {
  const { user, supabase } = await getCurrentUser()
  const body = (await request.json().catch(() => ({}))) as BodyInput

  if (!Array.isArray(body.diagnostics) || body.diagnostics.length === 0) {
    return NextResponse.json({ error: 'diagnostics requis (array non vide)' }, { status: 400 })
  }
  const diagnostics: PricingDiagnosticType[] = []
  for (const d of body.diagnostics) {
    if (typeof d !== 'string' || !VALID_DIAGNOSTICS.includes(d as PricingDiagnosticType)) {
      return NextResponse.json({ error: `diagnostic invalide: ${String(d)}` }, { status: 400 })
    }
    diagnostics.push(d as PricingDiagnosticType)
  }

  const propertyType: PropertyType =
    typeof body.propertyType === 'string' &&
    VALID_PROPERTY_TYPES.includes(body.propertyType as PropertyType)
      ? (body.propertyType as PropertyType)
      : 'appartement'

  const surface =
    typeof body.surface === 'number' && Number.isFinite(body.surface) && body.surface > 0
      ? body.surface
      : 60

  // Charge config pour calculer le itemized subtotal de référence
  const selectQuery = supabase.from('user_pricing_config') as unknown as SelectQuery
  const { data: config } = await selectQuery
    .select('vat_status, vat_rate, has_configured, pricing_config')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!config || !config.has_configured) {
    return NextResponse.json({ pack: null, reason: 'pricing_not_configured' })
  }

  const diagnosticsCfg = config.pricing_config?.diagnostics ?? {}
  let itemizedSubtotalHt = 0
  for (const d of diagnostics) {
    const pricing = diagnosticsCfg[d]
    if (!pricing) continue
    const modulation = getModulationForProperty(pricing.modulations, propertyType, surface)
    itemizedSubtotalHt += pricing.basePrice * modulation
  }
  itemizedSubtotalHt = Math.round(itemizedSubtotalHt * 100) / 100

  const ttcFactor = config.vat_status === 'franchise_vat' ? 1 : 1 + Number(config.vat_rate)
  const pack = await detectApplicablePack(
    user.id,
    diagnostics,
    itemizedSubtotalHt,
    ttcFactor,
    supabase,
  )

  return NextResponse.json({ pack: pack ?? null, itemizedSubtotalHt })
}
