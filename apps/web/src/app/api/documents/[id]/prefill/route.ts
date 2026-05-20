/**
 * KOVAS — Document Intelligence API : POST /api/documents/[id]/prefill.
 *
 * Applique le confidence-routing sur la dernière extraction d'un document, puis
 * UPSERT les champs auto-validated (≥ 90%) dans dossier_field_values. Les
 * fields toVerify (70-89%) sont renvoyés au client UI (composant ReviewPanel).
 * Les ignored (< 70%) ne sont pas persistés.
 *
 * Body : { dossierId: string }
 *
 * Note : la persistance respecte la règle "validated_by_user = true → ne pas
 * écraser" (alignement avec lib/mission/vision-analyzer.ts upsertFieldValues).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { type BackendDocumentType, isBackendDocumentType } from '@/lib/documents/backend-types'
import {
  type PrefillResult,
  type PrefilledField,
  getFieldMapping,
  routeByConfidence,
} from '@/lib/documents/confidence-router'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

interface PrefillBody {
  dossierId: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: documentId } = await params

  let userId: string
  let orgId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    userId = u.user.id
    orgId = u.orgId
    supabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: PrefillBody
  try {
    body = (await request.json()) as PrefillBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!body.dossierId) {
    return NextResponse.json({ error: 'dossierId required' }, { status: 400 })
  }

  // Charge document + dernière extraction
  const { data: doc, error: docErr } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
    .from('documents' as any)
    .select('id, document_type, user_id')
    .eq('id', documentId)
    .eq('user_id', userId)
    .maybeSingle()

  const docRow = doc as { id: string; document_type: string | null; user_id: string } | null

  if (docErr || !docRow) {
    return NextResponse.json({ error: 'document not found' }, { status: 404 })
  }
  if (!docRow.document_type || !isBackendDocumentType(docRow.document_type)) {
    return NextResponse.json({ error: 'document_type missing' }, { status: 400 })
  }
  const documentType: BackendDocumentType = docRow.document_type

  // Récupère extraction la plus récente
  const { data: extraction } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: table `document_extractions` pas encore dans le type Database généré
    .from('document_extractions' as any)
    .select('extraction_data, confidence_by_field')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const extractionRow = extraction as {
    extraction_data: unknown
    confidence_by_field: Record<string, number> | null
  } | null

  if (!extractionRow) {
    return NextResponse.json({ error: 'no extraction available — extract first' }, { status: 400 })
  }

  // Verify dossier ownership
  const { data: dossier } = await supabase
    .from('dossiers')
    .select('id, organization_id')
    .eq('id', body.dossierId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!dossier) {
    return NextResponse.json({ error: 'dossier not found' }, { status: 404 })
  }

  // Route by confidence
  const fieldMapping = getFieldMapping(documentType)
  const prefill: PrefillResult = routeByConfidence(
    extractionRow.extraction_data,
    extractionRow.confidence_by_field ?? {},
    documentId,
    fieldMapping,
  )

  // UPSERT auto-validated dans dossier_field_values
  let appliedCount = 0
  for (const field of prefill.autoValidated) {
    const applied = await upsertDossierField(supabase, orgId, body.dossierId, documentType, field)
    if (applied) appliedCount++
  }

  // Update prefill_summary sur la dernière extraction (pour audit)
  await supabase
    // biome-ignore lint/suspicious/noExplicitAny: table `document_extractions` pas encore dans le type Database généré
    .from('document_extractions' as any)
    .update({
      prefill_summary: {
        autoValidated: prefill.autoValidated.length,
        toVerify: prefill.toVerify.length,
        ignored: prefill.ignored.length,
        appliedToDossier: appliedCount,
        dossierId: body.dossierId,
      },
    })
    .eq('document_id', documentId)

  // Mark doc as prefilled
  await supabase
    // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
    .from('documents' as any)
    .update({ status: 'prefilled' })
    .eq('id', documentId)

  return NextResponse.json({
    ok: true,
    autoValidated: prefill.autoValidated,
    toVerify: prefill.toVerify,
    ignored: prefill.ignored,
    appliedCount,
  })
}

// ============================================
// Helpers
// ============================================

/**
 * UPSERT respectueux dans dossier_field_values.
 *
 * Mapping field.fieldPath ("dpe.energy_class", "property.surface_total", ...)
 * → diagnostic_type + field_path (pour les "dpe.*") ou skip (pour les
 * "property.*" qui touchent properties — V1.5 on log seulement).
 *
 * V1.5 : on stocke tout dans dossier_field_values (diagnostic_type='DPE' pour
 * "dpe.*", autre dans field_path direct). La synchro proprement dite avec la
 * row properties est gérée par UI / serveur dossier (autre agent).
 */
async function upsertDossierField(
  supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase'],
  orgId: string,
  dossierId: string,
  documentType: BackendDocumentType,
  field: PrefilledField,
): Promise<boolean> {
  // Détecte le diagnostic_type à partir du préfixe
  const [prefix, ...rest] = field.fieldPath.split('.')
  const subFieldPath = rest.join('.')

  // Map prefix → diagnostic_type
  let diagnosticType: string
  let fieldPathForDb: string
  if (prefix === 'dpe') {
    diagnosticType = 'DPE'
    fieldPathForDb = subFieldPath
  } else if (
    prefix === 'property' ||
    prefix === 'plan' ||
    prefix === 'energy' ||
    prefix === 'equipment'
  ) {
    // Champs non liés à un diagnostic réglementaire : on stocke avec un
    // diagnostic_type=DPE par convention (les colonnes property_X sont
    // pré-remplies via les exports DPE typiquement).
    diagnosticType = 'DPE'
    fieldPathForDb = field.fieldPath // garde le préfixe pour traçabilité
  } else {
    diagnosticType = 'DPE'
    fieldPathForDb = field.fieldPath
  }

  // Force documentType — utilisé pour mapper plus précisément quand on
  // ajoutera amiante/plomb/etc. en V1.5.
  if (documentType === 'amiante') diagnosticType = 'AMIANTE'
  else if (documentType === 'plomb') diagnosticType = 'PLOMB'

  // Check existing
  const tableRef = 'dossier_field_values' as never
  const existingQuery = await supabase
    .from(tableRef)
    .select('id, confidence, validated_by_user')
    .eq('dossier_id', dossierId)
    .eq('diagnostic_type', diagnosticType)
    .eq('field_path', fieldPathForDb)
    .maybeSingle()

  const existing = existingQuery.data as {
    id: string
    confidence: number | null
    validated_by_user: boolean | null
  } | null

  if (existing) {
    if (existing.validated_by_user === true) return false
    const existingConf = typeof existing.confidence === 'number' ? existing.confidence : null
    // confidence stocké en 0-1 dans dossier_field_values, mais nos confidences
    // documents sont 0-100 → on normalise
    const newConfNormalized = field.confidence / 100
    if (existingConf !== null && newConfNormalized <= existingConf) return false

    const { error: updErr } = await supabase
      .from(tableRef)
      .update({
        value: field.value,
        source_type: 'document_ocr',
        source_document_id: field.sourceDocumentId,
        source_photo_id: null,
        source_voice_id: null,
        source_text_id: null,
        confidence: newConfNormalized,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', existing.id)
      .eq('organization_id', orgId)
    return !updErr
  }

  // INSERT
  const { error: insErr } = await supabase.from(tableRef).insert({
    organization_id: orgId,
    dossier_id: dossierId,
    diagnostic_type: diagnosticType,
    field_path: fieldPathForDb,
    value: field.value,
    source_type: 'document_ocr',
    source_document_id: field.sourceDocumentId,
    confidence: field.confidence / 100,
    validated_by_user: false,
    has_conflict: false,
  } as never)
  return !insErr
}
