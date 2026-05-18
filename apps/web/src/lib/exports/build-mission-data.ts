/**
 * Agrégateur de données mission pour export.
 * Une mission appartient à un dossier qui contient les pièces, photos,
 * notes vocales et documents propriétaire partagés entre toutes les missions
 * du dossier.
 */
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '@kovas/database/types'
import type { VoiceParsedData } from '@/lib/voice-parser'

export interface MissionExportData {
  mission: {
    id: string
    reference: string
    type: string
    status: string
    scheduled_at: string | null
    started_at: string | null
    completed_at: string | null
    notes: string | null
    created_at: string
  }
  property: {
    address: string
    postal_code: string | null
    city: string | null
    property_type: string | null
    year_built: number | null
    surface_total: number | null
    surface_carrez: number | null
  } | null
  client: {
    display_name: string
    type: string
    email: string | null
    phone: string | null
    address: string | null
  } | null
  organization: {
    name: string
  } | null
  rooms: {
    id: string
    name: string
    room_type: string | null
    surface_m2: number | null
  }[]
  photos: {
    id: string
    storage_path: string
    room_id: string | null
    width: number | null
    height: number | null
    taken_at: string | null
    caption: string | null
  }[]
  voiceNotes: {
    id: string
    room_id: string | null
    duration_seconds: number | null
    transcript_raw: string | null
    transcript_structured: VoiceParsedData | null
    created_at: string
  }[]
  ownerDocuments: {
    id: string
    storage_path: string
    original_name: string | null
    doc_kind: string | null
  }[]
  exportedAt: string
  isTrial: boolean
}

export async function buildMissionExportData(
  missionId: string,
  orgId: string,
): Promise<MissionExportData> {
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // 1. Récupère la mission + le dossier parent + property/client (via dossier)
  const { data: mission } = await admin
    .from('missions')
    .select(
      'id, reference, type, status, completed_at, created_at, dossier_id, dossiers(scheduled_at, started_at, notes, property_id, client_id, properties(address, postal_code, city, property_type, year_built, surface_total, surface_carrez), clients(display_name, type, email, phone, address))',
    )
    .eq('id', missionId)
    .eq('organization_id', orgId)
    .single()

  if (!mission) throw new Error(`Mission ${missionId} not found`)

  const dossier = Array.isArray(mission.dossiers) ? mission.dossiers[0] : mission.dossiers
  if (!dossier) throw new Error(`Dossier introuvable pour mission ${missionId}`)

  // 2. Récupère les données partagées depuis le dossier
  const dossierId = mission.dossier_id
  const [
    { data: rooms },
    { data: photos },
    { data: voiceNotes },
    { data: ownerDocs },
    { data: org },
    { data: trial },
  ] = await Promise.all([
    admin
      .from('dossier_rooms')
      .select('id, name, room_type, surface_m2')
      .eq('dossier_id', dossierId),
    admin
      .from('photos')
      .select('id, storage_path, room_id, width, height, taken_at, caption')
      .eq('dossier_id', dossierId),
    admin
      .from('voice_notes')
      .select('id, room_id, duration_seconds, transcript_raw, transcript_structured, created_at')
      .eq('dossier_id', dossierId),
    admin
      .from('owner_documents')
      .select('id, storage_path, original_name, doc_kind')
      .eq('dossier_id', dossierId),
    admin.from('organizations').select('name').eq('id', orgId).single(),
    admin
      .from('cabinet_trials')
      .select('converted_to_paid')
      .eq('organization_id', orgId)
      .maybeSingle(),
  ])

  const prop = Array.isArray(dossier.properties) ? dossier.properties[0] : dossier.properties
  const client = Array.isArray(dossier.clients) ? dossier.clients[0] : dossier.clients
  const isTrial = Boolean(trial && !trial.converted_to_paid)

  return {
    mission: {
      id: mission.id,
      reference: mission.reference,
      type: mission.type,
      status: mission.status,
      scheduled_at: dossier.scheduled_at,
      started_at: dossier.started_at,
      completed_at: mission.completed_at,
      notes: dossier.notes,
      created_at: mission.created_at,
    },
    property: prop ?? null,
    client: client ?? null,
    organization: org ?? null,
    rooms: rooms ?? [],
    photos: photos ?? [],
    voiceNotes: (voiceNotes ?? []).map((v) => ({
      id: v.id,
      room_id: v.room_id,
      duration_seconds: v.duration_seconds,
      transcript_raw: v.transcript_raw,
      transcript_structured: v.transcript_structured as VoiceParsedData | null,
      created_at: v.created_at,
    })),
    ownerDocuments: ownerDocs ?? [],
    exportedAt: new Date().toISOString(),
    isTrial,
  }
}
