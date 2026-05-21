// @ts-nocheck — Deno runtime (Supabase Edge Functions). Non compilé par tsc Node workspace.
/* eslint-disable */
/**
 * KOVAS — Edge Function send-otp-sms (Mission E3)
 * ------------------------------------------------
 * Génère un code OTP 6 chiffres, le hash en SHA256, l'insère dans otp_codes
 * et envoie un SMS via Brevo Transactional SMS API.
 *
 * POST /functions/v1/send-otp-sms
 *
 * Body JSON :
 *   {
 *     "phone": "+33612345678",                  // E.164 strict
 *     "purpose": "lead_verification" | "diag_claim" | "login_passwordless",
 *     "leadId": "uuid" | null                   // optionnel : lien quote_request
 *   }
 *
 * Auth : public — appelé depuis route Next.js qui passe service_role JWT.
 *
 * Rate-limits :
 *   - Function PG check_otp_rate_limit(phone) : max 3 OTP / 10 min.
 *
 * Réponse :
 *   200 { ok: true, otpId, expiresAt, devCode?: string }  (devCode uniquement OTP_DEV_MODE)
 *   400 { error: 'invalid_phone' | 'invalid_purpose' | 'invalid_lead_id' }
 *   429 { error: 'rate_limited', message }
 *   500 { error: 'internal_error', message }
 *   502 { error: 'sms_send_failed', message }
 *
 * Variables d'environnement :
 *   BREVO_API_KEY          : clé Brevo (si absente → mode stub, log seulement)
 *   BREVO_SMS_SENDER       : nom émetteur SMS (default 'KOVAS', max 11 alphanum)
 *   OTP_DEV_MODE           : 'true' → ne pas envoyer le SMS, retourner devCode
 *   SUPABASE_URL           : auto-injected par Edge runtime
 *   SUPABASE_SERVICE_ROLE_KEY : auto-injected
 *
 * Coût : ~0,07€/SMS FR (Brevo).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? ''
const BREVO_SMS_SENDER = Deno.env.get('BREVO_SMS_SENDER') ?? 'KOVAS'
const OTP_DEV_MODE = (Deno.env.get('OTP_DEV_MODE') ?? '').toLowerCase() === 'true'

const E164_REGEX = /^\+[1-9]\d{1,14}$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Purpose = 'lead_verification' | 'diag_claim' | 'login_passwordless'
const ALLOWED_PURPOSES: ReadonlyArray<Purpose> = [
  'lead_verification',
  'diag_claim',
  'login_passwordless',
]

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ============================================
// Helpers
// ============================================

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Génère un code 6 chiffres cryptographiquement aléatoire.
 * Plage [000000, 999999] avec padStart pour préserver les zéros initiaux.
 */
function generateOtpCode(): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  const n = buf[0]! % 1_000_000
  return n.toString().padStart(6, '0')
}

/**
 * Hash SHA256 hex d'une chaîne (compatible Web Crypto API).
 */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return null
}

// ============================================
// Brevo SMS
// ============================================

interface SmsSendResult {
  success: boolean
  messageId?: string
  error?: string
  stubbed?: boolean
}

async function sendSmsViaBrevo(recipient: string, content: string): Promise<SmsSendResult> {
  if (!BREVO_API_KEY) {
    console.log('[send-otp-sms:stub] BREVO_API_KEY absente — SMS non envoyé', {
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
        tag: 'otp_verification',
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

// ============================================
// Handler
// ============================================

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  const input = (body ?? {}) as {
    phone?: unknown
    purpose?: unknown
    leadId?: unknown
  }

  // 1. Validation phone (E.164 strict)
  const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
  if (!E164_REGEX.test(phone)) {
    return jsonResponse(
      {
        error: 'invalid_phone',
        message: 'Numéro de téléphone invalide. Format E.164 requis (+33...).',
      },
      400,
    )
  }

  // 2. Validation purpose
  const rawPurpose = typeof input.purpose === 'string' ? input.purpose : 'lead_verification'
  const purpose: Purpose | null = (ALLOWED_PURPOSES as readonly string[]).includes(rawPurpose)
    ? (rawPurpose as Purpose)
    : null
  if (!purpose) {
    return jsonResponse(
      { error: 'invalid_purpose', message: `purpose doit être l'un de : ${ALLOWED_PURPOSES.join(', ')}` },
      400,
    )
  }

  // 3. Validation leadId (optionnel)
  let leadId: string | null = null
  if (input.leadId !== undefined && input.leadId !== null && input.leadId !== '') {
    if (typeof input.leadId !== 'string' || !UUID_REGEX.test(input.leadId)) {
      return jsonResponse(
        { error: 'invalid_lead_id', message: 'leadId doit être un UUID valide.' },
        400,
      )
    }
    leadId = input.leadId
  }

  // 4. Rate limit DB-side (3 OTP / 10 min / phone)
  const { data: rateOk, error: rateErr } = await supabase.rpc('check_otp_rate_limit', {
    p_phone: phone,
  })

  if (rateErr) {
    console.error('[send-otp-sms] rate-limit RPC failed', rateErr)
    // Fail-open prudent : on continue (le rate limit n'est qu'une ligne de défense).
  } else if (rateOk === false) {
    return jsonResponse(
      {
        error: 'rate_limited',
        message: 'Trop de codes demandés. Patientez 10 minutes avant de réessayer.',
      },
      429,
    )
  }

  // 5. Génération + hash
  const code = generateOtpCode()
  const codeHash = await sha256Hex(code)
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  const ip = getClientIp(req)
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null

  // 6. Insert OTP row
  const { data: inserted, error: insertErr } = await supabase
    .from('otp_codes')
    .insert({
      lead_id: leadId,
      phone_e164: phone,
      code_hash: codeHash,
      purpose,
      expires_at: expiresAt.toISOString(),
      ip_address: ip,
      user_agent: userAgent,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('[send-otp-sms] insert otp_codes failed', insertErr)
    return jsonResponse(
      { error: 'internal_error', message: 'Impossible de générer le code.' },
      500,
    )
  }

  const otpId = (inserted as { id: string }).id

  // 7. Envoi SMS (sauf OTP_DEV_MODE)
  const content = `Code KOVAS : ${code}. Valide 5 min.`

  if (!OTP_DEV_MODE) {
    const smsResult = await sendSmsViaBrevo(phone, content)
    if (!smsResult.success) {
      console.error('[send-otp-sms] brevo failed', smsResult.error)
      return jsonResponse(
        {
          error: 'sms_send_failed',
          message: 'L\'envoi du SMS a échoué. Réessayez dans quelques instants.',
        },
        502,
      )
    }
  } else {
    console.log('[send-otp-sms:dev] OTP_DEV_MODE actif — code non envoyé', {
      otpId,
      phone,
      code,
    })
  }

  // 8. Réponse (devCode uniquement OTP_DEV_MODE)
  const responseBody: {
    ok: true
    otpId: string
    expiresAt: string
    devCode?: string
  } = {
    ok: true,
    otpId,
    expiresAt: expiresAt.toISOString(),
  }
  if (OTP_DEV_MODE) {
    responseBody.devCode = code
  }

  return jsonResponse(responseBody, 200)
})
