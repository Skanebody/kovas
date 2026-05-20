/**
 * /api/pricing/packs/[id]
 *
 * PUT    → update partiel d'un pack du user.
 * DELETE → suppression d'un pack (hard delete — RLS limite au propriétaire).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type { PricingDiagnosticType } from '@/lib/pricing/pricing-templates'
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

interface UpdateQuery {
  update: (row: Record<string, unknown>) => {
    eq: (
      col: string,
      val: string,
    ) => {
      eq: (
        col: string,
        val: string,
      ) => {
        select: (cols: string) => {
          single: () => Promise<{
            data: Record<string, unknown> | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
}

interface DeleteQuery {
  delete: () => {
    eq: (
      col: string,
      val: string,
    ) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
    }
  }
}

interface PutBody {
  name?: unknown
  description?: unknown
  diagnostics?: unknown
  priceHt?: unknown
  applicableFor?: unknown
  minPropertyAge?: unknown
  isActive?: unknown
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await getCurrentUser()
  const { id } = await ctx.params
  const body = (await request.json().catch(() => ({}))) as PutBody

  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'name invalide' }, { status: 400 })
    }
    updates.name = body.name.trim()
  }
  if (body.description !== undefined) {
    updates.description = typeof body.description === 'string' ? body.description : null
  }
  if (body.diagnostics !== undefined) {
    if (!Array.isArray(body.diagnostics) || body.diagnostics.length === 0) {
      return NextResponse.json({ error: 'diagnostics requis (array non vide)' }, { status: 400 })
    }
    for (const d of body.diagnostics) {
      if (typeof d !== 'string' || !VALID_DIAGNOSTICS.includes(d as PricingDiagnosticType)) {
        return NextResponse.json({ error: `diagnostic invalide: ${String(d)}` }, { status: 400 })
      }
    }
    updates.diagnostics = body.diagnostics
  }
  if (body.priceHt !== undefined) {
    if (typeof body.priceHt !== 'number' || !Number.isFinite(body.priceHt) || body.priceHt < 0) {
      return NextResponse.json({ error: 'priceHt invalide' }, { status: 400 })
    }
    updates.price_ht = body.priceHt
  }
  if (body.applicableFor !== undefined) {
    if (body.applicableFor === null) {
      updates.applicable_for = null
    } else if (Array.isArray(body.applicableFor)) {
      updates.applicable_for = body.applicableFor
    } else {
      return NextResponse.json({ error: 'applicableFor invalide' }, { status: 400 })
    }
  }
  if (body.minPropertyAge !== undefined) {
    if (body.minPropertyAge === null) {
      updates.min_property_age = null
    } else if (typeof body.minPropertyAge === 'number' && Number.isFinite(body.minPropertyAge)) {
      updates.min_property_age = body.minPropertyAge
    } else {
      return NextResponse.json({ error: 'minPropertyAge invalide' }, { status: 400 })
    }
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive invalide' }, { status: 400 })
    }
    updates.is_active = body.isActive
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'aucun champ à mettre à jour' }, { status: 400 })
  }

  const updateQuery = supabase.from('user_pricing_packs') as unknown as UpdateQuery
  const { data, error } = await updateQuery
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(
      'id, name, description, predefined_pack_id, diagnostics, price_ht, applicable_for, min_property_age, is_active, created_at, updated_at',
    )
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Pack introuvable' }, { status: 404 })
  return NextResponse.json({ ok: true, pack: data })
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await getCurrentUser()
  const { id } = await ctx.params

  const deleteQuery = supabase.from('user_pricing_packs') as unknown as DeleteQuery
  const { error } = await deleteQuery.delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
