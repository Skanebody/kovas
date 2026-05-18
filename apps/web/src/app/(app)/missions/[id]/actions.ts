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
