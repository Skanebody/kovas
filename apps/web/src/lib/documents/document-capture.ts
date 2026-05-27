/**
 * KOVAS — Document Intelligence : capture (entrée pipeline).
 *
 * Étape 1 du pipeline :
 *   1. Vérifie + déduit le quota mensuel via quota-enforcer
 *   2. (V1 : skip compression server-side — fait côté client via canvas)
 *   3. Génère un thumbnail si possible (skip si pas de lib — V1 : copie le raw
 *      file comme thumbnail pour PDFs / fallback)
 *   4. Upload bucket `documents` (raw + thumbnail)
 *   5. INSERT row documents status='captured'
 *
 * Le client UI peut ensuite POST /api/documents/classify pour déclencher
 * la classification IA + extraction.
 */

import { randomUUID } from 'node:crypto'
import { StorageQuotaExceeded, assertStorageAvailable } from '@/lib/storage/quota'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DocumentSource } from './backend-types'
import { fileToBuffer, mimeToExt, uploadDocument } from './document-storage'
import { checkAndDeductQuota } from './quota-enforcer'

const MAX_RAW_BYTES = 20 * 1024 * 1024 // 20 MB (cohérent avec storage bucket limit)

export interface DocumentCaptureInput {
  source: DocumentSource
  file: File | Blob
  /** Filename d'origine (optionnel, pour traçabilité). */
  originalFilename?: string | null
  /** MIME type — utile si Blob (File a déjà .type). */
  mimeType?: string
  dossierId?: string | null
  clientId?: string | null
  userId: string
  organizationId: string
}

export interface CapturedDocument {
  id: string
  rawFileUrl: string
  thumbnailUrl: string
  fileSizeBytes: number
  mimeType: string
  capturedAt: Date
  source: DocumentSource
}

export class CaptureError extends Error {
  readonly code:
    | 'quota_exceeded'
    | 'storage_quota_exceeded'
    | 'file_too_large'
    | 'invalid_mime'
    | 'storage_failed'
    | 'db_failed'
  readonly httpStatus: number

  constructor(code: CaptureError['code'], message: string, httpStatus: number) {
    super(message)
    this.name = 'CaptureError'
    this.code = code
    this.httpStatus = httpStatus
  }
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
])

/**
 * Capture un document.
 *
 * @param input  données de capture + ownership (userId, orgId)
 * @param supabase client Supabase (côté serveur, service-role OU user-scoped si RLS-friendly)
 */
export async function captureDocument(
  input: DocumentCaptureInput,
  supabase: SupabaseClient,
): Promise<CapturedDocument> {
  // 1. Quota scans mensuel (Document Intelligence) — check + deduct atomique
  const quotaResult = await checkAndDeductQuota(input.userId, supabase)
  if (!quotaResult.ok) {
    throw new CaptureError('quota_exceeded', quotaResult.reason ?? 'Quota dépassé', 402)
  }

  const fileSize = input.file.size
  if (fileSize > MAX_RAW_BYTES) {
    throw new CaptureError(
      'file_too_large',
      `Fichier trop volumineux : ${Math.round(fileSize / 1024 / 1024)} Mo > 20 Mo`,
      413,
    )
  }

  // 1bis. Quota stockage organisation — vérifie qu'on a la place pour ce fichier
  //       (raw + thumbnail, donc on compte ~2× la taille du fichier image)
  try {
    const isImage = (
      input.mimeType ?? (input.file instanceof File ? input.file.type : '')
    ).startsWith('image/')
    const projectedSize = isImage ? fileSize * 2 : fileSize
    await assertStorageAvailable(supabase, input.organizationId, projectedSize)
  } catch (e) {
    if (e instanceof StorageQuotaExceeded) {
      throw new CaptureError('storage_quota_exceeded', e.message, 413)
    }
    throw e
  }

  const mimeType =
    input.mimeType ??
    (input.file instanceof File ? input.file.type : null) ??
    'application/octet-stream'

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new CaptureError('invalid_mime', `Type ${mimeType} non supporté`, 415)
  }

  // 2. Génère un UUID stable pour la row + le path Storage
  const documentId = randomUUID()
  const ext = mimeToExt(mimeType)
  const rawFilePath = `${input.userId}/${documentId}.${ext}`

  // 3. Thumbnail : V1 → on copie le raw file comme thumbnail pour images
  //    (le client UI affichera la même image, c'est OK car raw déjà <= 1600px côté client).
  //    Pour PDF : pas de thumbnail server-side (pas de lib pdf2image installée).
  //    Le client générera un preview en V1.5 via pdf.js.
  const isImage = mimeType.startsWith('image/')
  const thumbnailPath: string | null = isImage
    ? `${input.userId}/thumbs/${documentId}.${ext}`
    : null

  // 4. Convertit le File en Buffer pour upload côté Node
  const bytes = await fileToBuffer(input.file)

  // 5. Upload raw + thumbnail (idempotent, upsert=true)
  let signedRawUrl: string | null
  let signedThumbUrl: string | null = null
  try {
    const rawUpload = await uploadDocument(supabase, rawFilePath, bytes, mimeType)
    signedRawUrl = rawUpload.signedUrl

    if (thumbnailPath) {
      const thumbUpload = await uploadDocument(supabase, thumbnailPath, bytes, mimeType)
      signedThumbUrl = thumbUpload.signedUrl
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    throw new CaptureError('storage_failed', `Upload Storage : ${msg}`, 500)
  }

  // 6. INSERT row documents
  const insertPayload = {
    id: documentId,
    user_id: input.userId,
    organization_id: input.organizationId,
    dossier_id: input.dossierId ?? null,
    client_id: input.clientId ?? null,
    raw_file_path: rawFilePath,
    thumbnail_path: thumbnailPath,
    file_size_bytes: fileSize,
    mime_type: mimeType,
    original_filename:
      input.originalFilename ?? (input.file instanceof File ? input.file.name : null),
    source: input.source,
    status: 'captured' as const,
  }

  const { error: insErr } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
    .from('documents' as any)
    .insert(insertPayload)

  if (insErr) {
    throw new CaptureError('db_failed', `INSERT documents : ${insErr.message}`, 500)
  }

  return {
    id: documentId,
    rawFileUrl: signedRawUrl ?? '',
    thumbnailUrl: signedThumbUrl ?? signedRawUrl ?? '',
    fileSizeBytes: fileSize,
    mimeType,
    capturedAt: new Date(),
    source: input.source,
  }
}
