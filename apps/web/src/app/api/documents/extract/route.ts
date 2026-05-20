/**
 * KOVAS — Document Intelligence API : POST /api/documents/extract.
 *
 * Lance l'extraction structurée sur un document déjà classifié. Dispatch vers
 * le bon extracteur selon document_type. Stocke le résultat dans
 * document_extractions + lance la regulatory_validation.
 *
 * Body : { documentId: string, transactionType?: 'vente' | 'location' }
 *
 * Types non-V1 (audit_energetique, amiante, plomb, ...) → 501 Not Implemented.
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import { getCurrentUser } from '@/lib/auth/current-user'
import { type BackendDocumentType, isBackendDocumentType } from '@/lib/documents/backend-types'
import { ExtractionError, dispatchExtraction } from '@/lib/documents/document-extractors'
import { downloadDocumentBytes } from '@/lib/documents/document-storage'
import { validateRegulatory } from '@/lib/documents/regulatory-validator'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120 // extraction peut prendre 20-40s sur PDF dense

interface ExtractBody {
  documentId: string
  transactionType?: 'vente' | 'location'
}

export async function POST(request: Request): Promise<NextResponse> {
  let userId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    userId = u.user.id
    supabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: ExtractBody
  try {
    body = (await request.json()) as ExtractBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!body.documentId || typeof body.documentId !== 'string') {
    return NextResponse.json({ error: 'documentId required' }, { status: 400 })
  }

  const transactionType = body.transactionType === 'location' ? 'location' : 'vente' // default = vente

  // Charge row + check ownership
  const { data: doc, error: docErr } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
    .from('documents' as any)
    .select('id, raw_file_path, mime_type, document_type, user_id, status')
    .eq('id', body.documentId)
    .eq('user_id', userId)
    .maybeSingle()

  const docRow = doc as {
    id: string
    raw_file_path: string
    mime_type: string | null
    document_type: string | null
    user_id: string
    status: string
  } | null

  if (docErr || !docRow) {
    return NextResponse.json({ error: 'document not found' }, { status: 404 })
  }

  if (!docRow.mime_type) {
    return NextResponse.json({ error: 'mime_type missing on row' }, { status: 400 })
  }
  if (!docRow.document_type || !isBackendDocumentType(docRow.document_type)) {
    return NextResponse.json({ error: 'document_type missing — classify first' }, { status: 400 })
  }
  const documentType: BackendDocumentType = docRow.document_type

  // Download bytes
  const admin = createAdminClient()
  let base64: string
  try {
    const { bytes } = await downloadDocumentBytes(admin, docRow.raw_file_path)
    base64 = bytes.toString('base64')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'download failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Dispatch extraction
  let dispatchResult: Awaited<ReturnType<typeof dispatchExtraction>>
  try {
    dispatchResult = await dispatchExtraction(
      documentType,
      docRow.id,
      base64,
      docRow.mime_type,
      supabase,
    )
  } catch (e) {
    if (e instanceof ExtractionError) {
      const status =
        e.code === 'not_implemented'
          ? 501
          : e.code === 'config_missing'
            ? 503
            : e.code === 'unsupported_mime'
              ? 415
              : 500
      await supabase
        // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
        .from('documents' as any)
        .update({ status: 'error' })
        .eq('id', body.documentId)
      return NextResponse.json({ error: e.message, code: e.code }, { status })
    }
    const msg = e instanceof Error ? e.message : 'extract failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Regulatory validation
  const validation = validateRegulatory(documentType, dispatchResult.data, {
    transactionType,
  })

  // Persiste extraction + update status
  const { error: insErr } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: table `document_extractions` pas encore dans le type Database généré
    .from('document_extractions' as any)
    .insert({
      document_id: docRow.id,
      extraction_data: dispatchResult.data,
      confidence_by_field: dispatchResult.confidenceByField,
      regulatory_validation: validation,
      ai_model: dispatchResult.model,
      ai_input_tokens: dispatchResult.inputTokens,
      ai_output_tokens: dispatchResult.outputTokens,
      ai_cost_eur: dispatchResult.costEur,
    })

  if (insErr) {
    return NextResponse.json({ error: `persist extraction: ${insErr.message}` }, { status: 500 })
  }

  await supabase
    // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
    .from('documents' as any)
    .update({ status: 'extracted' })
    .eq('id', body.documentId)

  return NextResponse.json({
    ok: true,
    documentType,
    extraction: dispatchResult.data,
    confidenceByField: dispatchResult.confidenceByField,
    regulatoryValidation: validation,
    cost: {
      eur: dispatchResult.costEur,
      model: dispatchResult.model,
      durationMs: dispatchResult.durationMs,
    },
  })
}
