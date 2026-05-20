/**
 * KOVAS — POST /api/utilities/diagnostic-requirements
 *
 * Calcule la liste des diagnostics obligatoires pour un bien.
 * Track l'usage en arrière-plan (utilities_usage).
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'
import {
  type EnergyClass,
  type OwnershipType,
  type PropertyType,
  type RequirementsInput,
  type RequirementsResult,
  type TransactionType,
  calculateRequiredDiagnostics,
} from '@/lib/utilities/diagnostic-requirements-calculator'
import { trackUtilityUsage } from '@/lib/utilities/usage-tracker'

export const runtime = 'nodejs'

interface ErrorBody {
  error: string
}

const PROPERTY_TYPES: readonly PropertyType[] = ['house', 'apartment', 'commercial', 'other']
const OWNERSHIP: readonly OwnershipType[] = ['single', 'copropriete']
const TRANSACTION: readonly TransactionType[] = ['sale', 'rental']
const ENERGY_CLASSES: readonly NonNullable<EnergyClass>[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

function parseInput(body: unknown): RequirementsInput | string {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object'
  const b = body as Record<string, unknown>

  const constructionYear = b.constructionYear
  if (typeof constructionYear !== 'number' || !Number.isFinite(constructionYear)) {
    return 'constructionYear: number required'
  }
  if (constructionYear < 1700 || constructionYear > new Date().getUTCFullYear() + 1) {
    return 'constructionYear out of range'
  }

  const propertyType = b.propertyType
  if (typeof propertyType !== 'string' || !PROPERTY_TYPES.includes(propertyType as PropertyType)) {
    return `propertyType must be one of ${PROPERTY_TYPES.join('|')}`
  }

  const ownership = b.ownership
  if (typeof ownership !== 'string' || !OWNERSHIP.includes(ownership as OwnershipType)) {
    return `ownership must be one of ${OWNERSHIP.join('|')}`
  }

  const transactionType = b.transactionType
  if (
    typeof transactionType !== 'string' ||
    !TRANSACTION.includes(transactionType as TransactionType)
  ) {
    return `transactionType must be one of ${TRANSACTION.join('|')}`
  }

  const postalCode = b.postalCode
  if (typeof postalCode !== 'string' || !/^\d{5}$/.test(postalCode)) {
    return 'postalCode must be a 5-digit French postal code'
  }

  const hasGas = typeof b.hasGas === 'boolean' ? b.hasGas : false
  const hasElectricity15Plus =
    typeof b.hasElectricity15Plus === 'boolean' ? b.hasElectricity15Plus : false

  let knownEnergyClass: EnergyClass = null
  if (typeof b.knownEnergyClass === 'string') {
    if (ENERGY_CLASSES.includes(b.knownEnergyClass as NonNullable<EnergyClass>)) {
      knownEnergyClass = b.knownEnergyClass as EnergyClass
    } else if (b.knownEnergyClass !== '') {
      return 'knownEnergyClass must be A-G'
    }
  }

  return {
    constructionYear,
    propertyType: propertyType as PropertyType,
    ownership: ownership as OwnershipType,
    transactionType: transactionType as TransactionType,
    postalCode,
    hasGas,
    hasElectricity15Plus,
    knownEnergyClass,
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse<RequirementsResult | ErrorBody>> {
  let user: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    user = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let bodyJson: unknown
  try {
    bodyJson = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const parsed = parseInput(bodyJson)
  if (typeof parsed === 'string') {
    return NextResponse.json({ error: parsed }, { status: 400 })
  }

  const result = calculateRequiredDiagnostics(parsed)

  trackUtilityUsage({
    supabase: user.supabase,
    userId: user.user.id,
    organizationId: user.orgId,
    utility: 'diagnostic_requirements',
    context: {
      constructionYear: parsed.constructionYear,
      propertyType: parsed.propertyType,
      transactionType: parsed.transactionType,
      department: parsed.postalCode.slice(0, 2),
      requiredCount: result.required.length,
    },
  })

  return NextResponse.json(result)
}
