/**
 * /api/pricing/majorations
 *
 * GET  → renvoie pricing_config.majorations du user.
 * PUT  → update partiel des majorations (urgency48h / weekend / evening),
 *        merge dans pricing_config jsonb.
 *
 * Suit le pattern travel-fees (jsonb partiel sur user_pricing_config).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type { MajorationsConfig } from '@/lib/pricing/pricing-templates'
import { NextResponse } from 'next/server'

interface SelectQuery {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      maybeSingle: () => Promise<{
        data: { pricing_config: { majorations?: MajorationsConfig } | null } | null
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
    { majorations: data?.pricing_config?.majorations ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

interface PutBody {
  urgency48h?: unknown
  weekend?: unknown
  evening?: unknown
}

export async function PUT(request: Request) {
  const { user, orgId, supabase } = await getCurrentUser()
  const body = (await request.json().catch(() => ({}))) as PutBody

  const selectQuery = supabase.from('user_pricing_config') as unknown as SelectQuery
  const { data: existing } = await selectQuery
    .select('pricing_config')
    .eq('user_id', user.id)
    .maybeSingle()

  const current = (existing?.pricing_config ?? {}) as { majorations?: MajorationsConfig }
  const currentMajo: MajorationsConfig = current.majorations ?? {
    urgency48h: 0,
    weekend: 0,
    evening: 0,
  }

  const merged: MajorationsConfig = {
    urgency48h:
      typeof body.urgency48h === 'number' && Number.isFinite(body.urgency48h)
        ? body.urgency48h
        : currentMajo.urgency48h,
    weekend:
      typeof body.weekend === 'number' && Number.isFinite(body.weekend)
        ? body.weekend
        : currentMajo.weekend,
    evening:
      typeof body.evening === 'number' && Number.isFinite(body.evening)
        ? body.evening
        : currentMajo.evening,
  }

  if (merged.urgency48h < 0 || merged.weekend < 0 || merged.evening < 0) {
    return NextResponse.json({ error: 'valeurs négatives interdites' }, { status: 400 })
  }

  const newConfig = { ...current, majorations: merged }

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

  return NextResponse.json({ ok: true, majorations: merged })
}
