/**
 * KOVAS — Document Intelligence API : GET + DELETE /api/documents/[id].
 *
 * GET : récupère doc + dernière extraction + validation réglementaire.
 *       Renvoie aussi des signed URLs pour preview (raw + thumbnail).
 * DELETE : supprime row + Storage (idempotent).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { createSignedUrl, deleteDocument } from '@/lib/documents/document-storage'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
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

  const { data: doc, error: docErr } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
    .from('documents' as any)
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  const docRow = doc as Record<string, unknown> | null

  if (docErr || !docRow) {
    return NextResponse.json({ error: 'document not found' }, { status: 404 })
  }

  // Dernière extraction
  const { data: extraction } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: table `document_extractions` pas encore dans le type Database généré
    .from('document_extractions' as any)
    .select('*')
    .eq('document_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Signed URLs preview
  const rawFilePath = docRow.raw_file_path as string
  const thumbnailPath = (docRow.thumbnail_path as string | null) ?? null

  const [rawUrl, thumbUrl] = await Promise.all([
    createSignedUrl(supabase, rawFilePath),
    thumbnailPath ? createSignedUrl(supabase, thumbnailPath) : Promise.resolve(null),
  ])

  return NextResponse.json({
    ok: true,
    document: {
      ...docRow,
      rawFileUrl: rawUrl,
      thumbnailUrl: thumbUrl,
    },
    extraction: extraction ?? null,
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
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

  // Charge paths Storage avant DELETE row
  const { data: doc } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
    .from('documents' as any)
    .select('raw_file_path, thumbnail_path')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  const docRow = doc as { raw_file_path: string; thumbnail_path: string | null } | null
  if (!docRow) {
    return NextResponse.json({ ok: true, deleted: false, reason: 'not found' })
  }

  // Delete row (CASCADE supprime document_extractions, document_corrections)
  const { error: delErr } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
    .from('documents' as any)
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (delErr) {
    return NextResponse.json({ error: `delete row: ${delErr.message}` }, { status: 500 })
  }

  // Delete Storage (best-effort)
  try {
    await deleteDocument(supabase, {
      rawFilePath: docRow.raw_file_path,
      thumbnailPath: docRow.thumbnail_path,
    })
  } catch (e) {
    console.warn(
      '[documents/delete] storage cleanup failed',
      e instanceof Error ? e.message : 'unknown',
    )
  }

  return NextResponse.json({ ok: true, deleted: true })
}
