/**
 * KOVAS — Route API POST /api/client-photo-upload (publique, token-protected)
 *
 * Proxie l'upload multipart de la page publique `/upload-photo/[token]`
 * vers l'Edge Function `upload-client-photo` (qui fait la persistance
 * Storage + photos + update du request).
 *
 * Body : multipart/form-data
 *   - token : string
 *   - file  : File (image/*)
 *
 * Pas d'auth Supabase requise : le token sert d'identification.
 *
 * Réponse :
 *   200 { ok: true, photoId, storagePath }
 *   400 { error: 'invalid_token' | 'invalid_file' | 'expired' | 'already_used' }
 *   500 { error: 'internal_error' }
 *   502 { error: 'edge_unreachable' }
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 Mo

export async function POST(request: Request): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_multipart' }, { status: 400 })
  }

  const token = formData.get('token')
  const file = formData.get('file')

  if (typeof token !== 'string' || token.length < 16) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'invalid_file' }, { status: 400 })
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'invalid_file', message: 'size' }, { status: 400 })
  }

  // Forward direct vers l'Edge Function (qui re-vérifie tout)
  const edgeFormData = new FormData()
  edgeFormData.append('token', token)
  edgeFormData.append('file', file)

  let edgeRes: Response
  try {
    edgeRes = await fetch(`${supabaseUrl}/functions/v1/upload-client-photo`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: edgeFormData,
    })
  } catch (err) {
    console.error('[client-photo-upload] edge_unreachable', err)
    return NextResponse.json({ error: 'edge_unreachable' }, { status: 502 })
  }

  const data = (await edgeRes.json().catch(() => ({}))) as {
    ok?: boolean
    photoId?: string
    storagePath?: string
    error?: string
    message?: string
  }
  if (!edgeRes.ok || !data.ok) {
    return NextResponse.json(
      { error: data.error ?? 'edge_error', message: data.message ?? null },
      { status: edgeRes.status || 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    photoId: data.photoId ?? null,
    storagePath: data.storagePath ?? null,
  })
}
