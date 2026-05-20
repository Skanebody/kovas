/**
 * KOVAS — API route vision-status (Capture-First V1.5 iteration 3).
 *
 * Renvoie le statut Vision IA d'une photo + nb de champs extraits + confidence.
 * Utilisé par le hook `useVisionStatus` côté capture-screen pour rafraîchir le
 * badge sur la vignette (polling 5s tant que pending/processing).
 *
 * Auth via getCurrentUser → RLS sur photos limite naturellement à l'org.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type { VisionStatus } from '@/lib/mission/types'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface VisionStatusResponse {
  vision_status: VisionStatus
  vision_confidence: number | null
  fields_count: number
  analyzed_at: string | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<VisionStatusResponse | { error: string }>> {
  const { id: photoId } = await params

  if (!/^[0-9a-f-]{36}$/i.test(photoId)) {
    return NextResponse.json({ error: 'photoId must be a UUID' }, { status: 400 })
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

  const { data: photo, error } = await supabase
    .from('photos')
    .select('id, dossier_id, vision_status, vision_confidence, analyzed_at')
    .eq('id', photoId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!photo) {
    return NextResponse.json({ error: 'photo not found' }, { status: 404 })
  }

  // Compte les champs extraits depuis cette photo
  let fieldsCount = 0
  const { count } = await supabase
    .from('dossier_field_values')
    .select('id', { count: 'exact', head: true })
    .eq('source_photo_id', photoId)
    .eq('organization_id', orgId)
  if (typeof count === 'number') fieldsCount = count

  return NextResponse.json({
    vision_status: photo.vision_status as VisionStatus,
    vision_confidence: typeof photo.vision_confidence === 'number' ? photo.vision_confidence : null,
    fields_count: fieldsCount,
    analyzed_at: typeof photo.analyzed_at === 'string' ? photo.analyzed_at : null,
  })
}
