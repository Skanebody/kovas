'use server'

/**
 * KOVAS — Server actions du mode terrain Capture-First (V1.5 iteration 2).
 *
 * Pattern : le client browser uploade directement le blob dans le bucket
 * `mission-photos` via supabase-js (RLS path `<orgId>/...`). Ces server
 * actions ne reçoivent QUE des métadonnées + storage_path et insèrent la
 * row dans `photos` / `dossier_rooms`.
 *
 * Authority : CLAUDE.md §3 features 1-2-10 + migration capture_first.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ============================================
// createRoomAction — création d'une pièce depuis le picker mode capture
// ============================================

const createRoomSchema = z.object({
  dossierId: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
})

export async function createRoomAction(
  dossierId: string,
  name: string,
): Promise<{ roomId: string } | { error: string }> {
  const parsed = createRoomSchema.safeParse({ dossierId, name })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { supabase, orgId } = await getCurrentUser()

  // RPC atomique `create_or_get_dossier_room` (migration 20260615100000) :
  //   - check is_member_of(org_id) côté DB
  //   - SELECT existing room (case-insensitive) ou INSERT atomique
  //   - en cas de race (2 inserts simultanés offline-sync), retourne la row
  //     qui a gagné grâce au UNIQUE INDEX partial (cf. audit P1-1 mode mission).
  const rpc = supabase.rpc as unknown as (
    fn: 'create_or_get_dossier_room',
    args: {
      p_dossier_id: string
      p_org_id: string
      p_name: string
      p_room_type?: string | null
    },
  ) => Promise<{
    data: Array<{ id: string; position: number; name: string; created: boolean }> | null
    error: { message: string; code?: string } | null
  }>

  const { data, error } = await rpc('create_or_get_dossier_room', {
    p_dossier_id: parsed.data.dossierId,
    p_org_id: orgId,
    p_name: parsed.data.name,
  })

  if (error || !data || data.length === 0) {
    // Mapping des codes d'erreur SQL vers messages user-friendly
    if (error?.code === '42501') return { error: 'Accès refusé à cette organisation' }
    if (error?.code === 'P0002') return { error: 'Dossier introuvable ou accès refusé' }
    return { error: error?.message ?? 'Création de pièce impossible' }
  }

  const row = data[0]
  if (!row) {
    return { error: 'Création de pièce impossible' }
  }
  revalidatePath(`/dashboard/dossiers/${parsed.data.dossierId}/mission`)
  return { roomId: row.id }
}

// ============================================
// uploadCapturePhotoAction — INSERT row photos après upload Storage
// ============================================

// Limites hard pour empêcher des inserts pathologiques (cf. audit P2-8).
const MAX_PHOTO_SIZE_BYTES = 20_000_000 // 20 MB — au-delà = soit malicieux soit caméra HDR > raisonnable
const MAX_PHOTO_PIXELS = 20_000 // 20 000 px max par côté

const uploadCapturePhotoSchema = z.object({
  storagePath: z.string().min(5).max(512),
  roomId: z.string().uuid().nullable(),
  roomName: z.string().trim().min(1).max(60).nullable(),
  capturedAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  width: z.coerce.number().int().min(1).max(MAX_PHOTO_PIXELS),
  height: z.coerce.number().int().min(1).max(MAX_PHOTO_PIXELS),
  sizeBytes: z.coerce.number().int().min(1).max(MAX_PHOTO_SIZE_BYTES),
  perceptualHash: z.string().regex(/^[0-9a-f]{16}$/i, 'perceptual_hash must be 16 hex chars'),
  isBlurry: z.boolean(),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
})

export interface UploadCapturePhotoPayload {
  storagePath: string
  roomId: string | null
  roomName: string | null
  capturedAt: string
  width: number
  height: number
  sizeBytes: number
  perceptualHash: string
  isBlurry: boolean
  gpsLat?: number
  gpsLng?: number
}

export async function uploadCapturePhotoAction(
  dossierId: string,
  payload: UploadCapturePhotoPayload,
): Promise<{ photoId: string } | { error: string }> {
  const parsedDossier = z.string().uuid().safeParse(dossierId)
  if (!parsedDossier.success) {
    return { error: 'dossierId must be a UUID' }
  }
  const parsed = uploadCapturePhotoSchema.safeParse(payload)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid payload' }
  }

  const { supabase, orgId, user } = await getCurrentUser()

  // 0. SÉCURITÉ — Le storagePath DOIT commencer par `${orgId}/...` car la RLS
  // Storage du bucket mission-photos applique le path tenant. Sans cette
  // validation, un attaquant authentifié pourrait INSERT une row `photos`
  // pointant vers le storage d'une autre org (cf. audit P0-5 mode mission).
  if (!parsed.data.storagePath.startsWith(`${orgId}/`)) {
    return { error: "Storage path interdit : doit commencer par votre identifiant d'organisation" }
  }

  // 1. Vérifier que le dossier appartient à l'org
  const { data: dossier, error: dossierErr } = await supabase
    .from('dossiers')
    .select('id')
    .eq('id', dossierId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (dossierErr || !dossier) {
    return { error: 'Dossier introuvable ou accès refusé' }
  }

  // 2. Résolution roomId : si fourni → on vérifie qu'il appartient au dossier ;
  //    sinon si roomName fourni → match par nom (ci) ou création.
  let resolvedRoomId: string | null = parsed.data.roomId
  if (resolvedRoomId) {
    const { data: roomRow } = await supabase
      .from('dossier_rooms')
      .select('id')
      .eq('id', resolvedRoomId)
      .eq('dossier_id', dossierId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!roomRow) {
      // Le client a envoyé un roomId qui n'existe pas (UUID local jamais sync) →
      // on retombe sur la résolution par nom si possible.
      resolvedRoomId = null
    }
  }

  if (!resolvedRoomId && parsed.data.roomName) {
    // RPC atomique (migration 20260615100000) — résout case-insensitive ou crée.
    // En mode photos rafale offline, N appels parallèles avec le même roomName
    // ne créent plus N doublons grâce au UNIQUE INDEX partial (cf. audit P1-2).
    const rpc = supabase.rpc as unknown as (
      fn: 'create_or_get_dossier_room',
      args: {
        p_dossier_id: string
        p_org_id: string
        p_name: string
        p_room_type?: string | null
      },
    ) => Promise<{
      data: Array<{ id: string; position: number; name: string; created: boolean }> | null
      error: { message: string; code?: string } | null
    }>

    const { data: rpcData, error: rpcErr } = await rpc('create_or_get_dossier_room', {
      p_dossier_id: dossierId,
      p_org_id: orgId,
      p_name: parsed.data.roomName,
    })

    if (rpcErr || !rpcData || rpcData.length === 0) {
      return { error: rpcErr?.message ?? 'Résolution de pièce impossible' }
    }
    const firstRoom = rpcData[0]
    if (!firstRoom) return { error: 'Résolution de pièce impossible' }
    resolvedRoomId = firstRoom.id
  }

  // 3. Construction location PostGIS si GPS fourni
  const location =
    typeof parsed.data.gpsLng === 'number' && typeof parsed.data.gpsLat === 'number'
      ? `SRID=4326;POINT(${parsed.data.gpsLng} ${parsed.data.gpsLat})`
      : null

  // 4. vision_status = 'skipped_blurry' si floue, sinon 'pending'
  const visionStatus = parsed.data.isBlurry ? 'skipped_blurry' : 'pending'

  // 5. INSERT photos — la partition est résolue par PG via `created_at` (default now())
  const { data: photo, error } = await supabase
    .from('photos')
    .insert({
      organization_id: orgId,
      dossier_id: dossierId,
      room_id: resolvedRoomId,
      storage_path: parsed.data.storagePath,
      width: parsed.data.width,
      height: parsed.data.height,
      size_bytes: parsed.data.sizeBytes,
      mime_type: 'image/jpeg',
      taken_at: parsed.data.capturedAt,
      location,
      uploaded_by: user.id,
      sync_status: 'synced',
      // Colonnes capture_first
      perceptual_hash: parsed.data.perceptualHash.toLowerCase(),
      is_blurry: parsed.data.isBlurry,
      gps_lat: parsed.data.gpsLat ?? null,
      gps_lng: parsed.data.gpsLng ?? null,
      vision_status: visionStatus,
    })
    .select('id')
    .single()

  if (error || !photo) {
    return { error: error?.message ?? 'Insert photo failed' }
  }

  // On évite revalidatePath du dossier ici — la page mission est purement
  // client-side au-delà du SSR initial, et le hook useCapturePhotos pilotera
  // l'invalidation côté client.
  return { photoId: photo.id as string }
}

// ============================================
// createTextNoteAction — INSERT mission_text_notes (iteration 4)
// ============================================

const createTextNoteSchema = z.object({
  dossierId: z.string().uuid(),
  attachedPhotoId: z.string().uuid().nullable(),
  text: z.string().trim().min(1).max(500),
  roomId: z.string().uuid().nullable(),
})

export async function createTextNoteAction(
  dossierId: string,
  attachedPhotoId: string | null,
  text: string,
  roomId: string | null,
): Promise<{ textNoteId: string } | { error: string }> {
  const parsed = createTextNoteSchema.safeParse({ dossierId, attachedPhotoId, text, roomId })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { supabase, orgId, user } = await getCurrentUser()

  // Vérifier que le dossier appartient à l'org
  const { data: dossier, error: dossierErr } = await supabase
    .from('dossiers')
    .select('id')
    .eq('id', parsed.data.dossierId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (dossierErr || !dossier) {
    return { error: 'Dossier introuvable ou accès refusé' }
  }

  // SÉCURITÉ — Si attached_photo_id, vérifier qu'il appartient au même dossier
  // et à la même org (cf. P1-6).
  if (parsed.data.attachedPhotoId) {
    const { data: photo } = await supabase
      .from('photos')
      .select('id')
      .eq('id', parsed.data.attachedPhotoId)
      .eq('dossier_id', parsed.data.dossierId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!photo) {
      return { error: 'Photo attachée introuvable ou hors dossier' }
    }
  }

  // La table mission_text_notes n'est pas encore reflétée dans le type généré
  // Supabase (migration capture_first récente). On cast `as never` localement.
  const insertPayload = {
    organization_id: orgId,
    dossier_id: parsed.data.dossierId,
    attached_photo_id: parsed.data.attachedPhotoId,
    room_id: parsed.data.roomId,
    text: parsed.data.text,
    created_by: user.id,
  }

  const { data: row, error } = await supabase
    .from('mission_text_notes' as never)
    .insert(insertPayload as never)
    .select('id')
    .single()

  if (error || !row) {
    return { error: error?.message ?? 'Insert text note failed' }
  }

  const textRow = row as { id: string }
  return { textNoteId: textRow.id }
}

// ============================================
// createCaptureVoiceNoteAction — INSERT voice_notes après upload Storage (iteration 4)
// ============================================

const createCaptureVoiceNoteSchema = z.object({
  dossierId: z.string().uuid(),
  attachedPhotoId: z.string().uuid().nullable(),
  storagePath: z.string().min(5),
  durationSeconds: z.coerce.number().int().min(0).max(60),
  roomId: z.string().uuid().nullable(),
})

export async function createCaptureVoiceNoteAction(
  dossierId: string,
  attachedPhotoId: string | null,
  storagePath: string,
  durationSeconds: number,
  roomId: string | null,
): Promise<{ voiceNoteId: string } | { error: string }> {
  const parsed = createCaptureVoiceNoteSchema.safeParse({
    dossierId,
    attachedPhotoId,
    storagePath,
    durationSeconds,
    roomId,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { supabase, orgId, user } = await getCurrentUser()

  // SÉCURITÉ — Même validation préfix que uploadCapturePhotoAction (cf. P0-6).
  if (!parsed.data.storagePath.startsWith(`${orgId}/`)) {
    return { error: "Storage path interdit : doit commencer par votre identifiant d'organisation" }
  }

  // Vérifier accès dossier
  const { data: dossier, error: dossierErr } = await supabase
    .from('dossiers')
    .select('id')
    .eq('id', parsed.data.dossierId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (dossierErr || !dossier) {
    return { error: 'Dossier introuvable ou accès refusé' }
  }

  // SÉCURITÉ — Si attached_photo_id, vérifier qu'il appartient au même dossier
  // et à la même org (cf. P1-6).
  if (parsed.data.attachedPhotoId) {
    const { data: photo } = await supabase
      .from('photos')
      .select('id')
      .eq('id', parsed.data.attachedPhotoId)
      .eq('dossier_id', parsed.data.dossierId)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (!photo) {
      return { error: 'Photo attachée introuvable ou hors dossier' }
    }
  }

  // attached_photo_id et transcription_status sont ajoutés par la migration
  // capture_first (pas dans le type généré) → cast `as never`.
  const insertPayload = {
    dossier_id: parsed.data.dossierId,
    organization_id: orgId,
    room_id: parsed.data.roomId,
    storage_path: parsed.data.storagePath,
    duration_seconds: parsed.data.durationSeconds,
    language: 'fr',
    provider: 'openai_whisper',
    status: 'pending', // legacy field — pipeline classique
    transcription_status: 'pending', // mode capture-first
    attached_photo_id: parsed.data.attachedPhotoId,
    recorded_by: user.id,
  }

  const { data: row, error } = await supabase
    .from('voice_notes')
    .insert(insertPayload as never)
    .select('id')
    .single()

  if (error || !row) {
    return { error: error?.message ?? 'Insert voice note failed' }
  }

  return { voiceNoteId: row.id as string }
}
