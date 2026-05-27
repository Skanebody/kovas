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

// Whitelist MIME types (defense-in-depth, l'Edge Function revalide aussi).
const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

/**
 * Vérifie les "magic numbers" (signature binaire) en début de fichier
 * pour détecter un fichier malveillant masqué derrière une extension/MIME image.
 * Retourne true si la signature correspond bien à un format image attendu.
 */
function isValidImageMagicNumber(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 12))
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  // JPEG : starts with ffd8ff
  if (hex.startsWith('ffd8ff')) return true
  // PNG : 89504e470d0a1a0a
  if (hex.startsWith('89504e470d0a1a0a')) return true
  // WebP : 52494646 ... 57454250 (RIFF...WEBP)
  if (hex.startsWith('52494646') && hex.includes('57454250')) return true
  // HEIC/HEIF : ftyp box à offset 4-8 + brand heic/heif/mif1
  if (['66747970', '68656963', '68656966', '6d696631'].some((m) => hex.includes(m))) return true
  return false
}

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

  // Whitelist MIME déclaré (defense-in-depth, Edge Function revalide aussi)
  if (!ALLOWED_IMAGE_MIMES.has(file.type)) {
    return NextResponse.json({ error: 'invalid_file', message: 'mime' }, { status: 400 })
  }

  // Magic number check : lire les 12 premiers bytes pour valider la signature.
  // Empêche l'upload d'un binaire (ex. .exe renommé .jpg avec content-type spoofé).
  let fileBuffer: ArrayBuffer
  try {
    fileBuffer = await file.arrayBuffer()
  } catch {
    return NextResponse.json({ error: 'invalid_file', message: 'read_failed' }, { status: 400 })
  }
  if (!isValidImageMagicNumber(fileBuffer)) {
    return NextResponse.json(
      { error: 'invalid_file', message: 'Type de fichier non valide' },
      { status: 400 },
    )
  }

  // Reconstitue un File à partir du buffer lu (FormData consomme le stream une fois)
  const validatedFile = new File([fileBuffer], file.name, { type: file.type })

  const edgeFormData = new FormData()
  edgeFormData.append('token', token)
  edgeFormData.append('file', validatedFile)

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
