/**
 * POST /api/pricing/estimate
 *
 * Calcule un prix indicatif. userId pris depuis l'auth, body :
 * `{ diagnostics, propertyType, surface, travelDistanceKm?, isUrgent?, isWeekend?, isEvening? }`
 *
 * Si la config tarifaire n'est pas initialisée → retourne `{ hasPricingConfigured: false }`.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { type PricingEstimateInput, estimatePricing } from '@/lib/pricing/pricing-calculator'
import type { PricingDiagnosticType, PropertyType } from '@/lib/pricing/pricing-templates'
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

interface BodyInput {
  diagnostics?: unknown
  propertyType?: unknown
  surface?: unknown
  travelDistanceKm?: unknown
  isUrgent?: unknown
  isWeekend?: unknown
  isEvening?: unknown
}

export async function POST(request: Request) {
  const { user, supabase } = await getCurrentUser()
  const body = (await request.json().catch(() => ({}))) as BodyInput

  // Validation diagnostics
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

  // Validation propertyType
  if (
    typeof body.propertyType !== 'string' ||
    !VALID_PROPERTY_TYPES.includes(body.propertyType as PropertyType)
  ) {
    return NextResponse.json({ error: 'propertyType invalide' }, { status: 400 })
  }
  const propertyType = body.propertyType as PropertyType

  // Validation surface
  if (typeof body.surface !== 'number' || !Number.isFinite(body.surface) || body.surface <= 0) {
    return NextResponse.json({ error: 'surface invalide (> 0)' }, { status: 400 })
  }

  const input: PricingEstimateInput = {
    userId: user.id,
    diagnostics,
    propertyType,
    surface: body.surface,
    travelDistanceKm:
      typeof body.travelDistanceKm === 'number' && Number.isFinite(body.travelDistanceKm)
        ? body.travelDistanceKm
        : undefined,
    isUrgent: body.isUrgent === true,
    isWeekend: body.isWeekend === true,
    isEvening: body.isEvening === true,
  }

  const estimate = await estimatePricing(input, supabase)
  return NextResponse.json(estimate, { headers: { 'Cache-Control': 'no-store' } })
}
