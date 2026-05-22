// @ts-nocheck — Deno runtime (Supabase Edge Functions). Non compilé par tsc Node workspace.
/* eslint-disable */
/**
 * KOVAS — Edge Function request-client-video (Garde-fou local)
 * --------------------------------------------------------------
 * Envoie un SMS au client avec un lien visio + motif d'appel pour
 * récupérer une information manquante sans repasser sur place.
 *
 * Pas de persistance en base — c'est une simple notification SMS
 * (à terme on pourrait ajouter une table `video_call_requests` si on
 * veut tracker les confirmations).
 *
 * POST /functions/v1/request-client-video
 *
 * Body JSON :
 *   {
 *     "missionId":      "uuid",
 *     "organizationId": "uuid",
 *     "clientPhone":    "+33612345678",
 *     "meetingUrl":     "https://meet.google.com/abc-defg-hij",
 *     "reason":         "Vérifier marque chaudière..."
 *   }
 *
 * Réponse :
 *   200 { ok: true, smsId? }
 *   400 { error: 'invalid_payload' }
 *   502 { error: 'sms_send_failed' }
 */

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? ''
const BREVO_SMS_SENDER = Deno.env.get('BREVO_SMS_SENDER') ?? 'KOVAS'

const E164_REGEX = /^\+[1-9]\d{1,14}$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const URL_REGEX = /^https?:\/\/[^\s]+\.[^\s]+/

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function sendSmsViaBrevo(
  recipient: string,
  content: string,
): Promise<{ success: boolean; error?: string; messageId?: string; stubbed?: boolean }> {
  if (!BREVO_API_KEY) {
    console.log('[request-client-video:stub] BREVO_API_KEY absente — SMS non envoyé', {
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
        tag: 'client_video_request',
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
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  let body: any
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  const { missionId, organizationId, clientPhone, meetingUrl, reason } = body ?? {}

  if (
    typeof missionId !== 'string' ||
    typeof organizationId !== 'string' ||
    typeof clientPhone !== 'string' ||
    typeof meetingUrl !== 'string' ||
    typeof reason !== 'string' ||
    !UUID_REGEX.test(missionId) ||
    !UUID_REGEX.test(organizationId) ||
    !E164_REGEX.test(clientPhone) ||
    !URL_REGEX.test(meetingUrl) ||
    reason.trim().length < 10
  ) {
    return jsonResponse({ error: 'invalid_payload' }, 400)
  }

  const smsBody =
    `KOVAS — Votre diagnostiqueur propose une visio rapide. ` +
    `Motif : ${reason.trim().slice(0, 100)}. ` +
    `Lien : ${meetingUrl}`

  const result = await sendSmsViaBrevo(clientPhone, smsBody)
  if (!result.success) {
    return jsonResponse({ error: 'sms_send_failed', message: result.error }, 502)
  }
  return jsonResponse({
    ok: true,
    smsId: result.messageId,
    stubbed: result.stubbed ?? false,
  })
})
