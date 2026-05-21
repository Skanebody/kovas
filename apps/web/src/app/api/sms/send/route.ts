/**
 * KOVAS — Route API POST /api/sms/send
 *
 * Envoi de SMS transactionnels depuis l'app (page client → bouton SMS).
 * Provider : Brevo Transactional SMS API.
 *
 * Body :
 *   { phone: string, message: string, clientId?: string }
 *
 * Sécurité :
 *   - Auth requise (getCurrentUser → redirect si non connecté)
 *   - Si clientId fourni, on vérifie qu'il appartient à l'organisation
 *
 * Réponses :
 *   200 { ok: true,  messageId?: string }
 *   200 { ok: false, error: string }     (erreurs métier — phone invalide, Brevo down, etc.)
 *   401 { ok: false, error: 'unauthorized' }
 *
 * Journalisation : table `email_queue` (template='sms_manual') — flexible et
 * déjà en place, évite une migration dédiée. data jsonb stocke phone+message+sender.
 *
 * Tarif Brevo : ~0,07€/SMS FR transactionnel.
 */

import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js'
import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 15

const MAX_SMS_LENGTH = 160
const MIN_SMS_LENGTH = 3

interface SendSmsBody {
  phone?: unknown
  message?: unknown
  clientId?: unknown
}

interface BrevoSmsResponse {
  reference?: string
}

function badRequest(error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status: 200 })
}

function toE164(raw: string): string | null {
  try {
    if (!isValidPhoneNumber(raw, 'FR')) return null
    const parsed = parsePhoneNumber(raw, 'FR')
    return parsed?.number ?? null
  } catch {
    return null
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const { orgId } = await getCurrentUser()

  // 2. Parse body
  let body: SendSmsBody
  try {
    body = (await request.json()) as SendSmsBody
  } catch {
    return badRequest('invalid_json')
  }

  const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const clientId =
    typeof body.clientId === 'string' && body.clientId.length > 0 ? body.clientId : null

  // 3. Validation
  const phoneE164 = toE164(rawPhone)
  if (!phoneE164) {
    return badRequest('Numéro de téléphone invalide.')
  }
  if (message.length < MIN_SMS_LENGTH) {
    return badRequest('Le message doit contenir au moins 3 caractères.')
  }
  if (message.length > MAX_SMS_LENGTH) {
    return badRequest(`Le message dépasse ${MAX_SMS_LENGTH} caractères.`)
  }

  // 4. Vérifie ownership du client (si fourni)
  if (clientId) {
    const { data: clientRow, error: clientErr } = await supabase
      .from('clients')
      .select('id, organization_id')
      .eq('id', clientId)
      .maybeSingle()

    if (clientErr || !clientRow || clientRow.organization_id !== orgId) {
      return badRequest('Client introuvable.')
    }
  }

  // 5. Envoi Brevo
  const brevoApiKey = process.env.BREVO_API_KEY
  const brevoSender = process.env.BREVO_SMS_SENDER ?? 'KOVAS'

  if (!brevoApiKey) {
    return badRequest('Service SMS non configuré.')
  }

  let messageId: string | undefined
  let sendOk = false
  let sendError: string | null = null

  try {
    const response = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: brevoSender,
        recipient: phoneE164,
        content: message,
        type: 'transactional',
        tag: 'sms_manual',
      }),
    })

    if (!response.ok) {
      sendError = (await response.text().catch(() => `HTTP ${response.status}`)).slice(0, 400)
    } else {
      const data = (await response.json().catch(() => ({}))) as BrevoSmsResponse
      messageId = data.reference
      sendOk = true
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : 'network_error'
  }

  // 6. Log dans email_queue (template = 'sms_manual')
  // Cast : email_queue n'est pas (encore) inclus dans les types Database auto-générés.
  // Cf. supabase/migrations/20260607100000_pricing_dual_track_v3.sql.
  const queueInsert = supabase.from('email_queue') as unknown as {
    insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>
  }
  await queueInsert.insert({
    template: 'sms_manual',
    to_email: phoneE164, // champ détourné — le numéro fait office de destinataire
    subject: `SMS → ${phoneE164}`,
    status: sendOk ? 'sent' : 'failed',
    sent_at: sendOk ? new Date().toISOString() : null,
    error: sendError,
    data: {
      phone: phoneE164,
      message,
      sent_by: user.id,
      client_id: clientId,
      brevo_message_id: messageId ?? null,
      organization_id: orgId,
    },
  })

  if (!sendOk) {
    return badRequest(sendError ?? "L'envoi du SMS a échoué.")
  }

  return NextResponse.json({ ok: true, messageId })
}
