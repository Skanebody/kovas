/**
 * /api/pricing/packs — CRUD packs custom user.
 *
 * GET    → liste les packs du user (actifs et inactifs).
 * POST   → crée un nouveau pack.
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

const VALID_APPLICABLE_FOR = ['vente', 'location', 'mise_en_copro'] as const
type ApplicableFor = (typeof VALID_APPLICABLE_FOR)[number]

interface PackRow {
  id: string
  name: string
  description: string | null
  predefined_pack_id: string | null
  diagnostics: string[]
  price_ht: number
  applicable_for: string[] | null
  min_property_age: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ListQuery {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      order: (
        col: string,
        opts: { ascending: boolean },
      ) => Promise<{ data: PackRow[] | null; error: { message: string } | null }>
    }
  }
}

interface InsertQuery {
  insert: (row: Record<string, unknown>) => {
    select: (cols: string) => {
      single: () => Promise<{ data: PackRow | null; error: { message: string } | null }>
    }
  }
}

export async function GET() {
  const { user, supabase } = await getCurrentUser()
  const listQuery = supabase.from('user_pricing_packs') as unknown as ListQuery
  const { data, error } = await listQuery
    .select(
      'id, name, description, predefined_pack_id, diagnostics, price_ht, applicable_for, min_property_age, is_active, created_at, updated_at',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ packs: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}

interface CreateBody {
  name?: unknown
  description?: unknown
  predefinedPackId?: unknown
  diagnostics?: unknown
  priceHt?: unknown
  applicableFor?: unknown
  minPropertyAge?: unknown
}

export async function POST(request: Request) {
  const { user, orgId, supabase } = await getCurrentUser()
  const body = (await request.json().catch(() => ({}))) as CreateBody

  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'name requis' }, { status: 400 })
  }
  if (!Array.isArray(body.diagnostics) || body.diagnostics.length === 0) {
    return NextResponse.json({ error: 'diagnostics requis (array non vide)' }, { status: 400 })
  }
  const diagnostics: string[] = []
  for (const d of body.diagnostics) {
    if (typeof d !== 'string' || !VALID_DIAGNOSTICS.includes(d as PricingDiagnosticType)) {
      return NextResponse.json({ error: `diagnostic invalide: ${String(d)}` }, { status: 400 })
    }
    diagnostics.push(d)
  }
  if (typeof body.priceHt !== 'number' || !Number.isFinite(body.priceHt) || body.priceHt < 0) {
    return NextResponse.json({ error: 'priceHt invalide (>= 0)' }, { status: 400 })
  }

  let applicableFor: ApplicableFor[] | null = null
  if (body.applicableFor !== undefined) {
    if (!Array.isArray(body.applicableFor)) {
      return NextResponse.json({ error: 'applicableFor doit être un array' }, { status: 400 })
    }
    applicableFor = []
    for (const v of body.applicableFor) {
      if (typeof v !== 'string' || !VALID_APPLICABLE_FOR.includes(v as ApplicableFor)) {
        return NextResponse.json({ error: `applicableFor invalide: ${String(v)}` }, { status: 400 })
      }
      applicableFor.push(v as ApplicableFor)
    }
  }

  const insertQuery = supabase.from('user_pricing_packs') as unknown as InsertQuery
  const { data, error } = await insertQuery
    .insert({
      user_id: user.id,
      organization_id: orgId,
      name: body.name.trim(),
      description: typeof body.description === 'string' ? body.description : null,
      predefined_pack_id: typeof body.predefinedPackId === 'string' ? body.predefinedPackId : null,
      diagnostics,
      price_ht: body.priceHt,
      applicable_for: applicableFor,
      min_property_age:
        typeof body.minPropertyAge === 'number' && Number.isFinite(body.minPropertyAge)
          ? body.minPropertyAge
          : null,
      is_active: true,
    })
    .select(
      'id, name, description, predefined_pack_id, diagnostics, price_ht, applicable_for, min_property_age, is_active, created_at, updated_at',
    )
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, pack: data }, { status: 201 })
}
