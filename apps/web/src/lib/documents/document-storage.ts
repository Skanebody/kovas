/**
 * KOVAS — Document Intelligence : helpers Supabase Storage bucket `documents`.
 *
 * Pattern aligné sur lib/mission/sync-manager.ts (upsert idempotent +
 * service-role download).
 *
 * Path convention :
 *   - Raw file   : <userId>/<uuid>.<ext>
 *   - Thumbnail  : <userId>/thumbs/<uuid>.jpg
 *
 * RLS storage.objects vérifie que (string_to_array(name, '/'))[1]::uuid = auth.uid()
 * (cf. migration 20260523140000_documents.sql).
 *
 * Note V1 : la compression / thumbnail générée côté client (canvas) avant l'upload.
 * Ce helper côté serveur uploade les bytes tels quels (pas de re-compression
 * server — pas de `sharp` installé dans le projet).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'documents'
const SIGNED_URL_TTL_SECONDS = 3600 // 1h

export interface UploadResult {
  path: string
  /** URL signée pour preview immédiate (1h). */
  signedUrl: string | null
}

/**
 * Upload un blob/buffer dans le bucket `documents`.
 * Le path doit déjà commencer par `<userId>/...` (RLS).
 */
export async function uploadDocument(
  supabase: SupabaseClient,
  path: string,
  data: Blob | Buffer | Uint8Array,
  mimeType: string,
): Promise<UploadResult> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, data, {
    contentType: mimeType,
    cacheControl: '3600',
    upsert: true,
  })
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`)
  }

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  return { path, signedUrl: signed?.signedUrl ?? null }
}

/**
 * Download bytes du Storage. À utiliser avec un client service-role pour
 * bypasser RLS lors d'opérations serveur (IA, batch processing).
 */
export async function downloadDocumentBytes(
  supabase: SupabaseClient,
  path: string,
): Promise<{ bytes: Buffer; mimeType: string }> {
  const { data: blob, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !blob) {
    throw new Error(`Storage download failed: ${error?.message ?? 'no blob'}`)
  }
  const arrayBuffer = await blob.arrayBuffer()
  const bytes = Buffer.from(arrayBuffer)
  // blob.type = mime depuis Storage metadata
  const mimeType = blob.type || 'application/octet-stream'
  return { bytes, mimeType }
}

/**
 * Supprime fichier + thumbnail (best-effort, ne throw pas si l'un manque).
 */
export async function deleteDocument(
  supabase: SupabaseClient,
  paths: { rawFilePath: string; thumbnailPath: string | null },
): Promise<void> {
  const toDelete = [paths.rawFilePath, paths.thumbnailPath].filter((p): p is string => Boolean(p))
  if (toDelete.length === 0) return
  await supabase.storage.from(BUCKET).remove(toDelete)
}

/**
 * URL signée courte durée pour preview.
 */
export async function createSignedUrl(
  supabase: SupabaseClient,
  path: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttlSeconds)
  if (error) return null
  return data?.signedUrl ?? null
}

/**
 * Convertit un File/Blob en Buffer Node (pour les routes API).
 */
export async function fileToBuffer(file: File | Blob): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Détermine l'extension à partir du mime type.
 */
export function mimeToExt(mimeType: string): string {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg'
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('webp')) return 'webp'
  if (mimeType.includes('heic')) return 'heic'
  if (mimeType.includes('pdf')) return 'pdf'
  return 'bin'
}

export { BUCKET as DOCUMENTS_BUCKET }
