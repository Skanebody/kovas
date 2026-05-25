/**
 * KOVAS — Endpoint pré-validation score conformité (Game Changer 1).
 *
 * GET /api/missions/[id]/prevalidation-score
 *
 * Construit le profil unifié propriété (A1.3.4) puis calcule le score
 * conformité multi-dimensionnel (A1.3.3) avec ≤5 anomalies + ≤3 opportunités.
 *
 * Performance budget : < 3.5s (3s profil + 800ms score).
 * Authority : REFONTE-ACQUI-TARGET-V2 chapitre 6.2.
 */

import {
  type MissionContextForConformity,
  computeConformityScore,
} from '@/lib/algos/conformity-score'
import { getCurrentUser } from '@/lib/auth/current-user'
import { buildPropertyUnifiedProfile } from '@/lib/property/build-profile'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

type DiagType = MissionContextForConformity['diagnostic_type']

function isDiagType(s: string): s is DiagType {
  return ['DPE', 'AMIANTE', 'PLOMB', 'GAZ', 'ELECTRICITE', 'TERMITES', 'CARREZ', 'ERP'].includes(s)
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: missionId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(missionId)) {
    return NextResponse.json({ error: 'invalid mission id' }, { status: 400 })
  }

  let orgId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
    supabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Charge mission + dossier + property
  const { data: mission } = await supabase
    .from('missions')
    .select(
      'id, type, dossier_id, dossiers!inner(id, organization_id, properties!inner(address_full, address_postcode, address_city, surface_m2))',
    )
    .eq('id', missionId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!mission) {
    return NextResponse.json({ error: 'mission not found' }, { status: 404 })
  }

  type MissionRow = {
    type: string
    dossier_id: string
    dossiers?: {
      properties?: {
        address_full?: string
        address_postcode?: string
        address_city?: string
        surface_m2?: number
      }[]
    }
  }
  const m = mission as unknown as MissionRow
  const property = m.dossiers?.properties?.[0]
  if (!property?.address_full) {
    return NextResponse.json({ error: 'mission has no property address' }, { status: 400 })
  }

  const diagType = m.type?.toUpperCase()
  if (!diagType || !isDiagType(diagType)) {
    return NextResponse.json({ error: `unsupported diagnostic type: ${diagType}` }, { status: 400 })
  }

  // Build profil unifié
  const fullAddress =
    `${property.address_full} ${property.address_postcode ?? ''} ${property.address_city ?? ''}`.trim()
  const profile = await buildPropertyUnifiedProfile(fullAddress, { address: fullAddress })
  if ('error' in profile) {
    return NextResponse.json(
      { error: `profile build failed: ${profile.error}` },
      { status: profile.status },
    )
  }

  // Charge contexte mission via dossier_id (mission_photos n'a pas de mission_id direct)
  const { count: photosCount } = await supabase
    .from('mission_photos')
    .select('id', { count: 'exact', head: true })
    .eq('dossier_id', m.dossier_id)

  // Latest session pour ce dossier
  const { data: lastSession } = await supabase
    .from('mission_sessions')
    .select('id')
    .eq('dossier_id', m.dossier_id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sessionId = (lastSession as { id?: string } | null)?.id

  const { data: chatMessages } = sessionId
    ? await supabase
        .from('mission_chat_messages')
        .select('content')
        .eq('session_id', sessionId)
        .limit(50)
    : { data: [] as { content: string }[] }
  const allText = (chatMessages ?? [])
    .map((m) => (m as { content: string }).content)
    .join(' ')
    .toLowerCase()
  const hasReserves = /\b(r[eé]serve|inaccessible|non visit[eé])\b/.test(allText)

  // Computed conformity score
  const missionContext: MissionContextForConformity = {
    diagnostic_type: diagType,
    declared_surface_m2: property.surface_m2 ?? null,
    estimated_dpe_class: null, // V1 : pas encore extrait du tchat
    has_photos: (photosCount ?? 0) > 0,
    photos_count: photosCount ?? 0,
    has_reserves_mentioned: hasReserves,
    required_fields_filled: 0, // TODO : compter via mission_field_values
    required_fields_total: 0,
  }

  const score = computeConformityScore(profile, missionContext)

  return NextResponse.json({
    ok: true,
    mission_id: missionId,
    address: fullAddress,
    score,
    profile_freshness: profile.meta.freshness_score,
    partial_failures: profile.meta.partial_failures ?? [],
  })
}
