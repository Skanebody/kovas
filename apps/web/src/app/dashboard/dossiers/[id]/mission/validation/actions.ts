'use server'

/**
 * KOVAS — Server actions de la page Validation mission (MISSION-D).
 *
 * - triggerProcessMissionPayloadAction : déclenche l'Edge Function de sync background.
 * - updateRoom3CLDataAction : MAJ inline d'un champ 3CL (passe en source='user_corrected').
 * - exportToLicielAction : génère le XML 3CL + crée dossier_exports + retourne URL/blob.
 *
 * Authority : CLAUDE.md §3 feature 9 (export multi-format).
 *
 * Note: les nouvelles tables (mission_rooms_3cl_data, vision_analysis_cache) ne sont
 * pas encore régénérées dans `@kovas/database/types` — utilisation de casts ciblés
 * `(... as unknown as { ... })` localement, le temps de la régen DEPLOY-4.
 */

import { type BuildingGlobals3CL, type Room3CLData, buildXml3CL } from '@/lib/3cl/xml-3cl-builder'
import { analyzeEquipmentPhoto } from '@/lib/algos/vision-equipment'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
// Secret d'invocation Edge Function — DOIT être différent de SERVICE_ROLE_KEY.
// L'Edge Function `process-mission-payload` vérifie ce secret en début de handler.
// Fallback dev : on tombe sur SERVICE_ROLE_KEY pour permettre les tests locaux
// mais en prod le secret distinct DOIT être set (cf. audit P0-1 mode mission).
const EDGE_INVOKE_SECRET =
  process.env.MISSION_PAYLOAD_INVOKE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// Client admin non typé — utilisé pour accéder aux nouvelles tables non encore
// présentes dans `@kovas/database/types` (régen DEPLOY-4).
function adminClient() {
  return createAdminClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

interface MissionSessionRow {
  id: string
  dossier_id: string
  organization_id: string
  created_by: string | null
  dossiers?: {
    reference: string
    properties?: {
      year_built: number | null
      surface_total: number | null
      surface_carrez: number | null
      property_type: string | null
      address: string | null
      postal_code: string | null
      city: string | null
    } | null
  } | null
}

// ============================================
// rooms_state — vérité terrain validée par le diagnostiqueur
// ============================================
// Format consommé par l'Edge Function `process-mission-payload` (champ
// `rooms_state`). Quand `source === 'mission_capture'` ET `rooms` est non vide,
// l'Edge Function traite ces pièces + items comme la VÉRITÉ TERRAIN confirmée :
// elle ne réinvente/renomme/supprime aucune pièce et n'utilise transcript/vision
// QUE pour enrichir les champs 3CL manquants. Cf. CLAUDE.md §3 feature 1.

interface RoomStateItem {
  label: string
  data: Record<string, unknown>
}

interface RoomState {
  name: string
  room_type: string | null
  surface_sqm: number | null
  ceiling_height_m: number | null
  floor: number | null
  features: string[]
  items: {
    equipment: RoomStateItem[]
    observation: RoomStateItem[]
    measurement: RoomStateItem[]
  }
}

interface RoomsState {
  rooms: RoomState[]
  source: 'mission_capture'
}

// Lignes DB minimales nécessaires à l'agrégation. Les nouvelles tables ne sont
// pas encore régénérées dans `@kovas/database/types` (régen DEPLOY-4) — on type
// localement le strict nécessaire.
interface DossierRoomRow {
  id: string
  name: string
  room_type: string | null
  surface_m2: number | null
  ceiling_height_m: number | null
}

interface RoomItemRow {
  dossier_room_id: string
  kind: 'equipment' | 'observation' | 'measurement' | string
  label: string
  data: Record<string, unknown> | null
}

interface RoomCaptureRow {
  capture_type: string
  data: Record<string, unknown> | null
}

/**
 * Agrège les pièces réelles du dossier (`dossier_rooms`), leurs éléments
 * (`mission_room_items`) et les captures pièce du tchat (`mission_session_captures`
 * type='room', porteuses de floor/features dictés) en un `rooms_state` structuré.
 *
 * Best-effort : si aucune pièce n'est trouvée (mission 100% vocale sans capture
 * structurée), retourne `null` → l'appelant retombe sur le comportement historique
 * (rooms_state minimal, déduction IA depuis le transcript). Ne casse pas l'existant.
 */
async function buildRoomsStateFromCaptures(
  admin: ReturnType<typeof adminClient>,
  dossierId: string,
  missionSessionId: string,
): Promise<RoomsState | null> {
  // 1. Pièces réelles du dossier (non supprimées) = source de vérité de la liste.
  const roomsTable = admin.from('dossier_rooms') as unknown as {
    select: (q: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        is: (
          k: string,
          v: null,
        ) => {
          order: (
            k: string,
            o: { ascending: boolean },
          ) => Promise<{ data: DossierRoomRow[] | null }>
        }
      }
    }
  }
  const { data: rooms } = await roomsTable
    .select('id, name, room_type, surface_m2, ceiling_height_m')
    .eq('dossier_id', dossierId)
    .is('deleted_at', null)
    .order('position', { ascending: true })

  if (!rooms || rooms.length === 0) return null

  const roomIds = rooms.map((r) => r.id)

  // 2. Éléments capturés/corrigés par pièce (équipements / observations / mesures).
  const itemsTable = admin.from('mission_room_items') as unknown as {
    select: (q: string) => {
      in: (
        k: string,
        v: string[],
      ) => {
        is: (k: string, v: null) => Promise<{ data: RoomItemRow[] | null }>
      }
    }
  }
  const { data: items } = await itemsTable
    .select('dossier_room_id, kind, label, data')
    .in('dossier_room_id', roomIds)
    .is('deleted_at', null)

  // 3. Captures pièce du tchat — portent floor/features dictés non stockés sur
  //    dossier_rooms. On les indexe par nom de pièce (normalisé) pour enrichir.
  const capturesTable = admin.from('mission_session_captures') as unknown as {
    select: (q: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        eq: (k: string, v: string) => Promise<{ data: RoomCaptureRow[] | null }>
      }
    }
  }
  const { data: roomCaptures } = await capturesTable
    .select('capture_type, data')
    .eq('session_id', missionSessionId)
    .eq('capture_type', 'room')

  // Map nom de pièce normalisé → { floor, features, surface } issue des captures.
  const captureByName = new Map<
    string,
    { floor: number | null; features: string[]; surface: number | null }
  >()
  for (const cap of roomCaptures ?? []) {
    const d = cap.data ?? {}
    const name = typeof d.name === 'string' ? d.name.trim().toLowerCase() : null
    if (!name) continue
    const floor = typeof d.floor === 'number' ? d.floor : null
    const surface = typeof d.surface === 'number' ? d.surface : null
    const features = Array.isArray(d.features)
      ? d.features.filter((f): f is string => typeof f === 'string')
      : typeof d.features === 'string'
        ? [d.features]
        : []
    captureByName.set(name, { floor, features, surface })
  }

  // Index items par pièce.
  const itemsByRoom = new Map<string, RoomItemRow[]>()
  for (const it of items ?? []) {
    const arr = itemsByRoom.get(it.dossier_room_id) ?? []
    arr.push(it)
    itemsByRoom.set(it.dossier_room_id, arr)
  }

  const roomsStateRooms: RoomState[] = rooms.map((room) => {
    const cap = captureByName.get(room.name.trim().toLowerCase())
    const roomItems = itemsByRoom.get(room.id) ?? []

    const equipment: RoomStateItem[] = []
    const observation: RoomStateItem[] = []
    const measurement: RoomStateItem[] = []
    for (const it of roomItems) {
      const entry: RoomStateItem = { label: it.label, data: it.data ?? {} }
      if (it.kind === 'equipment') equipment.push(entry)
      else if (it.kind === 'observation') observation.push(entry)
      else if (it.kind === 'measurement') measurement.push(entry)
    }

    return {
      name: room.name,
      room_type: room.room_type,
      // La surface stockée sur la pièce prime ; à défaut la dernière capture vocale.
      surface_sqm: room.surface_m2 ?? cap?.surface ?? null,
      ceiling_height_m: room.ceiling_height_m,
      floor: cap?.floor ?? null,
      features: cap?.features ?? [],
      items: { equipment, observation, measurement },
    }
  })

  return { rooms: roomsStateRooms, source: 'mission_capture' }
}

// ============================================
// 1. triggerProcessMissionPayloadAction
// ============================================

export async function triggerProcessMissionPayloadAction(
  missionSessionId: string,
): Promise<{ ok: true } | { error: string }> {
  const { orgId } = await getCurrentUser()
  const admin = adminClient()

  const { data: sessionRaw } = await (
    admin.from('mission_sessions') as unknown as {
      select: (q: string) => {
        eq: (k: string, v: string) => { single: () => Promise<{ data: MissionSessionRow | null }> }
      }
    }
  )
    .select('id, organization_id, dossier_id')
    .eq('id', missionSessionId)
    .single()
  const session = sessionRaw as MissionSessionRow | null

  if (!session || session.organization_id !== orgId) {
    return { error: 'Session introuvable ou accès refusé' }
  }

  // Charger les photos pour les passer en payload
  const photosTable = admin.from('photos') as unknown as {
    select: (q: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        limit: (n: number) => Promise<{
          data: Array<{
            id: string
            storage_path: string
            room_id: string | null
            perceptual_hash: string | null
          }> | null
        }>
      }
    }
  }
  const { data: photos } = await photosTable
    .select('id, storage_path, room_id, perceptual_hash')
    .eq('dossier_id', session.dossier_id)
    .limit(200)

  const voiceTable = admin.from('voice_notes') as unknown as {
    select: (q: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        limit: (
          n: number,
        ) => Promise<{ data: Array<{ id: string; transcript_text: string | null }> | null }>
      }
    }
  }
  const { data: voiceNotes } = await voiceTable
    .select('id, transcript_text')
    .eq('dossier_id', session.dossier_id)
    .limit(50)

  // Mark queued
  await (
    admin.from('mission_sessions') as unknown as {
      update: (p: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<unknown> }
    }
  )
    .update({ sync_status: 'queued', last_sync_attempt: new Date().toISOString() })
    .eq('id', missionSessionId)

  const transcriptText = (voiceNotes ?? [])
    .map((v) => v.transcript_text ?? '')
    .filter(Boolean)
    .join('\n')

  // VÉRITÉ TERRAIN : agréger les pièces + éléments capturés/corrigés par le
  // diagnostiqueur dans le tchat. Si présents, ils deviennent la source de vérité
  // de l'export (l'Edge Function ne re-déduit plus tout depuis l'audio brut).
  // Best-effort : null si mission 100% vocale sans capture structurée → l'Edge
  // Function retombe sur la déduction IA (comportement historique préservé).
  let roomsState: RoomsState | Record<string, never> = {}
  try {
    const built = await buildRoomsStateFromCaptures(admin, session.dossier_id, missionSessionId)
    if (built) roomsState = built
  } catch (err) {
    // Ne JAMAIS bloquer la sync sur l'agrégation : on log et on retombe sur {}.
    console.error('buildRoomsStateFromCaptures failed', err)
  }

  const url = `${SUPABASE_URL}/functions/v1/process-mission-payload`
  // SÉCURITÉ — On utilise MISSION_PAYLOAD_INVOKE_SECRET et NON le service_role_key.
  // L'Edge Function vérifie ce header dédié en début de handler. Si le secret est
  // accidentellement loggé, l'exposition est limitée à l'invocation de cette
  // Edge Function (et non à l'admin total Postgres). Cf. audit P0-1 mode mission.
  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EDGE_INVOKE_SECRET}`,
      'X-Invoke-Source': 'mission-payload-trigger',
    },
    body: JSON.stringify({
      mission_session_id: missionSessionId,
      transcript_text: transcriptText,
      vocal_audio_urls: [],
      photos: (photos ?? []).map((p) => ({
        id: p.id,
        storage_path: p.storage_path,
        room_id: p.room_id,
        perceptual_hash: p.perceptual_hash,
      })),
      rooms_state: roomsState,
      checklist_3cl_state: {},
    }),
  }).catch((err: unknown) => {
    console.error('process-mission-payload trigger failed', err)
  })

  revalidatePath(`/dashboard/dossiers/${session.dossier_id}`)
  return { ok: true }
}

// ============================================
// 2. updateRoom3CLDataAction
// ============================================

const updateRoom3CLSchema = z.object({
  rowId: z.string().uuid(),
  patch: z.record(z.unknown()),
})

export async function updateRoom3CLDataAction(
  rowId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: true } | { error: string }> {
  const parsed = updateRoom3CLSchema.safeParse({ rowId, patch })
  if (!parsed.success) return { error: 'Input invalide' }

  const { user, orgId } = await getCurrentUser()
  const admin = adminClient()

  // SÉCURITÉ — Charger la row + joindre mission_sessions pour vérifier ownership
  // via organization_id (cf. audit P0-2). Sans ce check, l'adminClient bypass RLS
  // permettrait à n'importe quel user authentifié de modifier n'importe quelle row 3CL.
  const tbl = admin.from('mission_rooms_3cl_data') as unknown as {
    select: (q: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        single: () => Promise<{
          data: {
            id: string
            data_3cl: Record<string, unknown>
            mission_session_id: string
            mission_sessions: { organization_id: string } | { organization_id: string }[] | null
          } | null
        }>
      }
    }
    update: (p: Record<string, unknown>) => {
      eq: (
        k: string,
        v: string,
      ) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>
      }
    }
  }

  const { data: existing } = await tbl
    .select('id, data_3cl, mission_session_id, mission_sessions!inner(organization_id)')
    .eq('id', rowId)
    .single()
  if (!existing) return { error: 'Pièce introuvable' }

  const session = Array.isArray(existing.mission_sessions)
    ? existing.mission_sessions[0]
    : existing.mission_sessions
  if (!session || session.organization_id !== orgId) {
    // On retourne le même message que "introuvable" pour ne pas leaker l'existence
    // de rows d'autres orgs (defense-in-depth : éviter le timing oracle).
    return { error: 'Pièce introuvable' }
  }

  const mergedData = {
    ...(existing.data_3cl ?? {}),
    ...patch,
  }

  // L'UPDATE inclut un second .eq sur mission_session_id pour refuser silencieusement
  // toute race condition où la row aurait changé d'org entre le SELECT et l'UPDATE.
  const { error } = await tbl
    .update({
      data_3cl: mergedData,
      source: 'user_corrected',
      validated_by_user: true,
      validated_at: new Date().toISOString(),
      validated_by: user.id,
    })
    .eq('id', rowId)
    .eq('mission_session_id', existing.mission_session_id)

  if (error) return { error: error.message }

  return { ok: true }
}

// ============================================
// 3. exportToLicielAction (génère XML 3CL + dossier_exports)
// ============================================

export async function exportToLicielAction(
  missionSessionId: string,
): Promise<
  { ok: true; exportId: string; storagePath: string; warnings: string[] } | { error: string }
> {
  const { orgId, user } = await getCurrentUser()
  const admin = adminClient()

  const sessTable = admin.from('mission_sessions') as unknown as {
    select: (q: string) => {
      eq: (k: string, v: string) => { single: () => Promise<{ data: MissionSessionRow | null }> }
    }
  }

  const { data: session } = await sessTable
    .select(
      'id, dossier_id, organization_id, dossiers(reference, properties(year_built, surface_total, surface_carrez, property_type, address, postal_code, city))',
    )
    .eq('id', missionSessionId)
    .single()

  if (!session || session.organization_id !== orgId) {
    return { error: 'Session introuvable ou accès refusé' }
  }

  const dossier = Array.isArray((session as MissionSessionRow).dossiers)
    ? (session as unknown as { dossiers: MissionSessionRow['dossiers'][] }).dossiers[0]
    : session.dossiers
  const propsField = dossier?.properties
  const prop = Array.isArray(propsField) ? propsField[0] : propsField

  const roomsTbl = admin.from('mission_rooms_3cl_data') as unknown as {
    select: (q: string) => {
      eq: (
        k: string,
        v: string,
      ) => Promise<{
        data: Array<{
          room_name: string
          room_type: string | null
          surface_sqm: number | null
          ceiling_height_m: number | null
          orientation: string | null
          data_3cl: Record<string, unknown>
          ai_confidence_score: number | null
          source: string
          validated_by_user: boolean
        }> | null
      }>
    }
  }

  const { data: roomsRows } = await roomsTbl
    .select(
      'room_name, room_type, surface_sqm, ceiling_height_m, orientation, data_3cl, ai_confidence_score, source, validated_by_user',
    )
    .eq('mission_session_id', missionSessionId)

  const rooms: Room3CLData[] = (roomsRows ?? []).map((r) => ({
    room_name: r.room_name,
    room_type: r.room_type,
    surface_sqm: r.surface_sqm,
    ceiling_height_m: r.ceiling_height_m,
    orientation: r.orientation,
    data_3cl: r.data_3cl as Room3CLData['data_3cl'],
    ai_confidence_score: r.ai_confidence_score,
    source: r.source as Room3CLData['source'],
    validated_by_user: r.validated_by_user,
  }))

  const globals: BuildingGlobals3CL = {
    reference: dossier?.reference ?? `MS-${missionSessionId.slice(0, 8)}`,
    type_mission: 'vente',
    date_visite: new Date().toISOString(),
    annee_construction: prop?.year_built ?? null,
    surface_habitable: prop?.surface_total ?? null,
    surface_carrez: prop?.surface_carrez ?? null,
    property_type: prop?.property_type ?? null,
    postal_code: prop?.postal_code ?? null,
    city: prop?.city ?? null,
    address: prop?.address ?? null,
    heating_system_main: null,
    heating_system_secondary: null,
    ecs_system: null,
    ventilation_global: null,
  }

  const { xml, warnings } = buildXml3CL(globals, rooms)

  const storagePath = `${session.organization_id}/${session.dossier_id}/mission-${missionSessionId}-3cl-${Date.now()}.xml`
  const { error: uploadErr } = await admin.storage
    .from('dossier-exports')
    .upload(storagePath, new Blob([xml], { type: 'application/xml' }), {
      upsert: true,
      contentType: 'application/xml',
    })

  // ATOMICITÉ (cf. audit P0-4 mode mission) : si l'upload Storage échoue, on
  // ARRÊTE IMMÉDIATEMENT — sinon on insère une row dossier_exports qui pointe
  // vers un fichier inexistant et l'utilisateur télécharge 404. Le bucket doit
  // exister en prod (cf. migration 20260518110000_storage_bucket_photos.sql et
  // l'analogue dossier-exports).
  if (uploadErr) {
    console.error('[exportToLicielAction] storage upload failed', uploadErr.message)
    return {
      error: `Génération du fichier XML impossible : ${uploadErr.message}. Vérifiez que le bucket dossier-exports existe et réessayez.`,
    }
  }

  const expTable = admin.from('dossier_exports') as unknown as {
    insert: (p: Record<string, unknown>) => {
      select: (q: string) => {
        single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>
      }
    }
  }

  const { data: exportRow, error: exportErr } = await expTable
    .insert({
      organization_id: session.organization_id,
      dossier_id: session.dossier_id,
      destination: 'liciel_zip',
      was_complete: warnings.length === 0,
      missing_fields_count: warnings.length,
      missing_fields_snapshot: { warnings },
      storage_path: storagePath,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (exportErr || !exportRow) {
    // Rollback best-effort : on supprime le fichier orphelin si l'INSERT a échoué.
    void admin.storage
      .from('dossier-exports')
      .remove([storagePath])
      .catch(() => undefined)
    return { error: exportErr?.message ?? 'Insert dossier_exports échoué' }
  }

  revalidatePath(`/dashboard/dossiers/${session.dossier_id}`)

  return {
    ok: true,
    exportId: exportRow.id,
    storagePath,
    warnings,
  }
}

// ============================================
// 4. analyzePhotoVisionAction — Lot B98
// ============================================
// Déclenche l'algo A1.3.6 (`analyzeEquipmentPhoto`) à la demande sur une photo
// existante du dossier. Persiste le résultat dans `photos.vision_analysis` +
// `photos.vision_confidence` pour que le widget se rafraîchisse au prochain
// rendu (revalidatePath sur la page validation).
//
// Stratégie de fallback : si `ANTHROPIC_API_KEY` est manquante (env dev/test),
// on retourne un MOCK crédible pour permettre l'UI flow sans coût ni dépendance
// Claude. Le mock est marqué `_mock: true` côté DB pour distinguer en obs.
//
// TODO B98+ : brancher la vraie URL signée Supabase Storage (createSignedUrl)
// et passer en `imageUrl` à `analyzeEquipmentPhoto`. Pour l'instant on génère
// une signed URL si bucket dispo, sinon on retombe sur le mock.

interface AnalyzePhotoOk {
  ok: true
  photoId: string
  equipmentType: string
  brand: string | null
  model: string | null
  confidence: number
  mocked: boolean
}

interface AnalyzePhotoErr {
  error: string
}

const analyzePhotoSchema = z.object({
  photoId: z.string().uuid(),
})

/**
 * Mock vision analysis crédible — utilisé quand Claude Vision n'est pas dispo
 * (clé API manquante, env test). Rotation déterministe basée sur l'UUID pour
 * que des appels successifs sur des photos différentes donnent des résultats
 * variés (utile pour démos / tests).
 */
function buildMockVisionAnalysis(photoId: string): {
  equipment_type: string
  brand: { value: string; confidence: number }
  model: { value: string; confidence: number }
  manufacture_year: { value: number; confidence: number }
  energy_type: { value: string; confidence: number }
  overall_confidence: number
  needs_manual_validation: boolean
  raw_ocr_text: string
  _mock: true
} {
  const samples = [
    {
      equipment_type: 'chaudiere',
      brand: 'Saunier Duval',
      model: 'ThemaPlus Condens F25E',
      year: 2019,
      energy: 'gaz',
    },
    {
      equipment_type: 'pompe_chaleur',
      brand: 'Daikin',
      model: 'Altherma 3 H HT',
      year: 2022,
      energy: 'pompe_chaleur',
    },
    {
      equipment_type: 'vmc',
      brand: 'Aldes',
      model: 'EasyHOME PureAir Connect',
      year: 2020,
      energy: 'electricite',
    },
    {
      equipment_type: 'chauffe_eau',
      brand: 'Atlantic',
      model: 'Linéo Connecté 200L',
      year: 2021,
      energy: 'electricite',
    },
  ]
  // Hash déterministe simple basé sur les premiers caractères de l'UUID
  const seed = photoId.charCodeAt(0) + photoId.charCodeAt(1)
  const sample = samples[seed % samples.length] ?? samples[0]
  if (!sample) {
    throw new Error('mock vision samples vides — invariant cassé')
  }
  return {
    equipment_type: sample.equipment_type,
    brand: { value: sample.brand, confidence: 0.92 },
    model: { value: sample.model, confidence: 0.85 },
    manufacture_year: { value: sample.year, confidence: 0.88 },
    energy_type: { value: sample.energy, confidence: 0.95 },
    overall_confidence: 0.89,
    needs_manual_validation: false,
    raw_ocr_text: `${sample.brand} ${sample.model} — analyse mockée Lot B98`,
    _mock: true,
  }
}

export async function analyzePhotoVisionAction(
  photoId: string,
): Promise<AnalyzePhotoOk | AnalyzePhotoErr> {
  const parsed = analyzePhotoSchema.safeParse({ photoId })
  if (!parsed.success) return { error: 'Photo ID invalide' }

  const { orgId } = await getCurrentUser()
  const admin = adminClient()

  // 1. Charger la photo + vérifier le tenant
  const photosTable = admin.from('photos') as unknown as {
    select: (q: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        single: () => Promise<{
          data: {
            id: string
            storage_path: string
            organization_id: string
            dossier_id: string
          } | null
          error: { message: string } | null
        }>
      }
    }
    update: (p: Record<string, unknown>) => {
      eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>
    }
  }

  const { data: photo, error: photoErr } = await photosTable
    .select('id, storage_path, organization_id, dossier_id')
    .eq('id', photoId)
    .single()

  if (photoErr || !photo) return { error: 'Photo introuvable' }
  if (photo.organization_id !== orgId) return { error: 'Accès refusé' }

  // 2. Tenter d'obtenir une signed URL ; si Claude API key dispo ET URL OK,
  //    on appelle l'algo réel. Sinon → fallback mock.
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY
  let analysisJson: Record<string, unknown>
  let mocked = true

  if (hasApiKey) {
    const { data: signed } = await admin.storage
      .from('mission-photos')
      .createSignedUrl(photo.storage_path, 60 * 5) // 5 min suffisant pour 1 call Vision

    if (signed?.signedUrl) {
      const result = await analyzeEquipmentPhoto({ imageUrl: signed.signedUrl })
      if ('error' in result) {
        // L'algo a échoué → fallback mock pour ne pas bloquer l'UX,
        // mais on log côté server pour observabilité.
        console.warn('[analyzePhotoVisionAction] Claude Vision failed:', result.error)
        analysisJson = buildMockVisionAnalysis(photoId)
      } else {
        analysisJson = result as unknown as Record<string, unknown>
        mocked = false
      }
    } else {
      analysisJson = buildMockVisionAnalysis(photoId)
    }
  } else {
    analysisJson = buildMockVisionAnalysis(photoId)
  }

  // 3. Persister
  const confidence =
    typeof analysisJson.overall_confidence === 'number' ? analysisJson.overall_confidence : 0.85

  const { error: updateErr } = await photosTable
    .update({
      vision_analysis: analysisJson,
      vision_confidence: confidence,
    })
    .eq('id', photoId)

  if (updateErr) return { error: updateErr.message }

  revalidatePath(`/dashboard/dossiers/${photo.dossier_id}/mission/validation`)

  const brandField = analysisJson.brand as { value?: string } | string | undefined
  const modelField = analysisJson.model as { value?: string } | string | undefined
  const brand = typeof brandField === 'string' ? brandField : (brandField?.value ?? null)
  const model = typeof modelField === 'string' ? modelField : (modelField?.value ?? null)

  return {
    ok: true,
    photoId,
    equipmentType:
      typeof analysisJson.equipment_type === 'string' ? analysisJson.equipment_type : 'autre',
    brand,
    model,
    confidence,
    mocked,
  }
}
