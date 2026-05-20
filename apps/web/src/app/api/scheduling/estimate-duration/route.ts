/**
 * POST /api/scheduling/estimate-duration
 *
 * Body : MissionParameters (sans userId — récupéré depuis auth.users)
 * Return : DurationEstimate
 *
 * Authority : briefing scheduling 2026-05-20.
 */

import { DIAGNOSTIC_TYPES, type DiagnosticType } from '@/lib/mission/types'
import { type MissionParameters, estimateDuration } from '@/lib/scheduling/duration-estimator'
import {
  COPRO_COEFFICIENTS,
  PROPERTY_TYPE_COEFFICIENTS,
  type SchedulingOwnership,
  type SchedulingPropertyType,
} from '@/lib/scheduling/duration-schemas'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const PROPERTY_TYPES = Object.keys(PROPERTY_TYPE_COEFFICIENTS) as SchedulingPropertyType[]
const OWNERSHIP_TYPES = Object.keys(COPRO_COEFFICIENTS) as SchedulingOwnership[]

interface EstimateRequestBody {
  diagnostics?: unknown
  surface?: unknown
  propertyType?: unknown
  ownership?: unknown
  hasGarage?: unknown
  hasSousSol?: unknown
  hasComblesAmenagees?: unknown
}

function isDiagnosticType(v: unknown): v is DiagnosticType {
  return typeof v === 'string' && (DIAGNOSTIC_TYPES as readonly string[]).includes(v)
}

function isSchedulingPropertyType(v: unknown): v is SchedulingPropertyType {
  return typeof v === 'string' && (PROPERTY_TYPES as readonly string[]).includes(v)
}

function isSchedulingOwnership(v: unknown): v is SchedulingOwnership {
  return typeof v === 'string' && (OWNERSHIP_TYPES as readonly string[]).includes(v)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: EstimateRequestBody
  try {
    body = (await request.json()) as EstimateRequestBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  // Validation
  if (!Array.isArray(body.diagnostics) || body.diagnostics.length === 0) {
    return NextResponse.json({ error: 'diagnostics must be a non-empty array' }, { status: 400 })
  }
  const diagnostics = body.diagnostics.filter(isDiagnosticType)
  if (diagnostics.length === 0) {
    return NextResponse.json({ error: 'no valid diagnostic type in diagnostics' }, { status: 400 })
  }

  if (typeof body.surface !== 'number' || body.surface <= 0 || body.surface > 10_000) {
    return NextResponse.json(
      { error: 'surface must be a positive number ≤ 10000' },
      { status: 400 },
    )
  }

  if (!isSchedulingPropertyType(body.propertyType)) {
    return NextResponse.json(
      { error: `propertyType must be one of: ${PROPERTY_TYPES.join(', ')}` },
      { status: 400 },
    )
  }

  if (!isSchedulingOwnership(body.ownership)) {
    return NextResponse.json(
      { error: `ownership must be one of: ${OWNERSHIP_TYPES.join(', ')}` },
      { status: 400 },
    )
  }

  const params: MissionParameters = {
    diagnostics,
    surface: body.surface,
    propertyType: body.propertyType,
    ownership: body.ownership,
    hasGarage: body.hasGarage === true,
    hasSousSol: body.hasSousSol === true,
    hasComblesAmenagees: body.hasComblesAmenagees === true,
    userId: user.id,
  }

  try {
    const estimate = await estimateDuration(params, supabase)
    return NextResponse.json(estimate)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
