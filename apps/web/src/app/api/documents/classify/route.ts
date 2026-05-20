/**
 * KOVAS — Document Intelligence API : POST /api/documents/classify.
 *
 * Permet de relancer la classification IA sur un document existant (utile si
 * l'upload initial a échoué côté classifier, ou si le user veut forcer un retry).
 *
 * Body : { documentId: string }
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ClassificationError, classifyDocument } from '@/lib/documents/document-classifier'
import { downloadDocumentBytes } from '@/lib/documents/document-storage'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

interface ClassifyBody {
  documentId: string
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

  let body: ClassifyBody
  try {
    body = (await request.json()) as ClassifyBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!body.documentId || typeof body.documentId !== 'string') {
    return NextResponse.json({ error: 'documentId required' }, { status: 400 })
  }

  // Charge la row + check ownership
  const { data: doc, error: docErr } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
    .from('documents' as any)
    .select('id, raw_file_path, mime_type, user_id')
    .eq('id', body.documentId)
    .eq('user_id', userId)
    .maybeSingle()

  const docRow = doc as {
    id: string
    raw_file_path: string
    mime_type: string | null
    user_id: string
  } | null

  if (docErr || !docRow) {
    return NextResponse.json({ error: 'document not found' }, { status: 404 })
  }
  if (!docRow.mime_type) {
    return NextResponse.json({ error: 'mime_type missing on row' }, { status: 400 })
  }

  // Download bytes via service-role
  const admin = createAdminClient()
  let base64: string
  try {
    const { bytes } = await downloadDocumentBytes(admin, docRow.raw_file_path)
    base64 = bytes.toString('base64')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'download failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  try {
    const classification = await classifyDocument(docRow.id, base64, docRow.mime_type, supabase)
    return NextResponse.json({
      ok: true,
      classification: {
        type: classification.type,
        confidence: classification.confidence,
        alternativeTypes: classification.alternativeTypes,
        textPreview: classification.textPreview,
      },
    })
  } catch (e) {
    const code = e instanceof ClassificationError ? e.code : 'unknown'
    const msg = e instanceof Error ? e.message : 'classify failed'
    const status = code === 'config_missing' ? 503 : 500
    await supabase
      // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
      .from('documents' as any)
      .update({ status: 'error' })
      .eq('id', body.documentId)
    return NextResponse.json({ error: msg, code }, { status })
  }
}
