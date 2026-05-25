/**
 * KOVAS — Route API POST /api/email/send
 *
 * Envoi d'emails transactionnels manuels depuis l'app (page client → bouton Email).
 * Provider : Brevo Transactional Email API (POST /v3/smtp/email).
 *
 * Body :
 *   { to: string, subject: string, body: string, clientId?: string }
 *
 * Sécurité :
 *   - Auth requise
 *   - Si clientId fourni, ownership org vérifié
 *
 * Format :
 *   - Conversion markdown léger (paragraphes → <p>, sauts de ligne → <br/>)
 *   - Signature auto "L'équipe KOVAS"
 *   - Footer mentions NEXUS 1993 (depuis COMPANY_IDENTITY — source unique vérité)
 *
 * Journalisation : table `email_queue` (template='email_manual').
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 15

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_SUBJECT_LENGTH = 3
const MIN_BODY_LENGTH = 10

interface SendEmailBody {
  to?: unknown
  subject?: unknown
  body?: unknown
  clientId?: unknown
}

interface BrevoEmailResponse {
  messageId?: string
}

function badRequest(error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status: 200 })
}

/**
 * Conversion minimaliste markdown plain-text → HTML.
 * Paragraphes séparés par double saut de ligne, sauts simples → <br/>.
 * Échappe les chevrons pour éviter l'injection HTML basique.
 */
function plainTextToHtml(input: string): string {
  const escaped = input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const paragraphs = escaped
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  return paragraphs
    .map((p) => `<p style="margin:0 0 12px 0;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

function buildHtmlContent(subject: string, bodyText: string, fromName: string): string {
  // Note: subject utilisé pour le header Brevo séparément, pas dans le HTML.
  void subject
  const bodyHtml = plainTextToHtml(bodyText)
  const c = COMPANY_IDENTITY
  // Footer mentions légales sobres — synchro lib/legal/company-identity.ts
  return [
    '<!doctype html><html><body style="margin:0;padding:0;background:#F5F7F4;">',
    '<div style="font-family:Arial,sans-serif;color:#0F1419;max-width:600px;margin:0 auto;padding:24px;background:#FDFBF6;">',
    bodyHtml,
    '<p style="margin:24px 0 4px 0;">Cordialement,</p>',
    `<p style="margin:0;"><strong>${fromName}</strong></p>`,
    '<hr style="border:none;border-top:1px solid #E5DECB;margin:24px 0;" />',
    '<p style="font-size:11px;color:#7E8AA4;line-height:1.5;margin:0;">',
    `${c.legalName} — SASU au capital de ${c.capitalLabel}<br/>`,
    `${c.address.full}<br/>`,
    `SIREN ${c.sirenFormatted} — ${c.rcs.number} — TVA ${c.vatIntracom}`,
    '</p>',
    '</div></body></html>',
  ].join('')
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
  const { orgId, profile } = await getCurrentUser()

  // 2. Parse body
  let body: SendEmailBody
  try {
    body = (await request.json()) as SendEmailBody
  } catch {
    return badRequest('invalid_json')
  }

  const to = typeof body.to === 'string' ? body.to.trim() : ''
  const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
  const messageBody = typeof body.body === 'string' ? body.body.trim() : ''
  const clientId =
    typeof body.clientId === 'string' && body.clientId.length > 0 ? body.clientId : null

  // 3. Validation
  if (!EMAIL_REGEX.test(to)) {
    return badRequest('Adresse email invalide.')
  }
  if (subject.length < MIN_SUBJECT_LENGTH) {
    return badRequest('Le sujet doit contenir au moins 3 caractères.')
  }
  if (messageBody.length < MIN_BODY_LENGTH) {
    return badRequest('Le message doit contenir au moins 10 caractères.')
  }

  // 4. Ownership du client (si fourni)
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
  const brevoFromEmail = process.env.BREVO_FROM_EMAIL ?? 'contact@kovas.fr'
  const brevoFromName = process.env.BREVO_FROM_NAME ?? 'KOVAS'
  const brevoReplyTo = process.env.BREVO_REPLY_TO ?? 'contact@kovas.fr'

  if (!brevoApiKey) {
    return badRequest('Service email non configuré.')
  }

  const senderDisplay = "L'équipe KOVAS"
  const htmlContent = buildHtmlContent(subject, messageBody, senderDisplay)
  const recipientName = profile.full_name ?? to

  let messageId: string | undefined
  let sendOk = false
  let sendError: string | null = null

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: brevoFromName, email: brevoFromEmail },
        to: [{ email: to, name: recipientName }],
        replyTo: { email: brevoReplyTo, name: 'Support KOVAS' },
        subject,
        htmlContent,
        tags: ['manual_email'],
      }),
    })

    if (!response.ok) {
      sendError = (await response.text().catch(() => `HTTP ${response.status}`)).slice(0, 400)
    } else {
      const data = (await response.json().catch(() => ({}))) as BrevoEmailResponse
      messageId = data.messageId
      sendOk = true
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : 'network_error'
  }

  // 6. Log dans email_queue (template = 'email_manual')
  // Cast : email_queue n'est pas (encore) inclus dans les types Database auto-générés.
  // Cf. supabase/migrations/20260607100000_pricing_dual_track_v3.sql.
  const queueInsert = supabase.from('email_queue') as unknown as {
    insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>
  }
  await queueInsert.insert({
    template: 'email_manual',
    to_email: to,
    subject,
    status: sendOk ? 'sent' : 'failed',
    sent_at: sendOk ? new Date().toISOString() : null,
    error: sendError,
    data: {
      body: messageBody,
      sent_by: user.id,
      client_id: clientId,
      brevo_message_id: messageId ?? null,
      organization_id: orgId,
    },
  })

  if (!sendOk) {
    return badRequest(sendError ?? "L'envoi de l'email a échoué.")
  }

  return NextResponse.json({ ok: true, messageId })
}
