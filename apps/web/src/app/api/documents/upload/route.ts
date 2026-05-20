/**
 * KOVAS — Document Intelligence API : POST /api/documents/upload.
 *
 * Pipeline :
 *   1. Auth + ownership (getCurrentUser)
 *   2. Parse multipart/form-data (file + optionnel: source, dossierId, clientId)
 *   3. captureDocument() → INSERT documents row + upload Storage (avec quota check)
 *   4. Lance la classification IA en synchrone (Haiku rapide, ~1-2s) → update row
 *   5. Renvoie { document, classification }
 *
 * Note V1 : la classification est synchrone car Haiku est très rapide. Si latence
 * problème en prod, basculer vers fire-and-forget (cf. sync-manager.ts pour pattern).
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { DocumentSource } from '@/lib/documents/backend-types'
import { CaptureError, captureDocument } from '@/lib/documents/document-capture'
import { ClassificationError, classifyDocument } from '@/lib/documents/document-classifier'
import { downloadDocumentBytes } from '@/lib/documents/document-storage'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const VALID_SOURCES: ReadonlySet<DocumentSource> = new Set<DocumentSource>([
  'camera',
  'file_upload',
  'drag_drop',
  'email_import',
  'drive_import',
])

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Auth
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

  // 2. Parse multipart
  let formData: FormData
  try {
    formData = await request.formData()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'invalid form'
    return NextResponse.json({ error: `multipart invalid: ${msg}` }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file missing' }, { status: 400 })
  }

  const sourceRaw = formData.get('source')
  const source: DocumentSource =
    typeof sourceRaw === 'string' && VALID_SOURCES.has(sourceRaw as DocumentSource)
      ? (sourceRaw as DocumentSource)
      : 'file_upload'

  const dossierIdRaw = formData.get('dossierId')
  const dossierId =
    typeof dossierIdRaw === 'string' && dossierIdRaw.length > 0 ? dossierIdRaw : null
  const clientIdRaw = formData.get('clientId')
  const clientId = typeof clientIdRaw === 'string' && clientIdRaw.length > 0 ? clientIdRaw : null

  // 3. Capture (quota + storage + INSERT row)
  let captured: Awaited<ReturnType<typeof captureDocument>>
  try {
    captured = await captureDocument(
      {
        source,
        file,
        originalFilename: file.name,
        mimeType: file.type,
        dossierId,
        clientId,
        userId,
        organizationId: orgId,
      },
      supabase,
    )
  } catch (e) {
    if (e instanceof CaptureError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.httpStatus })
    }
    const msg = e instanceof Error ? e.message : 'capture failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // 4. Classification automatique (synchrone)
  let classification: Awaited<ReturnType<typeof classifyDocument>> | null = null
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      // Download bytes via service-role (le user a juste uploadé, RLS OK aussi)
      const admin = createAdminClient()
      const { bytes } = await downloadDocumentBytes(
        admin,
        captured.rawFileUrl
          ? `${userId}/${captured.id}.${mimeToExt(captured.mimeType)}`
          : `${userId}/${captured.id}.${mimeToExt(captured.mimeType)}`,
      )
      const base64 = bytes.toString('base64')
      classification = await classifyDocument(captured.id, base64, captured.mimeType, supabase)
    } catch (e) {
      // Classification a échoué — on ne fait pas échouer l'upload, le user pourra réessayer
      const msg = e instanceof Error ? e.message : 'unknown'
      const code = e instanceof ClassificationError ? e.code : 'unknown'
      console.warn('[documents/upload] classify failed', { documentId: captured.id, msg, code })
      await supabase
        // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
        .from('documents' as any)
        .update({ status: 'error' })
        .eq('id', captured.id)
    }
  }

  return NextResponse.json({
    ok: true,
    document: {
      id: captured.id,
      rawFileUrl: captured.rawFileUrl,
      thumbnailUrl: captured.thumbnailUrl,
      fileSizeBytes: captured.fileSizeBytes,
      mimeType: captured.mimeType,
      source: captured.source,
      capturedAt: captured.capturedAt.toISOString(),
    },
    classification: classification
      ? {
          type: classification.type,
          confidence: classification.confidence,
          alternativeTypes: classification.alternativeTypes,
          textPreview: classification.textPreview,
        }
      : null,
  })
}

function mimeToExt(mime: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('heic')) return 'heic'
  if (mime.includes('pdf')) return 'pdf'
  return 'bin'
}
