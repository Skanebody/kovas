/**
 * GET  /api/pricing/diagnostic-prices  → renvoie pricing_config.diagnostics du user.
 * PUT  /api/pricing/diagnostic-prices  → met à jour partiellement les diagnostics
 *                                        (merge jsonb côté lib, on remet la section
 *                                        complète à la table).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type { DiagnosticPricing, PricingDiagnosticType } from '@/lib/pricing/pricing-templates'
import { NextResponse } from 'next/server'

interface SelectQuery {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      maybeSingle: () => Promise<{
        data: { pricing_config: { diagnostics?: Record<string, DiagnosticPricing> } | null } | null
        error: { message: string } | null
      }>
    }
  }
}

interface UpdateQuery {
  update: (row: Record<string, unknown>) => {
    eq: (
      col: string,
      val: string,
    ) => Promise<{
      error: { message: string } | null
    }>
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const diagnostics = data?.pricing_config?.diagnostics ?? {}
  return NextResponse.json({ diagnostics }, { headers: { 'Cache-Control': 'no-store' } })
}

interface PutBody {
  updates?: Partial<Record<PricingDiagnosticType, Partial<DiagnosticPricing>>>
}

export async function PUT(request: Request) {
  const { user, orgId, supabase } = await getCurrentUser()
  const body = (await request.json().catch(() => ({}))) as PutBody

  if (!body.updates || typeof body.updates !== 'object') {
    return NextResponse.json({ error: 'updates object requis' }, { status: 400 })
  }

  // Charge la config existante
  const selectQuery = supabase.from('user_pricing_config') as unknown as SelectQuery
  const { data: existing } = await selectQuery
    .select('pricing_config')
    .eq('user_id', user.id)
    .maybeSingle()

  const currentConfig = (existing?.pricing_config ?? {}) as {
    diagnostics?: Record<string, DiagnosticPricing>
    travelFees?: unknown
    majorations?: unknown
  }
  const currentDiagnostics = currentConfig.diagnostics ?? {}

  // Merge partiel : on remplace chaque entrée DiagnosticPricing complète si fournie
  const mergedDiagnostics: Record<string, DiagnosticPricing> = { ...currentDiagnostics }
  for (const [key, partial] of Object.entries(body.updates)) {
    if (!partial) continue
    const existingEntry = currentDiagnostics[key] ?? {
      basePrice: 0,
      modulations: { studio: 1, appartement: 1, grandAppartement: 1, maison: 1, grandeMaison: 1 },
    }
    mergedDiagnostics[key] = {
      basePrice:
        typeof partial.basePrice === 'number' ? partial.basePrice : existingEntry.basePrice,
      modulations: {
        ...existingEntry.modulations,
        ...(partial.modulations ?? {}),
      },
    }
  }

  const newConfig = { ...currentConfig, diagnostics: mergedDiagnostics }

  if (existing) {
    const updateQuery = supabase.from('user_pricing_config') as unknown as UpdateQuery
    const { error } = await updateQuery
      .update({ pricing_config: newConfig, has_configured: true })
      .eq('user_id', user.id)
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

  return NextResponse.json({ ok: true, diagnostics: mergedDiagnostics })
}
