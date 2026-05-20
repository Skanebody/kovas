/**
 * /api/pricing/travel-fees
 *
 * GET  → renvoie pricing_config.travelFees du user.
 * PUT  → update partiel des frais de déplacement (merge dans jsonb).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type { TravelFeesConfig } from '@/lib/pricing/pricing-templates'
import { NextResponse } from 'next/server'

interface SelectQuery {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      maybeSingle: () => Promise<{
        data: { pricing_config: { travelFees?: TravelFeesConfig } | null } | null
        error: { message: string } | null
      }>
    }
  }
}

interface UpdateQuery {
  update: (row: Record<string, unknown>) => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
}

interface UpsertQuery {
  upsert: (
    row: Record<string, unknown>,
    opts: { onConflict: string },
  ) => Promise<{ error: { message: string } | null }>
}

export async function GET() {
  const { user, supabase } = await getCurrentUser()
  const selectQuery = supabase.from('user_pricing_config') as unknown as SelectQuery
  const { data, error } = await selectQuery
    .select('pricing_config')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(
    { travelFees: data?.pricing_config?.travelFees ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

interface PutBody {
  includedRadiusKm?: unknown
  pricePerKmBeyond?: unknown
  capAmount?: unknown
}

export async function PUT(request: Request) {
  const { user, orgId, supabase } = await getCurrentUser()
  const body = (await request.json().catch(() => ({}))) as PutBody

  // Charge config courante
  const selectQuery = supabase.from('user_pricing_config') as unknown as SelectQuery
  const { data: existing } = await selectQuery
    .select('pricing_config')
    .eq('user_id', user.id)
    .maybeSingle()

  const current = (existing?.pricing_config ?? {}) as { travelFees?: TravelFeesConfig }
  const currentTravel: TravelFeesConfig = current.travelFees ?? {
    includedRadiusKm: 0,
    pricePerKmBeyond: 0,
    capAmount: 0,
  }

  const merged: TravelFeesConfig = {
    includedRadiusKm:
      typeof body.includedRadiusKm === 'number' && Number.isFinite(body.includedRadiusKm)
        ? body.includedRadiusKm
        : currentTravel.includedRadiusKm,
    pricePerKmBeyond:
      typeof body.pricePerKmBeyond === 'number' && Number.isFinite(body.pricePerKmBeyond)
        ? body.pricePerKmBeyond
        : currentTravel.pricePerKmBeyond,
    capAmount:
      typeof body.capAmount === 'number' && Number.isFinite(body.capAmount)
        ? body.capAmount
        : currentTravel.capAmount,
  }

  if (merged.includedRadiusKm < 0 || merged.pricePerKmBeyond < 0 || merged.capAmount < 0) {
    return NextResponse.json({ error: 'valeurs négatives interdites' }, { status: 400 })
  }

  const newConfig = { ...current, travelFees: merged }

  if (existing) {
    const updateQuery = supabase.from('user_pricing_config') as unknown as UpdateQuery
    const { error } = await updateQuery.update({ pricing_config: newConfig }).eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const upsertQuery = supabase.from('user_pricing_config') as unknown as UpsertQuery
    const { error } = await upsertQuery.upsert(
      {
        user_id: user.id,
        organization_id: orgId,
        pricing_config: newConfig,
        has_configured: true,
      },
      { onConflict: 'user_id' },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, travelFees: merged })
}
