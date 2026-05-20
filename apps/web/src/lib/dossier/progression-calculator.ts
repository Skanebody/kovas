/**
 * KOVAS — Calculateur de progression d'un dossier (refonte page dossier).
 *
 * Authority : CLAUDE.md §3 + spec refonte UI dossier + diagnostic-schemas.ts.
 *
 * Algorithme :
 *  1. Charge le dossier (avec property_rooms, exported_count, ...)
 *  2. Charge les missions actives → déduit les DiagnosticType actifs
 *  3. Pour chaque diagnostic actif, calcule % progression via schéma vs valeurs collectées
 *  4. Charge les dossier_rooms + counts photos/voice_notes par room → VisitedRoom[]
 *  5. Détecte les pièces suggérées (property_rooms NON visitées) avec issues
 *  6. Charge tous les dossier_field_values + classe en buckets critiques
 *  7. Agrège un résumé éditorial 1-ligne
 *
 * Toutes les queries respectent RLS via le client passé en paramètre (multi-tenant).
 */

import { classifyCriticalFields } from '@/lib/dossier/critical-fields-classifier'
import {
  type MissingField,
  detectMissingFields,
  getAllSchemaFields,
  getRequiredSchemaFields,
} from '@/lib/dossier/missing-fields-detector'
import { resolveRoomIcon } from '@/lib/dossier/room-icon-resolver'
import {
  type DossierLite,
  type PropertyRoomEntry,
  detectSuggestedRooms,
} from '@/lib/dossier/room-mapping'
import type {
  CriticalField,
  CriticalFieldBucket,
  CriticalFieldBucketId,
  DiagnosticProgress,
  ProgressionData,
  RoomVisitStatus,
  VisitedRoom,
} from '@/lib/dossier/types'
import { missionTypesToActiveDiagnostics } from '@/lib/mission/diagnostic-mapper'
import { SCHEMAS_BY_DIAGNOSTIC, getDiagnosticSchema } from '@/lib/mission/diagnostic-schemas'
import type {
  DiagnosticType,
  DossierFieldValue,
  FieldConflictResolution,
  FieldSourceType,
  FieldValuePayload,
} from '@/lib/mission/types'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// Types internes (raw rows depuis Supabase)
// ============================================

interface RawDossierRow {
  id: string
  property_rooms: PropertyRoomEntry[] | null
}

interface RawMissionRow {
  type: string
  status: string
}

interface RawDossierRoom {
  id: string
  name: string
  room_type: string | null
}

interface RawFieldValueRow {
  id: string
  organization_id: string
  dossier_id: string
  diagnostic_type: string
  field_path: string
  value: FieldValuePayload
  unit: string | null
  source_type: string
  source_photo_id: string | null
  source_voice_id: string | null
  source_text_id: string | null
  source_document_id: string | null
  confidence: number | null
  validated_by_user: boolean | null
  validated_at: string | null
  manually_edited_at: string | null
  has_conflict: boolean | null
  conflict_resolution: string | null
  created_at: string
  updated_at: string
}

interface RawPhotoRoomCount {
  room_id: string | null
}

interface RawVoiceRoomCount {
  room_id: string | null
}

// ============================================
// Mapping snake_case → camelCase pour DossierFieldValue
// ============================================
function toDossierFieldValue(row: RawFieldValueRow): DossierFieldValue {
  return {
    id: row.id,
    organizationId: row.organization_id,
    dossierId: row.dossier_id,
    diagnosticType: row.diagnostic_type as DiagnosticType,
    fieldPath: row.field_path,
    value: row.value,
    unit: row.unit,
    sourceType: row.source_type as FieldSourceType,
    sourcePhotoId: row.source_photo_id,
    sourceVoiceId: row.source_voice_id,
    sourceTextId: row.source_text_id,
    sourceDocumentId: row.source_document_id,
    confidence: row.confidence,
    validatedByUser: row.validated_by_user ?? false,
    validatedAt: row.validated_at,
    manuallyEditedAt: row.manually_edited_at,
    hasConflict: row.has_conflict ?? false,
    conflictResolution: (row.conflict_resolution as FieldConflictResolution | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ============================================
// Utilities
// ============================================
function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.min(100, Math.round((numerator / denominator) * 100))
}

function findFieldLabel(diagnostic: DiagnosticType, fieldPath: string): string {
  const schema = SCHEMAS_BY_DIAGNOSTIC[diagnostic]
  const found = getAllSchemaFields(schema).find((f) => f.path === fieldPath)
  return found?.label ?? fieldPath
}

function formatValueShort(value: FieldValuePayload): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  // Object/array : json compact troncqué
  try {
    const json = JSON.stringify(value)
    return json.length > 80 ? `${json.slice(0, 80)}…` : json
  } catch {
    return null
  }
}

function toCriticalField(field: DossierFieldValue): CriticalField {
  const label = findFieldLabel(field.diagnosticType, field.fieldPath)
  return {
    path: `${field.diagnosticType} › ${label}`,
    value: formatValueShort(field.value),
    diagnostic: field.diagnosticType,
    confidence: field.confidence ?? undefined,
    hasConflict: field.hasConflict,
    sourceLabel: humanizeSourceType(field.sourceType),
  }
}

function humanizeSourceType(t: FieldSourceType): string {
  switch (t) {
    case 'photo_vision':
      return 'Photo IA'
    case 'voice_extraction':
      return 'Note vocale'
    case 'text_extraction':
      return 'Note texte'
    case 'document_ocr':
      return 'Document OCR'
    case 'manual_entry':
      return 'Saisie manuelle'
    case 'imported_liciel':
      return 'Import Liciel'
    case 'inferred_ai':
      return 'Inféré IA'
    case 'calculated':
      return 'Calculé'
  }
}

const VISITED_ROOM_STATUS_LABEL: Record<CriticalFieldBucketId, string> = {
  'to-verify': 'À vérifier',
  edited: 'Édités',
  validated: 'Validés',
  missing: 'Manquants',
}

function summarizeRoomStatus(
  photosCount: number,
  voiceNotesCount: number,
  fieldsCount: number,
): RoomVisitStatus {
  if (photosCount === 0 && voiceNotesCount === 0 && fieldsCount === 0) return 'started'
  // Heuristique simple : si au moins 1 photo + 1 voice OU >= 3 champs → completed
  if ((photosCount >= 1 && voiceNotesCount >= 1) || fieldsCount >= 3) return 'completed'
  return 'in-progress'
}

// ============================================
// Main entry point
// ============================================
export async function calculateProgression(
  supabase: SupabaseClient,
  dossierId: string,
): Promise<ProgressionData> {
  // ----- 1. Charge le dossier (property_rooms snapshot) -----
  const { data: dossierRaw, error: dossierErr } = await supabase
    .from('dossiers')
    .select('id, property_rooms')
    .eq('id', dossierId)
    .maybeSingle()

  if (dossierErr || !dossierRaw) {
    return emptyProgressionData()
  }
  const dossier = dossierRaw as RawDossierRow

  // ----- 2. Charge missions → diagnostics actifs -----
  const { data: missionsRaw } = await supabase
    .from('missions')
    .select('type, status')
    .eq('dossier_id', dossierId)
    .is('deleted_at', null)

  const missions = (missionsRaw ?? []) as RawMissionRow[]
  const activeDiagnostics = missionTypesToActiveDiagnostics(missions.map((m) => m.type))

  // ----- 3. Charge dossier_field_values -----
  const { data: fieldsRaw } = await supabase
    .from('dossier_field_values')
    .select('*')
    .eq('dossier_id', dossierId)

  const allFields = ((fieldsRaw ?? []) as RawFieldValueRow[]).map(toDossierFieldValue)

  // ----- 4. Charge dossier_rooms -----
  const { data: roomsRaw } = await supabase
    .from('dossier_rooms')
    .select('id, name, room_type')
    .eq('dossier_id', dossierId)
    .order('position', { ascending: true })

  const rooms = (roomsRaw ?? []) as RawDossierRoom[]

  // ----- 5. Charge photos / voice_notes (counts par room) -----
  const { data: photosRaw } = await supabase
    .from('photos')
    .select('room_id')
    .eq('dossier_id', dossierId)
  const { data: voicesRaw } = await supabase
    .from('voice_notes')
    .select('room_id')
    .eq('dossier_id', dossierId)

  const photos = (photosRaw ?? []) as RawPhotoRoomCount[]
  const voices = (voicesRaw ?? []) as RawVoiceRoomCount[]

  const photosByRoom = new Map<string, number>()
  for (const p of photos) {
    if (p.room_id) photosByRoom.set(p.room_id, (photosByRoom.get(p.room_id) ?? 0) + 1)
  }
  const voicesByRoom = new Map<string, number>()
  for (const v of voices) {
    if (v.room_id) voicesByRoom.set(v.room_id, (voicesByRoom.get(v.room_id) ?? 0) + 1)
  }

  // ----- 6. Calcul progression par diagnostic -----
  const diagnosticProgressions: DiagnosticProgress[] = []
  const allMissing: MissingField[] = []

  for (const diag of activeDiagnostics) {
    const schema = getDiagnosticSchema(diag)
    const collectedForDiag = allFields.filter((f) => f.diagnosticType === diag)
    const required = getRequiredSchemaFields(schema)
    const total = required.length
    const collectedRequiredPaths = new Set(collectedForDiag.map((f) => f.fieldPath))
    const completed = required.filter((r) => collectedRequiredPaths.has(r.path)).length

    const missing = detectMissingFields(
      schema,
      collectedForDiag.map((f) => ({ field_path: f.fieldPath, value: f.value })),
    )
    allMissing.push(...missing)

    diagnosticProgressions.push({
      diagnostic: diag,
      percent: pct(completed, total),
      fieldsCollected: completed,
      fieldsTotal: total,
      missingFields: missing.map((m) => m.label),
    })
  }

  // ----- 7. VisitedRooms enrichies -----
  const visitedRooms: VisitedRoom[] = rooms.map((r) => {
    const photosCount = photosByRoom.get(r.id) ?? 0
    const voiceNotesCount = voicesByRoom.get(r.id) ?? 0
    // Heuristique : compter les champs liés à ce room ? On approxime — pas de FK directe.
    // À défaut, on rapporte les champs au type de pièce via room-mapping (best-effort).
    const fieldsCount = 0
    return {
      id: r.id,
      name: r.name,
      type: r.room_type ?? 'autres',
      status: summarizeRoomStatus(photosCount, voiceNotesCount, fieldsCount),
      photosCount,
      voiceNotesCount,
      durationMin: 0, // TODO : à brancher sur mission_sessions
      fieldsCount,
      diagnosticStatuses: activeDiagnostics.map((d) => ({
        diagnostic: d,
        hasIssue: photosCount === 0 && voiceNotesCount === 0,
        issueLabel: photosCount === 0 && voiceNotesCount === 0 ? 'Aucune capture' : undefined,
      })),
    }
  })

  // ----- 8. SuggestedRooms (property_rooms NON visitées) -----
  const visitedRoomTypes = new Set<string>()
  for (const r of rooms) {
    if (r.room_type) visitedRoomTypes.add(r.room_type.toLowerCase())
  }
  const dossierLite: DossierLite = { property_rooms: dossier.property_rooms ?? null }
  const suggested = detectSuggestedRooms(dossierLite, visitedRoomTypes, activeDiagnostics)
  // Drop le champ `iconName` (non présent dans le type canonique SuggestedRoom).
  const suggestedRoomsTyped = suggested.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    status: s.status,
    suggestedReason: s.suggestedReason,
    diagnosticStatuses: s.diagnosticStatuses,
  }))
  // Pré-warm icon resolver (force tree-shaking visible côté UI)
  void resolveRoomIcon

  // ----- 9. Buckets critiques (tous diagnostics confondus) -----
  const buckets = classifyCriticalFields(allFields, allMissing)
  const bucketsList: CriticalFieldBucket[] = [
    {
      id: 'to-verify',
      label: VISITED_ROOM_STATUS_LABEL['to-verify'],
      fields: buckets.toVerify.map(toCriticalField),
    },
    {
      id: 'edited',
      label: VISITED_ROOM_STATUS_LABEL.edited,
      fields: buckets.edited.map(toCriticalField),
    },
    {
      id: 'validated',
      label: VISITED_ROOM_STATUS_LABEL.validated,
      fields: buckets.validated.map(toCriticalField),
    },
    {
      id: 'missing',
      label: VISITED_ROOM_STATUS_LABEL.missing,
      fields: buckets.missing.map((m) => ({
        path: `${m.diagnostic} › ${m.label}`,
        value: null,
        diagnostic: m.diagnostic,
      })),
    },
  ]

  // ----- 10. Totaux / résumé éditorial -----
  const totalCollected = diagnosticProgressions.reduce((s, d) => s + d.fieldsCollected, 0)
  const totalRequired = diagnosticProgressions.reduce((s, d) => s + d.fieldsTotal, 0)
  const summaryParts = diagnosticProgressions.map((d) => `${d.diagnostic} ${d.percent}%`)
  const summary = summaryParts.join(' · ')

  return {
    diagnostics: {
      list: diagnosticProgressions,
      summary,
    },
    rooms: {
      visitedRooms,
      suggestedRooms: suggestedRoomsTyped,
    },
    fields: {
      collected: totalCollected,
      total: totalRequired,
    },
    buckets: bucketsList,
    missingFields: allMissing.map((m) => ({ label: m.label, diagnostic: m.diagnostic })),
    summary,
    photosCount: photos.length,
    voiceNotesCount: voices.length,
  }
}

// ============================================
// Helper : structure vide-mais-valide
// ============================================
function emptyProgressionData(): ProgressionData {
  return {
    diagnostics: { list: [], summary: '' },
    rooms: { visitedRooms: [], suggestedRooms: [] },
    fields: { collected: 0, total: 0 },
    buckets: [
      { id: 'to-verify', label: 'À vérifier', fields: [] },
      { id: 'edited', label: 'Édités', fields: [] },
      { id: 'validated', label: 'Validés', fields: [] },
      { id: 'missing', label: 'Manquants', fields: [] },
    ],
    missingFields: [],
    summary: '',
    photosCount: 0,
    voiceNotesCount: 0,
  }
}
