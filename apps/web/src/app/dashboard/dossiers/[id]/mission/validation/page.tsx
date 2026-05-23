/**
 * KOVAS — Page bureau "Validation mission" (MISSION-D).
 *
 * Server Component coquille : charge la mission_session + mission_rooms_3cl_data
 * + photos liées + warnings, et délègue à ValidationClient pour l'interactivité.
 *
 * Layout split 3 colonnes :
 *   - Gauche : liste des pièces avec leur complétude 3CL
 *   - Centre : formulaire 30-40 champs 3CL pré-remplis + photos liées
 *   - Droite : checklist "Champs à risque" (required vide ou confidence < 0.7)
 *
 * Authority : CLAUDE.md §3 feature 9 (export multi-format), §10 (offline complet).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ValidationClient } from './validation-client'

export const metadata: Metadata = { title: 'Validation mission 3CL' }

interface Room3CLRow {
  id: string
  mission_session_id: string
  room_name: string
  room_type: string | null
  surface_sqm: number | null
  ceiling_height_m: number | null
  orientation: string | null
  data_3cl: Record<string, unknown>
  ai_confidence_score: number | null
  source: 'ai_extracted' | 'user_validated' | 'user_corrected'
  validated_by_user: boolean
  created_at: string
}

interface PhotoRow {
  id: string
  storage_path: string
  thumb_path: string | null
  room_id: string | null
  caption: string | null
  vision_analysis: Record<string, unknown> | null
  vision_confidence: number | null
}

export default async function MissionValidationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  // Récupérer le dernier mission_session du dossier
  const { data: session } = await (
    supabase.from('mission_sessions') as unknown as {
      select: (q: string) => {
        eq: (
          k: string,
          v: string,
        ) => {
          eq: (
            k: string,
            v: string,
          ) => {
            order: (
              k: string,
              o: { ascending: boolean },
            ) => {
              limit: (n: number) => {
                maybeSingle: () => Promise<{
                  data: {
                    id: string
                    dossier_id: string
                    payload_processed: boolean | null
                    sync_status: string | null
                    sync_error: string | null
                    sync_completed_at: string | null
                    last_sync_attempt: string | null
                  } | null
                }>
              }
            }
          }
        }
      }
    }
  )
    .select(
      'id, dossier_id, payload_processed, sync_status, sync_error, sync_completed_at, last_sync_attempt',
    )
    .eq('dossier_id', id)
    .eq('organization_id', orgId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Récupérer dossier de base pour reference
  const { data: dossier } = await supabase
    .from('dossiers')
    .select('id, reference')
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (!dossier) notFound()

  // Charger les rooms 3CL (admin client pour éviter pb RLS sur la nouvelle table)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  let rooms: Room3CLRow[] = []
  if (session?.id) {
    const tbl = admin.from('mission_rooms_3cl_data') as unknown as {
      select: (q: string) => {
        eq: (
          k: string,
          v: string,
        ) => {
          order: (k: string, o: { ascending: boolean }) => Promise<{ data: Room3CLRow[] | null }>
        }
      }
    }
    const { data } = await tbl
      .select(
        'id, mission_session_id, room_name, room_type, surface_sqm, ceiling_height_m, orientation, data_3cl, ai_confidence_score, source, validated_by_user, created_at',
      )
      .eq('mission_session_id', session.id)
      .order('created_at', { ascending: true })
    rooms = data ?? []
  }

  // Charger les photos analysées du dossier
  const { data: photos } = await supabase
    .from('photos')
    .select('id, storage_path, thumb_path, room_id, caption, vision_analysis, vision_confidence')
    .eq('dossier_id', id)
    .eq('organization_id', orgId)
    .limit(200)

  return (
    <ValidationClient
      dossier={{ id: dossier.id, reference: dossier.reference }}
      session={
        session
          ? {
              id: session.id,
              payload_processed: session.payload_processed ?? false,
              sync_status: session.sync_status ?? 'idle',
              sync_error: session.sync_error,
              sync_completed_at: session.sync_completed_at,
              last_sync_attempt: session.last_sync_attempt,
            }
          : null
      }
      rooms={rooms}
      photos={(photos ?? []) as unknown as PhotoRow[]}
    />
  )
}
