// @ts-nocheck — Deno runtime (Supabase Edge Functions). Non compilé par tsc Node workspace.
/* eslint-disable */
/**
 * KOVAS — Edge Function request-client-photo (Garde-fou local)
 * --------------------------------------------------------------
 * Génère un token UUID, insère une demande dans `client_photo_requests`
 * et envoie un SMS au client avec un lien sécurisé vers la page
 * publique `/upload-photo/{token}` (valide 48 h).
 *
 * POST /functions/v1/request-client-photo
 *
 * Body JSON :
 *   {
 *     "missionId":         "uuid",
 *     "organizationId":    "uuid",
 *     "clientPhone":       "+33612345678",   // E.164 strict
 *     "photoDescription":  "Photo plaque chaudière…",
 *     "requestedBy":       "uuid"            // profile id de l'auteur
 *   }
 *
 * Auth : service_role (appelé depuis route Next.js authentifiée).
 *
 * Réponse :
 *   200 { ok: true, token, expiresAt, uploadUrl }
 *   400 { error: 'invalid_payload' }
 *   500 { error: 'internal_error', message }
 *   502 { error: 'sms_send_failed', message }
 *
 * Env :
 *   BREVO_API_KEY        : clé Brevo (si absente → mode stub log seulement)
 *   BREVO_SMS_SENDER     : nom expéditeur SMS (default 'KOVAS')
 *   KOVAS_PUBLIC_BASE_URL: base URL (default 'https://kovas.fr')
 *
 * Coût : ~0,07€/SMS FR (Brevo).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? ''
const BREVO_SMS_SENDER = Deno.env.get('BREVO_SMS_SENDER') ?? 'KOVAS'
const PUBLIC_BASE_URL = Deno.env.get('KOVAS_PUBLIC_BASE_URL') ?? 'https://kovas.fr'

const E164_REGEX = /^\+[1-9]\d{1,14}$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

interface SmsSendResult {
  success: boolean
  messageId?: string
  error?: string
  stubbed?: boolean
}

async function sendSmsViaBrevo(recipient: string, content: string): Promise<SmsSendResult> {
  if (!BREVO_API_KEY) {
    console.log('[request-client-photo:stub] BREVO_API_KEY absente — SMS non envoyé', {
      to: recipient,
      preview: content.slice(0, 60),
    })
    return { success: true, stubbed: true }
  }
  try {
    const response = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: BREVO_SMS_SENDER,
        recipient,
        content,
        type: 'transactional',
        tag: 'client_photo_request',
      }),
    })
    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP ${response.status}`)
      return { success: false, error: errText.slice(0, 500) }
    }
    const data = (await response.json().catch(() => ({}))) as { reference?: string }
    return { success: true, messageId: data.reference }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'network_error',
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  const { missionId, organizationId, clientPhone, photoDescription, requestedBy } = body ?? {}

  if (
    typeof missionId !== 'string' ||
    typeof organizationId !== 'string' ||
    typeof clientPhone !== 'string' ||
    typeof photoDescription !== 'string' ||
    typeof requestedBy !== 'string' ||
    !UUID_REGEX.test(missionId) ||
    !UUID_REGEX.test(organizationId) ||
    !UUID_REGEX.test(requestedBy) ||
    !E164_REGEX.test(clientPhone) ||
    photoDescription.trim().length < 10
  ) {
    return jsonResponse({ error: 'invalid_payload' }, 400)
  }

  // Génère token cryptographiquement aléatoire
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { data: inserted, error: insertError } = await supabase
    .from('client_photo_requests')
    .insert({
      mission_id: missionId,
      organization_id: organizationId,
      token,
      photo_description: photoDescription.trim(),
      requested_by: requestedBy,
      client_phone: clientPhone,
      expires_at: expiresAt,
      status: 'pending',
    })
    .select('id, token, expires_at')
    .single()

  if (insertError || !inserted) {
    console.error('[request-client-photo] insert_failed', insertError)
    return jsonResponse({ error: 'internal_error', message: insertError?.message }, 500)
  }

  const uploadUrl = `${PUBLIC_BASE_URL.replace(/\/$/, '')}/upload-photo/${token}`
  const smsBody =
    `KOVAS — Votre diagnostiqueur vous demande une photo : ` +
    `${photoDescription.trim().slice(0, 80)}. ` +
    `Lien sécurisé (48h) : ${uploadUrl}`

  const smsResult = await sendSmsViaBrevo(clientPhone, smsBody)

  if (!smsResult.success) {
    // Marquer la demande comme cancelled si le SMS échoue
    await supabase
      .from('client_photo_requests')
      .update({ status: 'cancelled' })
      .eq('id', inserted.id)
    return jsonResponse({ error: 'sms_send_failed', message: smsResult.error ?? 'unknown' }, 502)
  }

  return jsonResponse({
    ok: true,
    token: inserted.token,
    expiresAt: inserted.expires_at,
    uploadUrl,
    stubbed: smsResult.stubbed ?? false,
  })
})
