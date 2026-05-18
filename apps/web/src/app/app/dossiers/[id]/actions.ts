'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/current-user'

// ============================================
// Dossier rooms (anciennement mission_rooms)
// ============================================

const ROOM_TYPES = [
  'salon', 'sejour', 'cuisine', 'chambre', 'salle_de_bain', 'wc',
  'entree', 'couloir', 'buanderie', 'cave', 'grenier', 'garage', 'balcon',
  'terrasse', 'autre',
] as const

const roomSchema = z.object({
  dossierId: z.string().uuid(),
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
    dossierId: formData.get('dossierId'),
    name: formData.get('name'),
    roomType: formData.get('roomType') || undefined,
    surfaceM2: formData.get('surfaceM2') || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  const { supabase, orgId } = await getCurrentUser()

  const { count } = await supabase
    .from('dossier_rooms')
    .select('*', { count: 'exact', head: true })
    .eq('dossier_id', parsed.data.dossierId)
    .eq('organization_id', orgId)

  const { error } = await supabase.from('dossier_rooms').insert({
    dossier_id: parsed.data.dossierId,
    organization_id: orgId,
    name: parsed.data.name,
    room_type: parsed.data.roomType ?? null,
    surface_m2: parsed.data.surfaceM2 ?? null,
    position: count ?? 0,
  })

  if (error) return { error: error.message }

  revalidatePath(`/app/dossiers/${parsed.data.dossierId}`)
  return undefined
}

export async function deleteRoomAction(dossierId: string, roomId: string) {
  const { supabase, orgId } = await getCurrentUser()
  const { error } = await supabase
    .from('dossier_rooms')
    .delete()
    .eq('id', roomId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/dossiers/${dossierId}`)
}

export async function applyRoomTemplateAction(dossierId: string, templateId: string) {
  const { ROOM_TEMPLATES } = await import('@/lib/room-templates')
  const template = ROOM_TEMPLATES.find((t) => t.id === templateId)
  if (!template) throw new Error(`Template inconnu: ${templateId}`)

  const { supabase, orgId } = await getCurrentUser()

  const { count } = await supabase
    .from('dossier_rooms')
    .select('*', { count: 'exact', head: true })
    .eq('dossier_id', dossierId)
    .eq('organization_id', orgId)
  const startPosition = count ?? 0

  const rows = template.rooms.map((r, i) => ({
    dossier_id: dossierId,
    organization_id: orgId,
    name: r.name,
    room_type: r.room_type,
    position: startPosition + i,
  }))

  const { error } = await supabase.from('dossier_rooms').insert(rows)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/dossiers/${dossierId}`)
}

// ============================================
// Photos
// ============================================

const photoSchema = z.object({
  dossierId: z.string().uuid(),
  roomId: z.string().uuid().optional().or(z.literal('')),
  storagePath: z.string().min(5),
  width: z.coerce.number().int().min(1),
  height: z.coerce.number().int().min(1),
  sizeBytes: z.coerce.number().int().min(1),
  mimeType: z.string().min(3).max(50),
  caption: z.string().max(500).optional().or(z.literal('')),
  viewType: z.string().max(50).optional().or(z.literal('')),
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
      dossier_id: parsed.data.dossierId,
      room_id: parsed.data.roomId || null,
      storage_path: parsed.data.storagePath,
      width: parsed.data.width,
      height: parsed.data.height,
      size_bytes: parsed.data.sizeBytes,
      mime_type: parsed.data.mimeType,
      caption: parsed.data.caption || null,
      view_type: parsed.data.viewType || null,
      location,
      taken_at: parsed.data.takenAt || null,
      uploaded_by: user.id,
      sync_status: 'synced',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/app/dossiers/${parsed.data.dossierId}`)
  return { id: data.id }
}

export async function deletePhotoAction(dossierId: string, photoId: string, storagePath: string) {
  const { supabase, orgId } = await getCurrentUser()

  await supabase.storage.from('mission-photos').remove([storagePath])

  const { error } = await supabase
    .from('photos')
    .delete()
    .eq('id', photoId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
  revalidatePath(`/app/dossiers/${dossierId}`)
}

export async function assignPhotoToRoomAction(
  dossierId: string,
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
  revalidatePath(`/app/dossiers/${dossierId}`)
}

// ============================================
// Voice notes
// ============================================

const voiceNoteSchema = z.object({
  dossierId: z.string().uuid(),
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
      dossier_id: parsed.data.dossierId,
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
  revalidatePath(`/app/dossiers/${parsed.data.dossierId}`)
  return { id: data.id }
}

export async function deleteVoiceNoteAction(dossierId: string, voiceNoteId: string, storagePath: string) {
  const { supabase, orgId } = await getCurrentUser()
  await supabase.storage.from('voice-notes').remove([storagePath])
  const { error } = await supabase
    .from('voice_notes')
    .delete()
    .eq('id', voiceNoteId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/dossiers/${dossierId}`)
}

// ============================================
// Lien public upload client (sur dossier)
// ============================================

function randomToken(length = 24): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  for (const b of bytes) out += chars[b % chars.length]
  return out
}

export async function generateClientUploadLinkAction(dossierId: string) {
  const { supabase, orgId } = await getCurrentUser()
  const token = randomToken(24)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('dossiers')
    .update({ client_upload_token: token, client_upload_expires_at: expiresAt })
    .eq('id', dossierId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
  revalidatePath(`/app/dossiers/${dossierId}`)
  return { token, expiresAt }
}

export async function revokeClientUploadLinkAction(dossierId: string) {
  const { supabase, orgId } = await getCurrentUser()
  const { error } = await supabase
    .from('dossiers')
    .update({ client_upload_token: null, client_upload_expires_at: null })
    .eq('id', dossierId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/dossiers/${dossierId}`)
}

export async function toggleDocumentReviewedAction(
  dossierId: string,
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
  revalidatePath(`/app/dossiers/${dossierId}`)
}

/**
 * Importe les valeurs extraites d'un document dans le bien / les missions du dossier.
 * Le user choisit explicitement quelles valeurs importer (UI checkboxes).
 * On n'écrase JAMAIS automatiquement — seules les colonnes nulles sont remplies.
 */
export async function importExtractedDataAction(
  dossierId: string,
  documentId: string,
  selectedTargets: string[],
) {
  const { supabase, orgId } = await getCurrentUser()

  // Récupère le doc + ses données extraites
  const { data: doc } = await supabase
    .from('owner_documents')
    .select('extracted_data')
    .eq('id', documentId)
    .eq('organization_id', orgId)
    .single()

  if (!doc?.extracted_data) throw new Error('Aucune donnée extraite pour ce document')

  const suggestions = (
    (doc.extracted_data as Record<string, unknown>).suggested_imports as
      | { target: string; value: string | number | null }[]
      | undefined
  ) ?? []

  // Récupère le property_id depuis le dossier
  const { data: dossier } = await supabase
    .from('dossiers')
    .select('property_id, missions(id, type)')
    .eq('id', dossierId)
    .eq('organization_id', orgId)
    .single()

  if (!dossier?.property_id) throw new Error('Dossier sans bien rattaché')

  // Sépare property.* / mission.*
  const propertyUpdates: Record<string, string | number | null> = {}
  const missionUpdates: Record<string, string | number | null> = {}

  for (const sug of suggestions) {
    if (!selectedTargets.includes(sug.target)) continue
    if (sug.value === null || sug.value === undefined) continue
    if (sug.target.startsWith('property.')) {
      const col = sug.target.slice('property.'.length)
      propertyUpdates[col] = sug.value
    } else if (sug.target.startsWith('mission.')) {
      const col = sug.target.slice('mission.'.length)
      missionUpdates[col] = sug.value
    }
  }

  // Apply property updates (only on null columns, ne pas ecraser)
  if (Object.keys(propertyUpdates).length > 0) {
    const { data: current } = await supabase
      .from('properties')
      .select('*')
      .eq('id', dossier.property_id)
      .single()

    // Garde uniquement les champs encore nuls
    const safePropUpdates: Record<string, string | number> = {}
    for (const [col, val] of Object.entries(propertyUpdates)) {
      if (current && (current as Record<string, unknown>)[col] == null) {
        safePropUpdates[col] = val as string | number
      }
    }

    if (Object.keys(safePropUpdates).length > 0) {
      await supabase
        .from('properties')
        .update(safePropUpdates as never)
        .eq('id', dossier.property_id)
        .eq('organization_id', orgId)
    }
  }

  // Apply mission updates : on cible les missions DPE du dossier
  if (Object.keys(missionUpdates).length > 0) {
    const dpeMissions = ((dossier.missions ?? []) as { id: string; type: string }[]).filter((m) =>
      m.type.startsWith('dpe_') || m.type === 'copropriete',
    )

    for (const m of dpeMissions) {
      await supabase
        .from('missions')
        .update(missionUpdates as never)
        .eq('id', m.id)
        .eq('organization_id', orgId)
    }
  }

  revalidatePath(`/app/dossiers/${dossierId}`)
}

export async function deleteOwnerDocumentAction(
  dossierId: string,
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
  revalidatePath(`/app/dossiers/${dossierId}`)
}

// ============================================
// Mission status transitions (par diag dans le dossier)
// ============================================

const MISSION_STATUSES = [
  'draft', 'scheduled', 'in_progress', 'to_review', 'done', 'exported', 'archived', 'cancelled',
] as const
type MissionStatus = (typeof MISSION_STATUSES)[number]

/**
 * Reprendre un diagnostic — passe en 'in_progress' depuis 'scheduled' ou 'to_review',
 * stamp started_at si pas déjà fait. Redirige vers la card focus.
 */
export async function resumeMissionAction(missionId: string) {
  const { supabase, orgId } = await getCurrentUser()
  const now = new Date().toISOString()

  // Récupère le statut actuel + dossier_id pour le redirect
  const { data: current } = await supabase
    .from('missions')
    .select('status, dossier_id')
    .eq('id', missionId)
    .eq('organization_id', orgId)
    .single()

  if (!current) throw new Error('Mission introuvable')

  const finalStates: MissionStatus[] = ['done', 'exported', 'archived', 'cancelled']
  const newStatus: MissionStatus = finalStates.includes(current.status as MissionStatus)
    ? (current.status as MissionStatus)
    : 'in_progress'

  const { error } = await supabase
    .from('missions')
    .update({ status: newStatus })
    .eq('id', missionId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)

  // Active aussi le dossier en 'on_site' si pas déjà engagé
  await supabase
    .from('dossiers')
    .update({ status: 'on_site', started_at: now })
    .eq('id', current.dossier_id)
    .eq('organization_id', orgId)
    .in('status', ['draft', 'scheduled'])

  revalidatePath(`/app/dossiers/${current.dossier_id}`)
  revalidatePath('/app/dossiers')
  revalidatePath('/app/dashboard')
}

export async function updateMissionStatusAction(missionId: string, newStatus: MissionStatus) {
  if (!MISSION_STATUSES.includes(newStatus)) {
    throw new Error(`Statut invalide: ${newStatus}`)
  }
  const { supabase, orgId } = await getCurrentUser()

  const now = new Date().toISOString()
  const updates: { status: MissionStatus; completed_at?: string } = { status: newStatus }
  if (newStatus === 'done') updates.completed_at = now

  const { data: updated, error } = await supabase
    .from('missions')
    .update(updates)
    .eq('id', missionId)
    .eq('organization_id', orgId)
    .select('dossier_id')
    .single()

  if (error) throw new Error(error.message)
  if (updated?.dossier_id) revalidatePath(`/app/dossiers/${updated.dossier_id}`)
  revalidatePath('/app/dossiers')
  revalidatePath('/app/dashboard')
}

// ============================================
// Dossier status (workflow global)
// ============================================

const DOSSIER_STATUSES = [
  'draft', 'scheduled', 'on_site', 'back_office', 'done', 'archived', 'cancelled',
] as const
type DossierStatus = (typeof DOSSIER_STATUSES)[number]

export async function updateDossierStatusAction(dossierId: string, newStatus: DossierStatus) {
  if (!DOSSIER_STATUSES.includes(newStatus)) {
    throw new Error(`Statut dossier invalide: ${newStatus}`)
  }
  const { supabase, orgId } = await getCurrentUser()

  const now = new Date().toISOString()
  const updates: { status: DossierStatus; started_at?: string; completed_at?: string } = {
    status: newStatus,
  }
  if (newStatus === 'on_site') updates.started_at = now
  if (newStatus === 'done') updates.completed_at = now

  const { error } = await supabase
    .from('dossiers')
    .update(updates)
    .eq('id', dossierId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
  revalidatePath(`/app/dossiers/${dossierId}`)
  revalidatePath('/app/dossiers')
}

// ============================================
// Check-list par mission (sub-checklist d'un diag spécifique)
// ============================================

export async function toggleChecklistItemAction(
  missionId: string,
  itemId: string,
  checked: boolean,
) {
  const { supabase, orgId } = await getCurrentUser()

  const { data: current } = await supabase
    .from('missions')
    .select('metadata, dossier_id')
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
  if (current?.dossier_id) revalidatePath(`/app/dossiers/${current.dossier_id}`)
}

// ============================================
// Workflow stepper (items du dossier, étapes guidées)
// ============================================

/**
 * Toggle un item manuel de la matrice room×diag (vue "par pièce").
 * Persisté dans dossier.metadata.roomTasksState
 */
export async function toggleRoomTaskAction(
  dossierId: string,
  itemId: string,
  checked: boolean,
) {
  const { supabase, orgId } = await getCurrentUser()

  const { data: current } = await supabase
    .from('dossiers')
    .select('metadata')
    .eq('id', dossierId)
    .eq('organization_id', orgId)
    .single()

  const meta = (current?.metadata as Record<string, unknown> | null) ?? {}
  const roomTasks = (meta.roomTasksState as Record<string, boolean> | undefined) ?? {}
  roomTasks[itemId] = checked
  meta.roomTasksState = roomTasks

  const { error } = await supabase
    .from('dossiers')
    .update({ metadata: meta as never })
    .eq('id', dossierId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
  revalidatePath(`/app/dossiers/${dossierId}`)
}

/**
 * Persiste la préférence de vue (par pièce / par diag) côté dossier.
 */
export async function setDossierViewPreferenceAction(dossierId: string, view: 'rooms' | 'diags') {
  const { supabase, orgId } = await getCurrentUser()
  const { data: current } = await supabase
    .from('dossiers')
    .select('metadata')
    .eq('id', dossierId)
    .eq('organization_id', orgId)
    .single()
  const meta = (current?.metadata as Record<string, unknown> | null) ?? {}
  meta.viewPreference = view

  const { error } = await supabase
    .from('dossiers')
    .update({ metadata: meta as never })
    .eq('id', dossierId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath(`/app/dossiers/${dossierId}`)
}

/**
 * Édite les meta-infos du dossier (date prévue, notes, client).
 */
export async function updateDossierInfoAction(
  dossierId: string,
  updates: { scheduled_at?: string | null; notes?: string | null; client_id?: string | null },
) {
  const { supabase, orgId } = await getCurrentUser()
  const patch: Record<string, unknown> = {}
  if (updates.scheduled_at !== undefined) {
    patch.scheduled_at = updates.scheduled_at ? new Date(updates.scheduled_at).toISOString() : null
  }
  if (updates.notes !== undefined) patch.notes = updates.notes || null
  if (updates.client_id !== undefined) patch.client_id = updates.client_id || null

  const { error } = await supabase
    .from('dossiers')
    .update(patch as never)
    .eq('id', dossierId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
  revalidatePath(`/app/dossiers/${dossierId}`)
}

/**
 * Ajoute un diagnostic (mission) à un dossier existant.
 */
const ALL_MISSION_TYPES = [
  'dpe_vente', 'dpe_location', 'copropriete',
  'amiante_vente', 'amiante_avant_travaux',
  'plomb_crep', 'gaz', 'electricite', 'termites', 'carrez_boutin', 'erp',
] as const
type AnyMissionType = (typeof ALL_MISSION_TYPES)[number]

export async function addMissionToDossierAction(dossierId: string, type: string) {
  if (!ALL_MISSION_TYPES.includes(type as AnyMissionType)) {
    throw new Error(`Type de diagnostic invalide : ${type}`)
  }
  const { supabase, orgId, user } = await getCurrentUser()

  const { data: refData, error: refErr } = await supabase.rpc('next_reference', {
    p_org: orgId,
    p_kind: 'mission',
  })
  if (refErr) throw new Error(refErr.message)

  const { error } = await supabase.from('missions').insert({
    organization_id: orgId,
    dossier_id: dossierId,
    type: type as AnyMissionType,
    reference: refData as string,
    status: 'draft',
    created_by: user.id,
    assigned_to: user.id,
  })

  if (error) throw new Error(error.message)
  revalidatePath(`/app/dossiers/${dossierId}`)
}

/**
 * Retire (soft-delete) un diagnostic du dossier.
 */
export async function removeMissionFromDossierAction(missionId: string) {
  const { supabase, orgId } = await getCurrentUser()
  const { data: m } = await supabase
    .from('missions')
    .select('dossier_id')
    .eq('id', missionId)
    .eq('organization_id', orgId)
    .single()

  const { error } = await supabase
    .from('missions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', missionId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
  if (m?.dossier_id) revalidatePath(`/app/dossiers/${m.dossier_id}`)
}

/**
 * Édite une pièce (nom, type, surface).
 */
export async function updateRoomAction(
  roomId: string,
  updates: { name?: string; room_type?: string | null; surface_m2?: number | null },
) {
  const { supabase, orgId } = await getCurrentUser()
  const { data: room } = await supabase
    .from('dossier_rooms')
    .select('dossier_id')
    .eq('id', roomId)
    .eq('organization_id', orgId)
    .single()

  const patch: Record<string, unknown> = {}
  if (updates.name !== undefined) patch.name = updates.name
  if (updates.room_type !== undefined) patch.room_type = updates.room_type || null
  if (updates.surface_m2 !== undefined) patch.surface_m2 = updates.surface_m2 ?? null

  const { error } = await supabase
    .from('dossier_rooms')
    .update(patch as never)
    .eq('id', roomId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
  if (room?.dossier_id) revalidatePath(`/app/dossiers/${room.dossier_id}`)
}

export async function toggleDossierStepItemAction(
  dossierId: string,
  itemId: string,
  checked: boolean,
) {
  const { supabase, orgId } = await getCurrentUser()

  const { data: current } = await supabase
    .from('dossiers')
    .select('metadata')
    .eq('id', dossierId)
    .eq('organization_id', orgId)
    .single()

  const meta = (current?.metadata as Record<string, unknown> | null) ?? {}
  const steps = (meta.workflowSteps as Record<string, boolean> | undefined) ?? {}
  steps[itemId] = checked
  meta.workflowSteps = steps

  const { error } = await supabase
    .from('dossiers')
    .update({ metadata: meta as never })
    .eq('id', dossierId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
  revalidatePath(`/app/dossiers/${dossierId}`)
}
