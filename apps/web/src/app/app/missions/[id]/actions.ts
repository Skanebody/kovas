'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/current-user'

// ============================================
// Mission rooms
// ============================================

const ROOM_TYPES = [
  'salon', 'sejour', 'cuisine', 'chambre', 'salle_de_bain', 'wc',
  'entree', 'couloir', 'buanderie', 'cave', 'grenier', 'garage', 'balcon',
  'terrasse', 'autre',
] as const

const roomSchema = z.object({
  missionId: z.string().uuid(),
  name: z.string().min(1).max(80),
  roomType: z.enum(ROOM_TYPES).optional(),
  surfaceM2: z.coerce.number().min(0).max(10000).optional(),
})

export type RoomFormState = { error?: string } | undefined

export async function addRoomAction(
  _prev: RoomFormState,
  formData: FormData,
): Promise<RoomFormState> {
  const parsed = roomSchema.safeParse({
    missionId: formData.get('missionId'),
    name: formData.get('name'),
    roomType: formData.get('roomType') || undefined,
    surfaceM2: formData.get('surfaceM2') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  const { supabase, orgId } = await getCurrentUser()

  const { count } = await supabase
    .from('mission_rooms')
    .select('*', { count: 'exact', head: true })
    .eq('mission_id', parsed.data.missionId)
    .eq('organization_id', orgId)

  const { error } = await supabase.from('mission_rooms').insert({
    mission_id: parsed.data.missionId,
    organization_id: orgId,
    name: parsed.data.name,
    room_type: parsed.data.roomType ?? null,
    surface_m2: parsed.data.surfaceM2 ?? null,
    position: count ?? 0,
  })

  if (error) return { error: error.message }

  revalidatePath(`/app/missions/${parsed.data.missionId}`)
  return undefined
}

export async function deleteRoomAction(missionId: string, roomId: string) {
  const { supabase, orgId } = await getCurrentUser()
  const { error } = await supabase
    .from('mission_rooms')
    .delete()
    .eq('id', roomId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/missions/${missionId}`)
}

export async function applyRoomTemplateAction(missionId: string, templateId: string) {
  const { ROOM_TEMPLATES } = await import('@/lib/room-templates')
  const template = ROOM_TEMPLATES.find((t) => t.id === templateId)
  if (!template) throw new Error(`Template inconnu: ${templateId}`)

  const { supabase, orgId } = await getCurrentUser()

  const { count } = await supabase
    .from('mission_rooms')
    .select('*', { count: 'exact', head: true })
    .eq('mission_id', missionId)
    .eq('organization_id', orgId)
  const startPosition = count ?? 0

  const rows = template.rooms.map((r, i) => ({
    mission_id: missionId,
    organization_id: orgId,
    name: r.name,
    room_type: r.room_type,
    position: startPosition + i,
  }))

  const { error } = await supabase.from('mission_rooms').insert(rows)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/missions/${missionId}`)
}

// ============================================
// Photos
// ============================================

const photoSchema = z.object({
  missionId: z.string().uuid(),
  roomId: z.string().uuid().optional().or(z.literal('')),
  storagePath: z.string().min(5),
  width: z.coerce.number().int().min(1),
  height: z.coerce.number().int().min(1),
  sizeBytes: z.coerce.number().int().min(1),
  mimeType: z.string().min(3).max(50),
  caption: z.string().max(500).optional().or(z.literal('')),
  longitude: z.coerce.number().optional(),
  latitude: z.coerce.number().optional(),
  takenAt: z.string().optional().or(z.literal('')),
})

export async function createPhotoAction(input: z.infer<typeof photoSchema>) {
  const parsed = photoSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(`Photo metadata invalid: ${parsed.error.issues[0]?.message}`)
  }

  const { supabase, orgId, user } = await getCurrentUser()

  const location =
    parsed.data.longitude && parsed.data.latitude
      ? `SRID=4326;POINT(${parsed.data.longitude} ${parsed.data.latitude})`
      : null

  const { data, error } = await supabase
    .from('photos')
    .insert({
      organization_id: orgId,
      mission_id: parsed.data.missionId,
      room_id: parsed.data.roomId || null,
      storage_path: parsed.data.storagePath,
      width: parsed.data.width,
      height: parsed.data.height,
      size_bytes: parsed.data.sizeBytes,
      mime_type: parsed.data.mimeType,
      caption: parsed.data.caption || null,
      location,
      taken_at: parsed.data.takenAt || null,
      uploaded_by: user.id,
      sync_status: 'synced',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/app/missions/${parsed.data.missionId}`)
  return { id: data.id }
}

export async function deletePhotoAction(missionId: string, photoId: string, storagePath: string) {
  const { supabase, orgId } = await getCurrentUser()

  await supabase.storage.from('mission-photos').remove([storagePath])

  const { error } = await supabase
    .from('photos')
    .delete()
    .eq('id', photoId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
  revalidatePath(`/app/missions/${missionId}`)
}

export async function assignPhotoToRoomAction(
  missionId: string,
  photoId: string,
  roomId: string | null,
) {
  const { supabase, orgId } = await getCurrentUser()
  const { error } = await supabase
    .from('photos')
    .update({ room_id: roomId })
    .eq('id', photoId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/missions/${missionId}`)
}

// ============================================
// Voice notes
// ============================================

const voiceNoteSchema = z.object({
  missionId: z.string().uuid(),
  roomId: z.string().uuid().optional().or(z.literal('')),
  storagePath: z.string().min(5),
  durationSeconds: z.coerce.number().int().min(0).max(3600),
  transcriptRaw: z.string().optional().or(z.literal('')),
  transcriptStructured: z.unknown().optional(),
  provider: z.string().max(50).optional(),
  parserUsed: z.string().max(50).optional(),
  aiCostEur: z.coerce.number().min(0).optional(),
  aiConfidence: z.coerce.number().min(0).max(1).optional(),
})

export async function createVoiceNoteAction(input: z.infer<typeof voiceNoteSchema>) {
  const parsed = voiceNoteSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(`Voice note invalid: ${parsed.error.issues[0]?.message}`)
  }
  const { supabase, orgId, user } = await getCurrentUser()

  const { data, error } = await supabase
    .from('voice_notes')
    .insert({
      mission_id: parsed.data.missionId,
      organization_id: orgId,
      room_id: parsed.data.roomId || null,
      storage_path: parsed.data.storagePath,
      duration_seconds: parsed.data.durationSeconds,
      language: 'fr',
      provider: parsed.data.provider ?? 'openai',
      transcript_raw: parsed.data.transcriptRaw || null,
      transcript_structured: (parsed.data.transcriptStructured ?? null) as never,
      parser_used: parsed.data.parserUsed ?? 'custom_js',
      ai_cost_eur: parsed.data.aiCostEur ?? null,
      ai_confidence: parsed.data.aiConfidence ?? null,
      status: 'transcribed',
      recorded_by: user.id,
      transcribed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/app/missions/${parsed.data.missionId}`)
  return { id: data.id }
}

export async function deleteVoiceNoteAction(missionId: string, voiceNoteId: string, storagePath: string) {
  const { supabase, orgId } = await getCurrentUser()
  await supabase.storage.from('voice-notes').remove([storagePath])
  const { error } = await supabase
    .from('voice_notes')
    .delete()
    .eq('id', voiceNoteId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/missions/${missionId}`)
}

// ============================================
// Mission status transitions
// ============================================

const MISSION_STATUSES = [
  'draft', 'scheduled', 'in_progress', 'to_review', 'done', 'exported', 'archived', 'cancelled',
] as const
type MissionStatus = (typeof MISSION_STATUSES)[number]

// Toggle d'un item manuel de la check-list (persisté dans missions.metadata.checklist).
export async function toggleChecklistItemAction(
  missionId: string,
  itemId: string,
  checked: boolean,
) {
  const { supabase, orgId } = await getCurrentUser()

  const { data: current } = await supabase
    .from('missions')
    .select('metadata')
    .eq('id', missionId)
    .eq('organization_id', orgId)
    .single()

  const meta = (current?.metadata as Record<string, unknown> | null) ?? {}
  const checklist = (meta.checklist as Record<string, boolean> | undefined) ?? {}
  checklist[itemId] = checked
  meta.checklist = checklist

  const { error } = await supabase
    .from('missions')
    .update({ metadata: meta as never })
    .eq('id', missionId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
  revalidatePath(`/app/missions/${missionId}`)
}

// ============================================
// Lien public upload client (documents propriétaire)
// ============================================

function randomToken(length = 24): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  for (const b of bytes) out += chars[b % chars.length]
  return out
}

export async function generateClientUploadLinkAction(missionId: string) {
  const { supabase, orgId } = await getCurrentUser()
  const token = randomToken(24)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('missions')
    .update({
      client_upload_token: token,
      client_upload_expires_at: expiresAt,
    })
    .eq('id', missionId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
  revalidatePath(`/app/missions/${missionId}`)
  return { token, expiresAt }
}

export async function revokeClientUploadLinkAction(missionId: string) {
  const { supabase, orgId } = await getCurrentUser()
  const { error } = await supabase
    .from('missions')
    .update({
      client_upload_token: null,
      client_upload_expires_at: null,
    })
    .eq('id', missionId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/missions/${missionId}`)
}

export async function toggleDocumentReviewedAction(
  missionId: string,
  documentId: string,
  reviewed: boolean,
) {
  const { supabase, orgId } = await getCurrentUser()
  const { error } = await supabase
    .from('owner_documents')
    .update({ reviewed_by_diag: reviewed })
    .eq('id', documentId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/missions/${missionId}`)
}

export async function deleteOwnerDocumentAction(
  missionId: string,
  documentId: string,
  storagePath: string,
) {
  const { supabase, orgId } = await getCurrentUser()
  await supabase.storage.from('owner-uploads').remove([storagePath])
  const { error } = await supabase
    .from('owner_documents')
    .delete()
    .eq('id', documentId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/missions/${missionId}`)
}

export async function updateMissionStatusAction(missionId: string, newStatus: MissionStatus) {
  if (!MISSION_STATUSES.includes(newStatus)) {
    throw new Error(`Statut invalide: ${newStatus}`)
  }
  const { supabase, orgId } = await getCurrentUser()

  const now = new Date().toISOString()
  const updates: {
    status: MissionStatus
    started_at?: string
    completed_at?: string
  } = { status: newStatus }
  if (newStatus === 'in_progress') updates.started_at = now
  if (newStatus === 'done') updates.completed_at = now

  const { error } = await supabase
    .from('missions')
    .update(updates)
    .eq('id', missionId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
  revalidatePath(`/app/missions/${missionId}`)
  revalidatePath('/app/missions')
  revalidatePath('/app/dashboard')
}
