/**
 * KOVAS — API route Consolidation Capture-First (V1.5 iteration 5).
 *
 * POST /api/missions/[id]/consolidate
 *
 * ⚠️ Le segment URL `[id]` est ici utilisé comme **dossier_id** (cohérent avec
 *    `cockpit`, `consolidate`, ...). À ne pas confondre avec `/api/missions/[id]/export`
 *    qui historiquement passait un `mission_id` — l'export route sera migré en
 *    itération 6 (cockpit). Pour cette route on documente clairement : id = dossier_id.
 *
 * Flow :
 *   1. Auth + check dossier appartient à org
 *   2. Charge tout : photos analysées + voice transcrites + text notes + docs OCR
 *   3. Résout activeDiagnostics depuis missions.type
 *   4. Garde-fou : < 3 photos analysées + 0 annotation → 400 "pas assez de données"
 *   5. Call consolidateDossier(input) → Claude Sonnet 4.6 + prompt caching
 *   6. UPSERT dossier_field_values selon les règles (cf. brief)
 *   7. UPDATE dossiers.metadata avec consolidation_*
 *   8. INSERT ai_usage row (cost tracking)
 *   9. Return JSON récap pour le front
 *
 * Authority : CLAUDE.md §3 features 1-5-7 + §7bis (autonomisation IA).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import {
  ConsolidationError,
  type ConsolidationInput,
  consolidateDossier,
} from '@/lib/mission/consolidator'
import type { ConflictReport, ConsolidatedField, MissingField } from '@/lib/mission/consolidator'
import { missionTypesToActiveDiagnostics } from '@/lib/mission/diagnostic-mapper'
import type { DiagnosticType, VisionAnalysisResult } from '@/lib/mission/types'
import { NextResponse } from 'next/server'

// Pattern projet (cf. analyze/route.ts) : les types Supabase générés ne reflètent
// pas encore les colonnes/tables de la migration capture_first
// (mission_text_notes, dossier_field_values, attached_photo_id, edited_transcription).
// On utilise `as never` aux endroits ciblés pour préserver la cohérence du type
// checker sans introduire de `any` global.

export const runtime = 'nodejs'
// Sonnet 4.6 peut prendre 30-60s sur gros dossiers (50+ photos + voice + docs).
export const maxDuration = 90

// Garde-fou : refuse de consolider si trop peu de signaux (économie + UX claire).
const MIN_PHOTOS_OR_ANNOTATIONS = 3

// Limite "raisonnable" de photos à passer à Claude. Au-delà, on tronque + warning.
// Un dossier moyen = 20-40 photos. 100 photos = ~50k tokens analyses, sur les 200k
// du contexte Sonnet — marge confortable, mais on prévient le user.
const MAX_PHOTOS_FOR_CONSOLIDATION = 100

interface SuccessResponse {
  ok: true
  fields_consolidated: number
  conflicts: ConflictReport[]
  missing_required: MissingField[]
  global_confidence: number
  summary: string
  cost_usd: number
  warnings?: string[]
}

interface ErrorResponse {
  ok: false
  error: string
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const { id: dossierId } = await params

  if (!/^[0-9a-f-]{36}$/i.test(dossierId)) {
    return NextResponse.json({ ok: false, error: 'dossierId must be a UUID' }, { status: 400 })
  }

  // ── Auth ──────────────────────────────────────────────────────────
  let orgId: string
  let userId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
    userId = u.user.id
    supabase = u.supabase
  } catch {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'ANTHROPIC_API_KEY not configured' },
      { status: 503 },
    )
  }

  // ── 1. Charge le dossier + property + client ───────────────────────
  const { data: dossier, error: dossierErr } = await supabase
    .from('dossiers')
    .select(
      'id, reference, organization_id, metadata, property:property_id (address, city, year_built, surface_total, property_type), client:client_id (display_name)',
    )
    .eq('id', dossierId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (dossierErr || !dossier) {
    return NextResponse.json({ ok: false, error: 'dossier not found' }, { status: 404 })
  }

  // Supabase typage générique vs jointures : on caste défensivement.
  const property = ((): ConsolidationInput['dossier']['property'] => {
    const raw = (dossier as { property: unknown }).property
    if (!isRecord(raw)) return {}
    return {
      address: typeof raw.address === 'string' ? raw.address : undefined,
      year_built: typeof raw.year_built === 'number' ? raw.year_built : undefined,
      surface_total:
        typeof raw.surface_total === 'number'
          ? raw.surface_total
          : typeof raw.surface_total === 'string'
            ? Number.parseFloat(raw.surface_total)
            : undefined,
      property_type: typeof raw.property_type === 'string' ? raw.property_type : undefined,
    }
  })()

  const clientName = ((): string | undefined => {
    const raw = (dossier as { client: unknown }).client
    if (!isRecord(raw)) return undefined
    return typeof raw.display_name === 'string' ? raw.display_name : undefined
  })()

  // ── 2. Diagnostics actifs depuis missions ──────────────────────────
  const { data: missions, error: missionsErr } = await supabase
    .from('missions')
    .select('type')
    .eq('dossier_id', dossierId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  if (missionsErr) {
    return NextResponse.json(
      { ok: false, error: `missions query : ${missionsErr.message}` },
      { status: 500 },
    )
  }

  const missionTypeStrings = (missions ?? []).map((m) => m.type as string)
  const activeDiagnostics: DiagnosticType[] = missionTypesToActiveDiagnostics(missionTypeStrings)

  if (activeDiagnostics.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'no active diagnostics found for this dossier' },
      { status: 400 },
    )
  }

  // ── 3. Charge photos analysées ─────────────────────────────────────
  const { data: photosRaw, error: photosErr } = await supabase
    .from('photos')
    .select('id, dossier_id, room_id, taken_at, vision_status, vision_analysis, vision_confidence')
    .eq('dossier_id', dossierId)
    .eq('organization_id', orgId)
    .eq('vision_status', 'analyzed')
    .order('taken_at', { ascending: true })
    .limit(MAX_PHOTOS_FOR_CONSOLIDATION + 1)

  if (photosErr) {
    return NextResponse.json(
      { ok: false, error: `photos query : ${photosErr.message}` },
      { status: 500 },
    )
  }

  const photosTruncated = (photosRaw ?? []).length > MAX_PHOTOS_FOR_CONSOLIDATION
  const photosList = (photosRaw ?? []).slice(0, MAX_PHOTOS_FOR_CONSOLIDATION)

  // Collecte des room_id côté photos pour la résolution batch ci-dessous.
  const photoRoomIds = (photosList ?? [])
    .map((p) => p.room_id)
    .filter((id): id is string => typeof id === 'string')

  // ── 4. Charge voice notes du dossier ───────────────────────────────
  // Note : `transcription_status` et `attached_photo_id` viennent de la migration
  // capture_first et ne sont pas dans le type généré. On filtre côté code.
  const { data: voiceRaw, error: voiceErr } = await supabase
    .from('voice_notes')
    .select(
      'id, dossier_id, room_id, transcript_raw, transcript_structured, transcription_status, edited_transcription, attached_photo_id',
    )
    .eq('dossier_id', dossierId)
    .eq('organization_id', orgId)

  if (voiceErr) {
    return NextResponse.json(
      { ok: false, error: `voice_notes query : ${voiceErr.message}` },
      { status: 500 },
    )
  }

  type VoiceRow = {
    id: string
    dossier_id: string
    room_id: string | null
    transcript_raw: string | null
    transcript_structured: Record<string, unknown> | null
    transcription_status: string | null
    edited_transcription: string | null
    attached_photo_id: string | null
  }
  const voiceList = ((voiceRaw ?? []) as unknown as VoiceRow[]).filter((v) => {
    // Conserver toute voix qui a au moins une trace utilisable
    if (v.transcription_status === 'transcribed') return true
    if (v.transcript_structured && Object.keys(v.transcript_structured).length > 0) return true
    if (typeof v.transcript_raw === 'string' && v.transcript_raw.trim().length > 0) return true
    return false
  })

  // ── 5. Charge text notes du dossier ────────────────────────────────
  const { data: textRaw, error: textErr } = await supabase
    .from('mission_text_notes' as never)
    .select('id, dossier_id, room_id, text, attached_photo_id, deleted_at')
    .eq('dossier_id', dossierId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  if (textErr) {
    return NextResponse.json(
      { ok: false, error: `mission_text_notes query : ${textErr.message}` },
      { status: 500 },
    )
  }

  type TextRow = {
    id: string
    dossier_id: string
    room_id: string | null
    text: string
    attached_photo_id: string | null
    deleted_at: string | null
  }
  const textList = (textRaw ?? []) as unknown as TextRow[]

  // ── 6. Charge documents OCR du dossier ─────────────────────────────
  const { data: docsRaw, error: docsErr } = await supabase
    .from('owner_documents')
    .select('id, doc_kind, extracted_data, extraction_status')
    .eq('dossier_id', dossierId)
    .eq('organization_id', orgId)
    .not('extracted_data', 'is', null)

  if (docsErr) {
    return NextResponse.json(
      { ok: false, error: `owner_documents query : ${docsErr.message}` },
      { status: 500 },
    )
  }

  type DocRow = {
    id: string
    doc_kind: string | null
    extracted_data: Record<string, unknown> | null
    extraction_status: string | null
  }
  const docsList = (docsRaw ?? []) as unknown as DocRow[]

  // ── 7. Garde-fou volume ────────────────────────────────────────────
  const totalSignals = photosList.length + voiceList.length + textList.length + docsList.length
  if (totalSignals < MIN_PHOTOS_OR_ANNOTATIONS) {
    return NextResponse.json(
      {
        ok: false,
        error: `Pas assez de données pour consolider — il faut au moins ${MIN_PHOTOS_OR_ANNOTATIONS} sources (photos analysées, notes vocales ou documents). Actuellement : ${totalSignals}.`,
      },
      { status: 400 },
    )
  }

  // Tous les room_ids (photos + voice + text) pour le contexte Claude.
  const allRoomIds = new Set<string>(photoRoomIds)
  for (const v of voiceList) if (v.room_id) allRoomIds.add(v.room_id)
  for (const t of textList) if (t.room_id) allRoomIds.add(t.room_id)
  const fullRoomNameById = await loadRoomNames(supabase, orgId, Array.from(allRoomIds))

  // ── 8. Build ConsolidationInput ────────────────────────────────────
  const input: ConsolidationInput = {
    dossier: {
      id: dossierId,
      reference: dossier.reference as string,
      property,
      client_name: clientName,
    },
    activeDiagnostics,
    photos: photosList.map((p) => ({
      id: p.id,
      room_name: p.room_id ? (fullRoomNameById.get(p.room_id) ?? null) : null,
      captured_at: (p.taken_at as string | null) ?? '',
      vision_analysis: (p.vision_analysis as VisionAnalysisResult | null) ?? null,
      vision_confidence:
        typeof p.vision_confidence === 'number'
          ? p.vision_confidence
          : typeof p.vision_confidence === 'string'
            ? Number.parseFloat(p.vision_confidence)
            : null,
    })),
    voiceNotes: voiceList.map((v) => ({
      id: v.id,
      attached_photo_id: v.attached_photo_id,
      transcript_raw:
        typeof v.edited_transcription === 'string' && v.edited_transcription.trim().length > 0
          ? v.edited_transcription
          : v.transcript_raw,
      transcript_structured: v.transcript_structured,
      room_name: v.room_id ? (fullRoomNameById.get(v.room_id) ?? null) : null,
    })),
    textNotes: textList.map((t) => ({
      id: t.id,
      attached_photo_id: t.attached_photo_id,
      text: t.text,
      room_name: t.room_id ? (fullRoomNameById.get(t.room_id) ?? null) : null,
    })),
    ownerDocuments: docsList.map((d) => ({
      id: d.id,
      doc_kind: d.doc_kind ?? 'autre',
      extracted_data: d.extracted_data,
    })),
  }

  // ── 9. Call Claude ─────────────────────────────────────────────────
  const startedAt = Date.now()
  let consolidationOutput: Awaited<ReturnType<typeof consolidateDossier>>
  try {
    consolidationOutput = await consolidateDossier(input)
  } catch (err) {
    const msg =
      err instanceof ConsolidationError
        ? `${err.code}: ${err.message}`
        : err instanceof Error
          ? err.message
          : 'consolidation failed'
    console.error('[consolidate] failed', { dossierId, msg })
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
  const totalLatencyMs = Date.now() - startedAt
  const result = consolidationOutput.result

  // ── 10. UPSERT dossier_field_values ────────────────────────────────
  const conflictKeySet = new Set(result.conflicts.map((c) => `${c.diagnostic}::${c.field_path}`))

  // Aplatit fields_by_diagnostic en liste (en filtrant ré-défensivement les
  // diagnostics hors scope au cas où le parser laisserait passer quelque chose).
  const allFields: ConsolidatedField[] = []
  for (const diag of activeDiagnostics) {
    const fields = result.fields_by_diagnostic[diag]
    if (Array.isArray(fields)) allFields.push(...fields)
  }

  let upsertedCount = 0
  for (const field of allFields) {
    const hasConflict = conflictKeySet.has(`${field.diagnostic}::${field.field_path}`)
    const applied = await upsertConsolidatedField({
      supabase,
      orgId,
      dossierId,
      field,
      hasConflict,
    })
    if (applied) upsertedCount++
  }

  // ── 11. UPDATE dossier metadata ────────────────────────────────────
  const existingMetadata = isRecord(dossier.metadata) ? dossier.metadata : {}
  const newMetadata = {
    ...existingMetadata,
    consolidation_summary: result.summary,
    consolidation_global_confidence: result.global_confidence,
    consolidation_missing_count: result.missing_required.length,
    consolidation_conflicts_count: result.conflicts.length,
    consolidation_fields_count: upsertedCount,
    consolidation_last_run_at: new Date().toISOString(),
  }
  const { error: metaErr } = await supabase
    .from('dossiers')
    .update({ metadata: newMetadata as never })
    .eq('id', dossierId)
    .eq('organization_id', orgId)

  if (metaErr) {
    console.error('[consolidate] dossier metadata update failed', metaErr.message)
  }

  // ── 12. INSERT ai_usage ────────────────────────────────────────────
  // cost_eur ≈ cost_usd * 0.93 (taux fixe — sera dynamique en V2)
  await supabase.from('ai_usage').insert({
    organization_id: orgId,
    user_id: userId,
    provider: 'anthropic',
    model: consolidationOutput.model,
    operation: 'consolidate_dossier',
    input_tokens: consolidationOutput.inputTokens,
    output_tokens: consolidationOutput.outputTokens,
    cached_tokens: consolidationOutput.cacheReadTokens,
    cost_eur: Math.round(consolidationOutput.costUsd * 0.93 * 1_000_000) / 1_000_000,
    latency_ms: totalLatencyMs,
  })

  // ── 13. Réponse ────────────────────────────────────────────────────
  const warnings: string[] = []
  if (photosTruncated) {
    warnings.push(
      `Plus de ${MAX_PHOTOS_FOR_CONSOLIDATION} photos analysées sur ce dossier — seules les ${MAX_PHOTOS_FOR_CONSOLIDATION} premières ont été incluses dans la consolidation.`,
    )
  }

  return NextResponse.json({
    ok: true,
    fields_consolidated: upsertedCount,
    conflicts: result.conflicts,
    missing_required: result.missing_required,
    global_confidence: result.global_confidence,
    summary: result.summary,
    cost_usd: consolidationOutput.costUsd,
    ...(warnings.length > 0 ? { warnings } : {}),
  })
}

// ============================================
// Helpers
// ============================================

type SupabaseLike = Awaited<ReturnType<typeof getCurrentUser>>['supabase']

async function loadRoomNames(
  supabase: SupabaseLike,
  orgId: string,
  roomIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (roomIds.length === 0) return map
  const { data } = await supabase
    .from('dossier_rooms')
    .select('id, name')
    .in('id', roomIds)
    .eq('organization_id', orgId)
  if (Array.isArray(data)) {
    for (const r of data) {
      if (typeof r.id === 'string' && typeof r.name === 'string') {
        map.set(r.id, r.name)
      }
    }
  }
  return map
}

/**
 * Upsert un champ consolidé dans dossier_field_values.
 *
 * Règles (cohérentes avec vision-analyzer pour les photos) :
 * - Si la row n'existe pas → INSERT (avec has_conflict si applicable).
 * - Si validated_by_user=true → on NE TOUCHE PAS la value mais on met à jour
 *   has_conflict si la consolidation détecte un conflit (pour que l'utilisateur
 *   sache qu'une nouvelle source contredit sa validation).
 * - Sinon : UPDATE si confidence consolidée > existante OU si existante.confidence IS NULL.
 *
 * Retourne true si une INSERT ou un UPDATE a été appliqué, false sinon.
 */
async function upsertConsolidatedField(args: {
  supabase: SupabaseLike
  orgId: string
  dossierId: string
  field: ConsolidatedField
  hasConflict: boolean
}): Promise<boolean> {
  const { supabase, orgId, dossierId, field, hasConflict } = args
  const tableRef = 'dossier_field_values' as never

  const existingQuery = await supabase
    .from(tableRef)
    .select('id, confidence, validated_by_user, has_conflict')
    .eq('dossier_id', dossierId)
    .eq('diagnostic_type', field.diagnostic)
    .eq('field_path', field.field_path)
    .maybeSingle()

  const existing = existingQuery.data as {
    id: string
    confidence: number | null
    validated_by_user: boolean | null
    has_conflict: boolean | null
  } | null

  // Mapping sources Consolidator → colonnes dédiées dans la table.
  const sourceColumns = buildSourceColumns(field)

  if (existing) {
    if (existing.validated_by_user === true) {
      // Ne pas écraser la valeur validée — juste signaler conflit si la conso le dit.
      if (hasConflict && existing.has_conflict !== true) {
        const { error: updErr } = await supabase
          .from(tableRef)
          .update({ has_conflict: true, updated_at: new Date().toISOString() } as never)
          .eq('id', existing.id)
          .eq('organization_id', orgId)
        return !updErr
      }
      return false
    }

    const existingConf = typeof existing.confidence === 'number' ? existing.confidence : null
    const shouldOverwrite = existingConf === null || field.confidence > existingConf
    if (!shouldOverwrite && existing.has_conflict === hasConflict) return false

    const { error: updErr } = await supabase
      .from(tableRef)
      .update({
        value: field.value,
        unit: field.unit,
        source_type: field.source_type,
        ...sourceColumns,
        confidence: field.confidence,
        has_conflict: hasConflict,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', existing.id)
      .eq('organization_id', orgId)
    return !updErr
  }

  const { error: insErr } = await supabase.from(tableRef).insert({
    organization_id: orgId,
    dossier_id: dossierId,
    diagnostic_type: field.diagnostic,
    field_path: field.field_path,
    value: field.value,
    unit: field.unit,
    source_type: field.source_type,
    ...sourceColumns,
    confidence: field.confidence,
    validated_by_user: false,
    has_conflict: hasConflict,
  } as never)
  return !insErr
}

/**
 * Mappe `source_type` + `primary_source_id` (renvoyés par Claude) vers les
 * colonnes `source_photo_id` / `source_voice_id` / `source_text_id` / `source_document_id`
 * de la table dossier_field_values.
 *
 * Le champ ne stocke qu'UNE source primaire dans les colonnes dédiées. Les
 * `supporting_source_ids` ne sont pas persistés en V1.5 (à voir iteration 6/7
 * pour un audit_trail dédié).
 */
function buildSourceColumns(field: ConsolidatedField): {
  source_photo_id: string | null
  source_voice_id: string | null
  source_text_id: string | null
  source_document_id: string | null
} {
  const id = field.primary_source_id
  if (!id) {
    return {
      source_photo_id: null,
      source_voice_id: null,
      source_text_id: null,
      source_document_id: null,
    }
  }
  switch (field.source_type) {
    case 'photo_vision':
      return {
        source_photo_id: id,
        source_voice_id: null,
        source_text_id: null,
        source_document_id: null,
      }
    case 'voice_extraction':
      return {
        source_photo_id: null,
        source_voice_id: id,
        source_text_id: null,
        source_document_id: null,
      }
    case 'text_extraction':
      return {
        source_photo_id: null,
        source_voice_id: null,
        source_text_id: id,
        source_document_id: null,
      }
    case 'document_ocr':
      return {
        source_photo_id: null,
        source_voice_id: null,
        source_text_id: null,
        source_document_id: id,
      }
    default:
      return {
        source_photo_id: null,
        source_voice_id: null,
        source_text_id: null,
        source_document_id: null,
      }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
