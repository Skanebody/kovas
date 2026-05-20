/**
 * KOVAS — Document Intelligence API : GET /api/documents/dossier/[dossierId].
 *
 * Liste les documents attachés à un dossier (RLS user_id = auth.uid()).
 * Renvoie le minimum nécessaire pour les listes UI (pas de download bytes).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { createSignedUrl } from '@/lib/documents/document-storage'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dossierId: string }> },
): Promise<NextResponse> {
  const { dossierId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(dossierId)) {
    return NextResponse.json({ error: 'invalid dossierId' }, { status: 400 })
  }

  let userId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    userId = u.user.id
    supabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: docs, error: docsErr } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
    .from('documents' as any)
    .select(
      'id, raw_file_path, thumbnail_path, file_size_bytes, mime_type, original_filename, source, document_type, status, classification_confidence, ocr_text, created_at',
    )
    .eq('user_id', userId)
    .eq('dossier_id', dossierId)
    .order('created_at', { ascending: false })

  if (docsErr) {
    return NextResponse.json({ error: docsErr.message }, { status: 500 })
  }

  const rows = (docs ?? []) as unknown as Array<{
    id: string
    raw_file_path: string
    thumbnail_path: string | null
    file_size_bytes: number | null
    mime_type: string | null
    original_filename: string | null
    source: string
    document_type: string | null
    status: string
    classification_confidence: number | null
    ocr_text: string | null
    created_at: string
  }>

  // Signed URLs (parallel)
  const enriched = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      thumbnailUrl: row.thumbnail_path ? await createSignedUrl(supabase, row.thumbnail_path) : null,
    })),
  )

  return NextResponse.json({ ok: true, documents: enriched })
}
