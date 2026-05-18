import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { Database } from '@kovas/database/types'

/**
 * Endpoint upload public token-validated.
 * Le client (propriétaire du bien) accède à /upload/[token] et upload ses documents.
 * On vérifie : token valide + non expiré → upload via service_role.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BYTES = 20 * 1024 * 1024
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

export async function POST(request: Request) {
  const formData = await request.formData()
  const token = formData.get('token') as string | null
  const docKind = (formData.get('docKind') as string | null) ?? 'autre'
  const file = formData.get('file') as File | null

  if (!token || !file) {
    return NextResponse.json({ error: 'missing token or file' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 20 Mo)' }, { status: 413 })
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json({ error: 'Type de fichier non autorisé' }, { status: 415 })
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

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
  if (
    dossier.client_upload_expires_at &&
    new Date(dossier.client_upload_expires_at) < new Date()
  ) {
    return NextResponse.json({ error: 'Lien expiré' }, { status: 410 })
  }

  // Storage path : <org_id>/<dossier_id>/<timestamp>-<random>.<ext>
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().slice(0, 5)
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const storagePath = `${dossier.organization_id}/${dossier.id}/${filename}`

  const buffer = Buffer.from(await file.arrayBuffer())
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
