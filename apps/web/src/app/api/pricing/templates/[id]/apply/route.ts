/**
 * POST /api/pricing/templates/[id]/apply
 *
 * Applique un template (economique / median / premium) à la config tarifaire
 * de l'utilisateur courant. Le body peut contenir des overrides ponctuels
 * (ex: vatStatus, displayMode) qui prendront le pas sur les valeurs par défaut.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { getTemplate } from '@/lib/pricing/pricing-templates'
import { NextResponse } from 'next/server'

interface UpsertConfigQuery {
  upsert: (
    row: Record<string, unknown>,
    opts: { onConflict: string },
  ) => {
    select: (cols: string) => {
      single: () => Promise<{
        data: Record<string, unknown> | null
        error: { message: string } | null
      }>
    }
  }
}

interface BodyOverrides {
  vatStatus?: unknown
  vatRate?: unknown
  displayMode?: unknown
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, orgId, supabase } = await getCurrentUser()
  const { id } = await ctx.params

  const template = getTemplate(id)
  if (!template) {
    return NextResponse.json({ error: 'Template introuvable' }, { status: 404 })
  }

  const overrides = (await request.json().catch(() => ({}))) as BodyOverrides

  const vatStatus =
    overrides.vatStatus === 'franchise_vat' || overrides.vatStatus === 'with_vat'
      ? overrides.vatStatus
      : 'with_vat'

  const vatRate =
    typeof overrides.vatRate === 'number' && Number.isFinite(overrides.vatRate)
      ? overrides.vatRate
      : Number(process.env.PRICING_DEFAULT_VAT_RATE ?? 0.2)

  const displayMode =
    overrides.displayMode === 'ttc_only' ||
    overrides.displayMode === 'ht_only' ||
    overrides.displayMode === 'ht_and_ttc'
      ? overrides.displayMode
      : 'ht_and_ttc'

  const pricingConfig = {
    diagnostics: template.diagnostics,
    travelFees: template.travelFees,
    majorations: template.majorations,
  }

  const upsertQuery = supabase.from('user_pricing_config') as unknown as UpsertConfigQuery
  const { data, error } = await upsertQuery
    .upsert(
      {
        user_id: user.id,
        organization_id: orgId,
        vat_status: vatStatus,
        vat_rate: vatRate,
        display_mode: displayMode,
        applied_template: template.id,
        template_applied_at: new Date().toISOString(),
        pricing_config: pricingConfig,
        has_configured: true,
      },
      { onConflict: 'user_id' },
    )
    .select(
      'user_id, organization_id, vat_status, vat_rate, display_mode, applied_template, template_applied_at, pricing_config, has_configured, created_at, updated_at',
    )
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, config: data })
}
