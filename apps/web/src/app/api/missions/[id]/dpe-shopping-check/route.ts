/**
 * KOVAS — Endpoint DPE shopping check (Game Changer 6).
 *
 * GET /api/missions/[id]/dpe-shopping-check
 *
 * Vérifie si un DPE récent existe sur la parcelle du bien (algo A1.3.1).
 * Retour léger pour cockpit fraude (liste rapide).
 *
 * Cache : 6h via header Cache-Control (l'ADEME ne change pas constamment).
 */

import { detectDpeShopping } from '@/lib/algos/dpe-shopping'
import { getCurrentUser } from '@/lib/auth/current-user'
import { buildPropertyUnifiedProfile } from '@/lib/property/build-profile'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: missionId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(missionId)) {
    return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 })
  }

  let orgId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
    supabase = u.supabase
  } catch {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const { data: mission } = await supabase
    .from('missions')
    .select(
      'id, type, dossier_id, dossiers!inner(id, properties!inner(address_full, address_postcode, address_city))',
    )
    .eq('id', missionId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!mission) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })

  type M = {
    type: string
    dossiers?: {
      properties?: { address_full?: string; address_postcode?: string; address_city?: string }[]
    }
  }
  const m = mission as unknown as M
  if (!['dpe_vente', 'dpe_location'].includes(m.type ?? '')) {
    return NextResponse.json({ ok: true, has_recent_dpe: false, alert_level: 'none' as const })
  }
  const prop = m.dossiers?.properties?.[0]
  if (!prop?.address_full) {
    return NextResponse.json({ ok: true, has_recent_dpe: false, alert_level: 'none' as const })
  }

  const fullAddress =
    `${prop.address_full} ${prop.address_postcode ?? ''} ${prop.address_city ?? ''}`.trim()
  const profile = await buildPropertyUnifiedProfile(fullAddress, { address: fullAddress })
  if ('error' in profile) {
    return NextResponse.json({ ok: false, error: profile.error }, { status: profile.status })
  }

  const result = detectDpeShopping(profile, null) // pas encore d'estimation classe au stade pré-mission

  return NextResponse.json(
    { ok: true, ...result },
    {
      headers: {
        'Cache-Control': 'private, max-age=21600, s-maxage=21600', // 6h
      },
    },
  )
}
