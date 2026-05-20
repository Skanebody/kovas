/**
 * /api/pricing/vat-settings
 *
 * GET  → renvoie { vatStatus, vatRate, displayMode } du user.
 * PUT  → update partiel de ces 3 champs.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

type VatStatus = 'with_vat' | 'franchise_vat'
type DisplayMode = 'ht_and_ttc' | 'ttc_only' | 'ht_only'

interface SettingsRow {
  vat_status: VatStatus
  vat_rate: number
  display_mode: DisplayMode
}

interface SelectQuery {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      maybeSingle: () => Promise<{
        data: SettingsRow | null
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
    .select('vat_status, vat_rate, display_mode')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const defaultRate = Number(process.env.PRICING_DEFAULT_VAT_RATE ?? 0.2)
  return NextResponse.json(
    {
      vatStatus: data?.vat_status ?? 'with_vat',
      vatRate: data?.vat_rate ?? defaultRate,
      displayMode: data?.display_mode ?? 'ht_and_ttc',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

interface PutBody {
  vatStatus?: unknown
  vatRate?: unknown
  displayMode?: unknown
}

export async function PUT(request: Request) {
  const { user, orgId, supabase } = await getCurrentUser()
  const body = (await request.json().catch(() => ({}))) as PutBody

  const updates: Record<string, unknown> = {}

  if (body.vatStatus !== undefined) {
    if (body.vatStatus !== 'with_vat' && body.vatStatus !== 'franchise_vat') {
      return NextResponse.json({ error: 'vatStatus invalide' }, { status: 400 })
    }
    updates.vat_status = body.vatStatus
  }
  if (body.vatRate !== undefined) {
    if (
      typeof body.vatRate !== 'number' ||
      !Number.isFinite(body.vatRate) ||
      body.vatRate < 0 ||
      body.vatRate > 1
    ) {
      return NextResponse.json({ error: 'vatRate invalide (0..1)' }, { status: 400 })
    }
    updates.vat_rate = body.vatRate
  }
  if (body.displayMode !== undefined) {
    if (
      body.displayMode !== 'ht_and_ttc' &&
      body.displayMode !== 'ttc_only' &&
      body.displayMode !== 'ht_only'
    ) {
      return NextResponse.json({ error: 'displayMode invalide' }, { status: 400 })
    }
    updates.display_mode = body.displayMode
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'aucun champ à mettre à jour' }, { status: 400 })
  }

  // Tente UPDATE ; si la ligne n'existe pas → UPSERT.
  const selectQuery = supabase.from('user_pricing_config') as unknown as SelectQuery
  const { data: existing } = await selectQuery
    .select('vat_status, vat_rate, display_mode')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    const updateQuery = supabase.from('user_pricing_config') as unknown as UpdateQuery
    const { error } = await updateQuery.update(updates).eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const upsertQuery = supabase.from('user_pricing_config') as unknown as UpsertQuery
    const { error } = await upsertQuery.upsert(
      {
        user_id: user.id,
        organization_id: orgId,
        ...updates,
      },
      { onConflict: 'user_id' },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
