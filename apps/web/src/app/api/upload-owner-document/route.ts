import { StorageQuotaExceeded, assertStorageAvailable } from '@/lib/storage/quota'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Endpoint upload public token-validated.
 * Le client (propriétaire du bien) accède à /upload/[token] et upload ses documents.
 * On vérifie : token valide + non expiré → upload via service_role.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

// 10 Mo (aligné CLAUDE.md §8 — anciennement 20 Mo, réduit suite audit sécurité 2026-05-27).
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

/**
 * Vérifie les "magic numbers" (signature binaire) en début de fichier
 * pour détecter un fichier malveillant masqué derrière un MIME spoofé.
 * Couvre PDF + JPEG/PNG/WebP/HEIC + Word/Excel OOXML (ZIP) + MS Office legacy.
 */
function isValidDocMagicNumber(buffer: ArrayBuffer, mime: string): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 12))
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // PDF : 25504446 ("%PDF")
  if (mime === 'application/pdf') return hex.startsWith('25504446')
  // JPEG : ffd8ff
  if (mime === 'image/jpeg') return hex.startsWith('ffd8ff')
  // PNG : 89504e470d0a1a0a
  if (mime === 'image/png') return hex.startsWith('89504e470d0a1a0a')
  // WebP : RIFF....WEBP
  if (mime === 'image/webp') return hex.startsWith('52494646') && hex.includes('57454250')
  // HEIC/HEIF : ftyp box brand
  if (mime === 'image/heic' || mime === 'image/heif')
    return ['66747970', '68656963', '68656966', '6d696631'].some((m) => hex.includes(m))
  // OOXML (docx/xlsx) : ZIP magic 504b0304 ou 504b0506 (empty) ou 504b0708 (spanned)
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
    return hex.startsWith('504b0304') || hex.startsWith('504b0506') || hex.startsWith('504b0708')
  // MS Office legacy (doc/xls) : OLE compound document d0cf11e0a1b11ae1
  if (mime === 'application/msword' || mime === 'application/vnd.ms-excel')
    return hex.startsWith('d0cf11e0a1b11ae1')

  return false
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const token = formData.get('token') as string | null
  const docKind = (formData.get('docKind') as string | null) ?? 'autre'
  const file = formData.get('file') as File | null

  if (!token || !file) {
    return NextResponse.json({ error: 'missing token or file' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 413 })
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json({ error: 'Type de fichier non autorisé' }, { status: 415 })
  }

  // Magic number check : empêche un binaire malveillant masqué derrière un MIME spoofé.
  let fileBuffer: ArrayBuffer
  try {
    fileBuffer = await file.arrayBuffer()
  } catch {
    return NextResponse.json({ error: 'Lecture du fichier impossible' }, { status: 400 })
  }
  if (!isValidDocMagicNumber(fileBuffer, file.type)) {
    return NextResponse.json(
      { error: 'Type de fichier non valide (signature binaire incohérente)' },
      { status: 400 },
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Configuration serveur invalide' }, { status: 500 })
  }
  const admin = createAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Validate token (on dossiers)
  const { data: dossier } = await admin
    .from('dossiers')
    .select('id, organization_id, client_upload_expires_at')
    .eq('client_upload_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  if (!dossier) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 404 })
  }
  if (dossier.client_upload_expires_at && new Date(dossier.client_upload_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Lien expiré' }, { status: 410 })
  }

  // Quota stockage organisation — bloque AVANT l'upload pour éviter d'écrire
  // un fichier qui dépassera la jauge (cf. lib/storage/quota.ts).
  try {
    await assertStorageAvailable(admin, dossier.organization_id, file.size)
  } catch (e) {
    if (e instanceof StorageQuotaExceeded) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 413 })
    }
    throw e
  }

  // Storage path : <org_id>/<dossier_id>/<timestamp>-<random>.<ext>
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().slice(0, 5)
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const storagePath = `${dossier.organization_id}/${dossier.id}/${filename}`

  // fileBuffer déjà lu pour magic number check — réutilise le même buffer
  const buffer = Buffer.from(fileBuffer)
  const { error: uploadError } = await admin.storage
    .from('owner-uploads')
    .upload(storagePath, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: `Upload Storage: ${uploadError.message}` }, { status: 500 })
  }

  // Record metadata
  const { error: insertError } = await admin.from('owner_documents').insert({
    dossier_id: dossier.id,
    organization_id: dossier.organization_id,
    storage_path: storagePath,
    original_name: file.name.slice(0, 200),
    size_bytes: file.size,
    mime_type: file.type,
    doc_kind: docKind,
    uploaded_at: new Date().toISOString(),
    reviewed_by_diag: false,
  })

  if (insertError) {
    // Cleanup storage si insert échoue
    await admin.storage.from('owner-uploads').remove([storagePath])
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, storagePath })
}
