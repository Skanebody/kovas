// @ts-nocheck — Deno runtime (Supabase Edge Functions). Non compilé par tsc Node workspace.
/* eslint-disable */
/**
 * KOVAS — Edge Function verify-otp (Mission E3)
 * ---------------------------------------------
 * Vérifie un code OTP 6 chiffres reçu par SMS.
 *
 * POST /functions/v1/verify-otp
 *
 * Body JSON :
 *   {
 *     "phone": "+33612345678",   // E.164
 *     "code": "123456",          // 6 chiffres
 *     "otpId": "uuid" | null,    // optionnel : cible précise
 *     "leadId": "uuid" | null    // optionnel : update quote_requests
 *   }
 *
 * Réponses :
 *   200 { ok: true, verifiedAt, leadId? }
 *   400 { error: 'invalid_phone' | 'invalid_code' | 'invalid_input' }
 *   401 { error: 'invalid_code'  | 'max_attempts_reached', attemptsRemaining }
 *   404 { error: 'otp_not_found_or_expired' }
 *
 * Algorithme :
 *   1. Validation E.164 + format code (6 chiffres).
 *   2. SELECT le plus récent OTP non vérifié et non expiré pour ce phone
 *      (optionnellement filtré par otpId).
 *   3. Comparaison SHA256 hex.
 *   4. Match → UPDATE verified_at + (optionnel) UPDATE quote_requests.
 *   5. No match → UPDATE attempts++. Si attempts >= max_attempts → lock.
 *
 * Auth : public.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const E164_REGEX = /^\+[1-9]\d{1,14}$/
const CODE_REGEX = /^\d{6}$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Comparaison constant-time pour éviter timing-attack sur les hash. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

// ============================================
// Handler
// ============================================

interface OtpRow {
  id: string
  lead_id: string | null
  phone_e164: string
  code_hash: string
  purpose: string
  expires_at: string
  attempts: number
  max_attempts: number
  verified_at: string | null
}

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
    code?: unknown
    otpId?: unknown
    leadId?: unknown
  }

  // 1. Validation phone
  const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
  if (!E164_REGEX.test(phone)) {
    return jsonResponse({ error: 'invalid_phone', message: 'Numéro de téléphone invalide.' }, 400)
  }

  // 2. Validation code
  const code = typeof input.code === 'string' ? input.code.trim() : ''
  if (!CODE_REGEX.test(code)) {
    return jsonResponse({ error: 'invalid_code', message: 'Code à 6 chiffres requis.' }, 400)
  }

  // 3. Validation otpId / leadId optionnels
  let otpId: string | null = null
  if (input.otpId !== undefined && input.otpId !== null && input.otpId !== '') {
    if (typeof input.otpId !== 'string' || !UUID_REGEX.test(input.otpId)) {
      return jsonResponse({ error: 'invalid_input', message: 'otpId invalide.' }, 400)
    }
    otpId = input.otpId
  }

  let leadId: string | null = null
  if (input.leadId !== undefined && input.leadId !== null && input.leadId !== '') {
    if (typeof input.leadId !== 'string' || !UUID_REGEX.test(input.leadId)) {
      return jsonResponse({ error: 'invalid_input', message: 'leadId invalide.' }, 400)
    }
    leadId = input.leadId
  }

  // 4. Récupère l'OTP cible
  let query = supabase
    .from('otp_codes')
    .select(
      'id, lead_id, phone_e164, code_hash, purpose, expires_at, attempts, max_attempts, verified_at',
    )
    .eq('phone_e164', phone)
    .is('verified_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)

  if (otpId) {
    query = query.eq('id', otpId)
  }

  const { data: rows, error: fetchErr } = await query

  if (fetchErr) {
    console.error('[verify-otp] fetch failed', fetchErr)
    return jsonResponse(
      { error: 'internal_error', message: 'Erreur lors de la vérification.' },
      500,
    )
  }

  const otp = rows && rows.length > 0 ? (rows[0] as OtpRow) : null

  if (!otp) {
    return jsonResponse(
      {
        error: 'otp_not_found_or_expired',
        message: 'Aucun code valide. Demandez un nouveau code.',
      },
      404,
    )
  }

  // 5. Lock atteint
  if (otp.attempts >= otp.max_attempts) {
    return jsonResponse(
      {
        error: 'max_attempts_reached',
        message: 'Nombre maximum de tentatives atteint. Demandez un nouveau code.',
        attemptsRemaining: 0,
      },
      401,
    )
  }

  // 6. Vérification du code
  const submittedHash = await sha256Hex(code)
  const match = constantTimeEqual(submittedHash, otp.code_hash)

  if (!match) {
    const newAttempts = otp.attempts + 1
    const reachedLock = newAttempts >= otp.max_attempts

    const updates: Record<string, unknown> = { attempts: newAttempts }
    // Si lock atteint → on positionne verified_at = epoch UTC pour exclure cet OTP
    // des futures requêtes (pattern brief : "mark verified_at = epoch (lock)").
    if (reachedLock) {
      updates.verified_at = new Date(0).toISOString()
    }

    await supabase.from('otp_codes').update(updates).eq('id', otp.id)

    // Si on a un leadId : on incrémente otp_attempts sur le lead aussi
    if (leadId) {
      const { data: lead } = await supabase
        .from('quote_requests')
        .select('otp_attempts')
        .eq('id', leadId)
        .maybeSingle()

      if (lead) {
        const leadAttempts = ((lead as { otp_attempts: number | null }).otp_attempts ?? 0) + 1
        await supabase
          .from('quote_requests')
          .update({ otp_attempts: leadAttempts })
          .eq('id', leadId)
      }
    }

    if (reachedLock) {
      return jsonResponse(
        {
          error: 'max_attempts_reached',
          message: 'Nombre maximum de tentatives atteint. Demandez un nouveau code.',
          attemptsRemaining: 0,
        },
        401,
      )
    }

    return jsonResponse(
      {
        error: 'invalid_code',
        message: 'Code incorrect.',
        attemptsRemaining: Math.max(0, otp.max_attempts - newAttempts),
      },
      401,
    )
  }

  // 7. Match — mark verified
  const verifiedAt = new Date()
  const { error: verifyErr } = await supabase
    .from('otp_codes')
    .update({
      verified_at: verifiedAt.toISOString(),
      attempts: otp.attempts + 1,
    })
    .eq('id', otp.id)

  if (verifyErr) {
    console.error('[verify-otp] update verified_at failed', verifyErr)
    return jsonResponse({ error: 'internal_error', message: 'Erreur lors de la validation.' }, 500)
  }

  // 8. Si leadId → propage sur quote_requests
  const targetLeadId = leadId ?? otp.lead_id
  if (targetLeadId) {
    const { error: leadUpdateErr } = await supabase
      .from('quote_requests')
      .update({
        otp_verified_at: verifiedAt.toISOString(),
        otp_attempts: otp.attempts + 1,
      })
      .eq('id', targetLeadId)

    if (leadUpdateErr) {
      console.error('[verify-otp] update quote_requests failed', leadUpdateErr)
      // Non-fatal : OTP validé, lead juste pas mis à jour.
    }
  }

  return jsonResponse(
    {
      ok: true,
      verifiedAt: verifiedAt.toISOString(),
      leadId: targetLeadId,
    },
    200,
  )
})
