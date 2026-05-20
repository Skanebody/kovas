/**
 * KOVAS — Mode terrain Capture-First (V1.5 iteration 1).
 *
 * Server component coquille : charge le dossier + rooms et délègue à <CaptureScreen>.
 *
 * Authority : CLAUDE.md §3 features 1-2-10 (saisie vocale + photos géolocalisées + offline).
 * Cette page est INDÉPENDANTE de `/dossiers/[id]/page.tsx` (laissée intacte) et de
 * `live-capture.tsx` (mode classique conservé).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CaptureScreen } from './capture-screen'

export const metadata: Metadata = { title: 'Mode terrain — Capture' }

export default async function MissionCapturePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  const [{ data: dossier }, { data: rooms }] = await Promise.all([
    supabase
      .from('dossiers')
      .select('id, reference')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('dossier_rooms')
      .select('id, name, position')
      .eq('dossier_id', id)
      .eq('organization_id', orgId)
      .order('position', { ascending: true }),
  ])

  if (!dossier) {
    notFound()
  }

  const roomOptions = (rooms ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
  }))

  return (
    <CaptureScreen
      dossier={{ id: dossier.id as string, reference: dossier.reference as string }}
      rooms={roomOptions}
    />
  )
}
