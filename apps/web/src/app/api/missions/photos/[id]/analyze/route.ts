/**
 * KOVAS — API route Vision IA analyze (Capture-First V1.5 iteration 3).
 *
 * Déclenchée en fire-and-forget par le sync manager après upload Storage + INSERT
 * photo row. Flow :
 *   1. Auth + check org
 *   2. Charge la row `photos` (idempotence : noop si déjà processing/analyzed/skipped)
 *   3. UPDATE vision_status='processing'
 *   4. Résout les diagnostics actifs (missions.type → DiagnosticType)
 *   5. Cherche l'annotation associée (voice_notes ou mission_text_notes)
 *   6. Download image depuis Storage (service-role)
 *   7. Call analyzePhotoWithVision (Haiku 4.5 + tool use + prompt caching)
 *   8. UPDATE photos avec résultats + UPSERT dossier_field_values
 *   9. Track usage dans ai_usage
 *
 * Authority : CLAUDE.md §3 feature 1 + §7bis (autonomisation IA).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { missionTypesToActiveDiagnostics } from '@/lib/mission/diagnostic-mapper'
import type { DiagnosticType, VisionAnalysisFieldHint, VisionStatus } from '@/lib/mission/types'
import {
  VisionAnalysisError,
  type VisionAnalysisInput,
  analyzePhotoWithVision,
} from '@/lib/mission/vision-analyzer'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Pattern projet (cf. apps/web/src/app/api/import/parse/[jobId]/route.ts) :
// les types Supabase générés ne reflètent pas encore la migration capture_first
// (mission_text_notes, dossier_field_values, attached_photo_id, edited_transcription).
// On utilise `as never` localement aux endroits qui touchent ces colonnes/tables
// pour préserver la cohérence du type checker sans introduire de `any` global.

export const runtime = 'nodejs'
export const maxDuration = 60

interface AnalyzeSuccessResponse {
  ok: true
  vision_status: 'analyzed'
  fields_extracted: number
  cost_usd: number
}

interface AnalyzeNoopResponse {
  ok: true
  vision_status: string
  skipped: true
  reason: string
}

interface AnalyzeErrorResponse {
  ok: false
  error: string
  vision_status?: 'failed'
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<AnalyzeSuccessResponse | AnalyzeNoopResponse | AnalyzeErrorResponse>> {
  const { id: photoId } = await params

  if (!/^[0-9a-f-]{36}$/i.test(photoId)) {
    return NextResponse.json({ ok: false, error: 'photoId must be a UUID' }, { status: 400 })
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

  // ── 1. Charge la photo + check org ─────────────────────────────────
  const { data: photo, error: photoErr } = await supabase
    .from('photos')
    .select(
      'id, dossier_id, room_id, storage_path, mime_type, vision_status, is_blurry, organization_id',
    )
    .eq('id', photoId)
    .eq('organization_id', orgId)
    .single()

  if (photoErr || !photo) {
    return NextResponse.json({ ok: false, error: 'photo not found' }, { status: 404 })
  }

  // Idempotence : si déjà processing / analyzed / skipped → noop.
  // (vision_status est NOT NULL en DB avec DEFAULT 'pending' — le `?? 'pending'`
  // normalise face au typage généré `string | null`.)
  const currentStatus = (photo.vision_status ?? 'pending') as VisionStatus
  if (currentStatus !== 'pending') {
    return NextResponse.json({
      ok: true,
      vision_status: currentStatus,
      skipped: true,
      reason: `photo already in status "${currentStatus}"`,
    })
  }

  if (photo.is_blurry) {
    // Sécurité : si la photo a glissé en pending malgré is_blurry, on skip ici.
    await supabase
      .from('photos')
      .update({ vision_status: 'skipped_blurry' })
      .eq('id', photoId)
      .eq('organization_id', orgId)
    return NextResponse.json({
      ok: true,
      vision_status: 'skipped_blurry',
      skipped: true,
      reason: 'photo flagged blurry — vision skipped',
    })
  }

  // ── 2. Lock optimiste : UPDATE vision_status='processing' ──────────
  // On retient la précédente valeur pour éviter une race avec un autre worker.
  const { data: lockRows, error: lockErr } = await supabase
    .from('photos')
    .update({ vision_status: 'processing' })
    .eq('id', photoId)
    .eq('organization_id', orgId)
    .eq('vision_status', 'pending')
    .select('id')

  if (lockErr) {
    return NextResponse.json(
      { ok: false, error: `lock failed : ${lockErr.message}` },
      { status: 500 },
    )
  }
  if (!lockRows || lockRows.length === 0) {
    // Un autre worker a pris la photo entre temps — noop.
    return NextResponse.json({
      ok: true,
      vision_status: 'processing',
      skipped: true,
      reason: 'photo claimed by another worker',
    })
  }

  // ── 3. Diagnostics actifs sur le dossier ──────────────────────────
  const { data: missions, error: missionsErr } = await supabase
    .from('missions')
    .select('type')
    .eq('dossier_id', photo.dossier_id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  if (missionsErr) {
    await markFailed(supabase, photoId, orgId, `missions query : ${missionsErr.message}`)
    return NextResponse.json(
      { ok: false, vision_status: 'failed', error: missionsErr.message },
      { status: 500 },
    )
  }

  const missionTypeStrings = (missions ?? []).map((m) => m.type as string)
  const activeDiagnostics: DiagnosticType[] = missionTypesToActiveDiagnostics(missionTypeStrings)

  if (activeDiagnostics.length === 0) {
    await markFailed(supabase, photoId, orgId, 'no active diagnostics for dossier')
    return NextResponse.json(
      {
        ok: false,
        vision_status: 'failed',
        error: 'no active diagnostics found for this dossier',
      },
      { status: 400 },
    )
  }

  // ── 4. Annotation associée (voice_notes prioritaire, sinon text) ───
  const annotation = await loadAnnotation(supabase, photoId, orgId)

  // ── 5. Nom de la pièce (optionnel) ────────────────────────────────
  let roomName: string | null = null
  if (photo.room_id) {
    const { data: roomRow } = await supabase
      .from('dossier_rooms')
      .select('name')
      .eq('id', photo.room_id)
      .eq('organization_id', orgId)
      .maybeSingle()
    if (roomRow && typeof roomRow.name === 'string') roomName = roomRow.name
  }

  // ── 6. Download image depuis Storage (service-role) ───────────────
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await markFailed(supabase, photoId, orgId, 'service-role Supabase env not configured')
    return NextResponse.json(
      { ok: false, vision_status: 'failed', error: 'service-role not configured' },
      { status: 503 },
    )
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  let imageBase64: string
  try {
    const { data: blob, error: dlErr } = await admin.storage
      .from('mission-photos')
      .download(photo.storage_path as string)
    if (dlErr || !blob) {
      throw new Error(`storage download : ${dlErr?.message ?? 'no blob'}`)
    }
    const arrayBuffer = await blob.arrayBuffer()
    imageBase64 = Buffer.from(arrayBuffer).toString('base64')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'download failed'
    await markFailed(supabase, photoId, orgId, msg)
    return NextResponse.json({ ok: false, vision_status: 'failed', error: msg }, { status: 500 })
  }

  // ── 7. Call Vision IA ─────────────────────────────────────────────
  const visionInput: VisionAnalysisInput = {
    imageBase64,
    imageMimeType: (photo.mime_type as string | null) ?? 'image/jpeg',
    roomName,
    activeDiagnostics,
    annotation,
  }

  const startedAt = Date.now()
  let visionOutput: Awaited<ReturnType<typeof analyzePhotoWithVision>>
  try {
    visionOutput = await analyzePhotoWithVision(visionInput)
  } catch (err) {
    const msg =
      err instanceof VisionAnalysisError
        ? `${err.code}: ${err.message}`
        : err instanceof Error
          ? err.message
          : 'vision failed'
    await markFailed(supabase, photoId, orgId, msg)
    return NextResponse.json({ ok: false, vision_status: 'failed', error: msg }, { status: 502 })
  }

  const totalLatencyMs = Date.now() - startedAt
  const result = visionOutput.result
  const overallConfidence = computeOverallConfidence(result.fieldHints)

  // ── 8. UPDATE photos avec résultats ───────────────────────────────
  // `result` est un VisionAnalysisResult typé fortement côté app. Le type Json
  // de Supabase exige `Json | undefined` partout — on cast en `never` (pattern
  // projet) pour éviter une recopie inutile en pseudo-Json.
  const { error: updateErr } = await supabase
    .from('photos')
    .update({
      vision_status: 'analyzed',
      vision_analysis: result as never,
      vision_confidence: overallConfidence,
      vision_model: visionOutput.model,
      vision_cost_usd: visionOutput.costUsd,
      analyzed_at: new Date().toISOString(),
    } as never)
    .eq('id', photoId)
    .eq('organization_id', orgId)

  if (updateErr) {
    // L'analyse Vision a réussi mais l'UPDATE final a échoué — on log + return 500.
    // La photo reste en 'processing' (un retry futur la reprendra).
    console.error('[vision/analyze] UPDATE photos failed', updateErr.message)
    return NextResponse.json(
      { ok: false, vision_status: 'failed', error: updateErr.message },
      { status: 500 },
    )
  }

  // ── 9. UPSERT dossier_field_values ────────────────────────────────
  let upsertedCount = 0
  if (result.fieldHints.length > 0) {
    upsertedCount = await upsertFieldValues({
      supabase,
      orgId,
      dossierId: photo.dossier_id as string,
      sourcePhotoId: photoId,
      hints: result.fieldHints,
    })
  }

  // ── 10. Track usage (ai_usage) ────────────────────────────────────
  // cost_eur ≈ cost_usd * 0.93 (taux fixe — sera dynamique en V2)
  await supabase.from('ai_usage').insert({
    organization_id: orgId,
    user_id: userId,
    provider: 'anthropic',
    model: visionOutput.model,
    operation: 'vision_capture_photo',
    input_tokens: visionOutput.inputTokens,
    output_tokens: visionOutput.outputTokens,
    cached_tokens: visionOutput.cacheReadTokens,
    cost_eur: Math.round(visionOutput.costUsd * 0.93 * 1_000_000) / 1_000_000,
    latency_ms: totalLatencyMs,
  })

  return NextResponse.json({
    ok: true,
    vision_status: 'analyzed' as const,
    fields_extracted: upsertedCount,
    cost_usd: visionOutput.costUsd,
  })
}

// ============================================
// Helpers
// ============================================

type SupabaseLike = Awaited<ReturnType<typeof getCurrentUser>>['supabase']

async function markFailed(
  supabase: SupabaseLike,
  photoId: string,
  orgId: string,
  reason: string,
): Promise<void> {
  await supabase
    .from('photos')
    .update({ vision_status: 'failed', analyzed_at: new Date().toISOString() })
    .eq('id', photoId)
    .eq('organization_id', orgId)
  console.error('[vision/analyze] failed', { photoId, reason })
}

/**
 * Cherche l'annotation associée à la photo.
 * Priorité : voice_notes.attached_photo_id (transcrit) > mission_text_notes.attached_photo_id.
 *
 * Retourne `null` si aucune annotation pertinente.
 */
async function loadAnnotation(
  supabase: SupabaseLike,
  photoId: string,
  orgId: string,
): Promise<{ kind: 'voice' | 'text'; content: string } | null> {
  // Colonnes/tables ajoutées par la migration capture_first (pas encore dans le
  // type généré) — on cast via `as never` aux endroits ciblés.

  // 1. Voice note attachée et transcrite
  const voiceQuery = await supabase
    .from('voice_notes')
    .select('edited_transcription, transcript_raw, transcription_status')
    .eq('attached_photo_id' as never, photoId)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const voice = voiceQuery.data as {
    edited_transcription: string | null
    transcript_raw: string | null
    transcription_status: string | null
  } | null

  if (voice) {
    const transcribed =
      typeof voice.edited_transcription === 'string' && voice.edited_transcription.trim().length > 0
        ? voice.edited_transcription.trim()
        : typeof voice.transcript_raw === 'string' && voice.transcript_raw.trim().length > 0
          ? voice.transcript_raw.trim()
          : null
    if (transcribed) {
      return { kind: 'voice', content: transcribed.slice(0, 2000) }
    }
  }

  // 2. Text note attachée
  const textQuery = await supabase
    .from('mission_text_notes' as never)
    .select('text')
    .eq('attached_photo_id', photoId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const textNote = textQuery.data as { text: string } | null

  if (textNote && typeof textNote.text === 'string' && textNote.text.trim().length > 0) {
    return { kind: 'text', content: textNote.text.trim().slice(0, 2000) }
  }

  return null
}

/**
 * UPSERT des field_hints dans dossier_field_values.
 *
 * Règles d'écrasement (cf. brief iteration 3) :
 *   - Si la row n'existe pas → INSERT.
 *   - Si la row existe ET validated_by_user=true → on ne touche PAS la value (champ
 *     validé manuellement par l'utilisateur). On peut juste flagger has_conflict si
 *     la nouvelle valeur diffère, mais en iteration 3 on reste simple : on skip.
 *   - Si la row existe ET nouvelle confidence > existante → UPDATE.
 *   - Si la row existe ET existante.confidence IS NULL → UPDATE (priorité au signal IA).
 *   - Sinon : skip.
 *
 * Retourne le nombre de rows INSERT ou UPDATE effectivement appliquées.
 */
async function upsertFieldValues(args: {
  supabase: SupabaseLike
  orgId: string
  dossierId: string
  sourcePhotoId: string
  hints: VisionAnalysisFieldHint[]
}): Promise<number> {
  const { supabase, orgId, dossierId, sourcePhotoId, hints } = args
  let applied = 0

  // Table `dossier_field_values` ajoutée par la migration capture_first —
  // pas encore dans le type Supabase généré. Cast `as never` sur la table.
  const tableRef = 'dossier_field_values' as never

  for (const hint of hints) {
    const existingQuery = await supabase
      .from(tableRef)
      .select('id, confidence, validated_by_user')
      .eq('dossier_id', dossierId)
      .eq('diagnostic_type', hint.diagnosticType)
      .eq('field_path', hint.fieldPath)
      .maybeSingle()

    const existing = existingQuery.data as {
      id: string
      confidence: number | null
      validated_by_user: boolean | null
    } | null

    if (existing) {
      // Validé manuellement → on ne touche pas.
      if (existing.validated_by_user === true) continue

      const existingConf = typeof existing.confidence === 'number' ? existing.confidence : null
      const shouldOverwrite = existingConf === null || hint.confidence > existingConf
      if (!shouldOverwrite) continue

      const { error: updErr } = await supabase
        .from(tableRef)
        .update({
          value: hint.value,
          unit: hint.unit,
          source_type: 'photo_vision',
          source_photo_id: sourcePhotoId,
          source_voice_id: null,
          source_text_id: null,
          source_document_id: null,
          confidence: hint.confidence,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', existing.id)
        .eq('organization_id', orgId)
      if (!updErr) applied++
    } else {
      const { error: insErr } = await supabase.from(tableRef).insert({
        organization_id: orgId,
        dossier_id: dossierId,
        diagnostic_type: hint.diagnosticType,
        field_path: hint.fieldPath,
        value: hint.value,
        unit: hint.unit,
        source_type: 'photo_vision',
        source_photo_id: sourcePhotoId,
        confidence: hint.confidence,
        validated_by_user: false,
        has_conflict: false,
      } as never)
      if (!insErr) applied++
    }
  }

  return applied
}

/**
 * Confidence globale d'une photo = moyenne des confidences des field_hints,
 * arrondie à 2 décimales. Retourne null si aucun field_hint.
 */
function computeOverallConfidence(hints: VisionAnalysisFieldHint[]): number | null {
  if (hints.length === 0) return null
  const sum = hints.reduce((acc, h) => acc + h.confidence, 0)
  const mean = sum / hints.length
  return Math.round(mean * 100) / 100
}
