// @ts-nocheck — Deno runtime (Supabase Edge Functions). Non compilé par tsc Node workspace.
/* eslint-disable */
/**
 * KOVAS — Edge Function upload-client-photo (Garde-fou local)
 * --------------------------------------------------------------
 * Reçoit la photo uploadée par le client via la page publique
 * `/upload-photo/[token]`. Valide le token, persiste la photo dans
 * Supabase Storage (bucket `missions/photos/{mission_id}/`) et crée
 * une ligne `photos` rattachée à la mission. Marque la demande comme
 * `completed`.
 *
 * POST /functions/v1/upload-client-photo
 *
 * Body : multipart/form-data
 *   - token : string (UUID v4)
 *   - file  : File (image/*)
 *
 * Auth : aucune (route publique protégée par token).
 *
 * Réponse :
 *   200 { ok: true, photoId, storagePath }
 *   400 { error: 'invalid_token' | 'invalid_file' | 'expired' | 'already_used' }
 *   500 { error: 'internal_error', message }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 Mo (client va voir ses jpegs HEIC dégradés)
const ACCEPTED_MIME = /^image\/(jpeg|png|webp|heic|heif)$/i

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return jsonResponse({ error: 'invalid_multipart' }, 400)
  }

  const token = formData.get('token')
  const file = formData.get('file')

  if (typeof token !== 'string' || token.length < 16) {
    return jsonResponse({ error: 'invalid_token' }, 400)
  }
  if (!(file instanceof File)) {
    return jsonResponse({ error: 'invalid_file' }, 400)
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
    return jsonResponse({ error: 'invalid_file', message: 'size_out_of_range' }, 400)
  }
  if (!ACCEPTED_MIME.test(file.type)) {
    return jsonResponse({ error: 'invalid_file', message: 'unsupported_mime' }, 400)
  }

  // 1) Récupérer la demande (statut pending + non expirée)
  const { data: request, error: lookupError } = await supabase
    .from('client_photo_requests')
    .select('id, mission_id, organization_id, status, expires_at, photo_description')
    .eq('token', token)
    .single()

  if (lookupError || !request) {
    return jsonResponse({ error: 'invalid_token' }, 400)
  }
  if (request.status !== 'pending') {
    return jsonResponse({ error: 'already_used', status: request.status }, 400)
  }
  if (new Date(request.expires_at).getTime() < Date.now()) {
    await supabase
      .from('client_photo_requests')
      .update({ status: 'expired' })
      .eq('id', request.id)
    return jsonResponse({ error: 'expired' }, 400)
  }

  // 2) Upload sur Supabase Storage
  const fileExt = file.type.split('/')[1]?.toLowerCase() || 'bin'
  const storagePath = `${request.mission_id}/client-upload-${request.id}.${fileExt}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('missions-photos')
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error('[upload-client-photo] storage_failed', uploadError)
    return jsonResponse({ error: 'internal_error', message: uploadError.message }, 500)
  }

  // 3) INSERT dans `photos`
  const { data: photo, error: photoInsertError } = await supabase
    .from('photos')
    .insert({
      organization_id: request.organization_id,
      mission_id: request.mission_id,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      caption: `Upload client : ${request.photo_description.slice(0, 100)}`,
      taken_at: new Date().toISOString(),
      sync_status: 'synced',
    })
    .select('id, created_at')
    .single()

  if (photoInsertError) {
    console.error('[upload-client-photo] photos_insert_failed', photoInsertError)
    return jsonResponse({ error: 'internal_error', message: photoInsertError.message }, 500)
  }

  // 4) Marquer la demande comme completed
  await supabase
    .from('client_photo_requests')
    .update({
      status: 'completed',
      photo_storage_path: storagePath,
      uploaded_at: new Date().toISOString(),
    })
    .eq('id', request.id)

  return jsonResponse({
    ok: true,
    photoId: photo?.id ?? null,
    storagePath,
  })
})
