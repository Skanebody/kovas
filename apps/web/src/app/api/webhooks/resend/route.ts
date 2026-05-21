/**
 * Webhook Resend → table `email_events`.
 *
 * Signature : Resend signe les payloads via Svix (header `svix-signature`,
 * `svix-id`, `svix-timestamp`). Cf. https://resend.com/docs/dashboard/webhooks/verify-webhooks
 *
 * Pour rester sans dépendance Svix V1 (et ne pas ajouter de SDK), on vérifie
 * la signature manuellement avec HMAC-SHA256(timestamp + body).
 *
 * Configuration :
 *   RESEND_WEBHOOK_SECRET=whsec_xxx   (à récupérer dans dashboard Resend)
 *
 * Events Resend mappés :
 *   - email.sent              → 'sent'
 *   - email.delivered         → 'delivered'
 *   - email.delivery_delayed  → 'delivery_delayed'
 *   - email.bounced (hard)    → 'bounced'
 *   - email.bounced (soft)    → 'soft_bounced'  (différencié via payload.bounce.type)
 *   - email.complained        → 'complained'
 *   - email.opened            → 'opened'
 *   - email.clicked           → 'clicked'
 *
 * NB : `unsubscribed` n'est pas un event Resend natif — il sera capté
 * séparément via la table `email_preferences` user-side.
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface ResendBouncePayload {
  type?: 'hard' | 'soft'
  message?: string
}

interface ResendEventData {
  email_id?: string
  to?: string | string[]
  from?: string
  subject?: string
  bounce?: ResendBouncePayload
  tags?: Array<{ name: string; value: string }>
}

interface ResendWebhookPayload {
  type: string
  created_at?: string
  data: ResendEventData
}

interface EmailEventInsertRow {
  message_id: string | null
  recipient: string
  email_type: string | null
  event_type: string
  payload: Record<string, unknown>
}

/**
 * Vérifie la signature Svix (Resend) selon le format `v1,<base64hmac>`.
 * Retourne true si valide, false sinon.
 */
function verifySvixSignature(
  rawBody: string,
  signatureHeader: string | null,
  msgId: string | null,
  timestamp: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !msgId || !timestamp) return false

  // Secret Resend a un préfixe `whsec_` → on retire pour utiliser la clé base64
  const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret
  let secretBytes: Buffer
  try {
    secretBytes = Buffer.from(cleanSecret, 'base64')
  } catch {
    return false
  }

  const signedContent = `${msgId}.${timestamp}.${rawBody}`
  const expected = createHmac('sha256', secretBytes).update(signedContent).digest('base64')

  // Header format : "v1,sig1 v1,sig2 ..." (Resend peut envoyer plusieurs signatures)
  const parts = signatureHeader.split(' ')
  for (const p of parts) {
    const [, sigValue] = p.split(',')
    if (!sigValue) continue
    const sigBuf = Buffer.from(sigValue, 'base64')
    const expectedBuf = Buffer.from(expected, 'base64')
    if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) {
      return true
    }
  }
  return false
}

function mapEventType(event: ResendWebhookPayload): string {
  switch (event.type) {
    case 'email.sent':
      return 'sent'
    case 'email.delivered':
      return 'delivered'
    case 'email.delivery_delayed':
      return 'delivery_delayed'
    case 'email.bounced':
      return event.data.bounce?.type === 'soft' ? 'soft_bounced' : 'bounced'
    case 'email.complained':
      return 'complained'
    case 'email.opened':
      return 'opened'
    case 'email.clicked':
      return 'clicked'
    default:
      return event.type.replace('email.', '')
  }
}

function extractCategory(event: ResendWebhookPayload): string | null {
  const tag = event.data.tags?.find((t) => t.name === 'category')
  return tag?.value ?? null
}

function extractRecipient(event: ResendWebhookPayload): string {
  const to = event.data.to
  if (Array.isArray(to)) return to[0] ?? 'unknown'
  return to ?? 'unknown'
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    // Pas de secret configuré : on accepte uniquement en dev (no-op)
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'webhook secret not configured' }, { status: 503 })
    }
  }

  const rawBody = await request.text()
  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (secret) {
    const ok = verifySvixSignature(rawBody, svixSignature, svixId, svixTimestamp, secret)
    if (!ok) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
    }
  }

  let event: ResendWebhookPayload
  try {
    event = JSON.parse(rawBody) as ResendWebhookPayload
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  if (!event.type || !event.data) {
    return NextResponse.json({ error: 'missing type or data' }, { status: 400 })
  }

  const row: EmailEventInsertRow = {
    message_id: event.data.email_id ?? null,
    recipient: extractRecipient(event),
    email_type: extractCategory(event),
    event_type: mapEventType(event),
    payload: event as unknown as Record<string, unknown>,
  }

  const supabase = createAdminClient()
  const { error } = await (
    supabase.from('email_events') as unknown as {
      insert: (r: EmailEventInsertRow) => Promise<{ error: { message: string } | null }>
    }
  ).insert(row)

  if (error) {
    console.error('[webhook:resend] insert failed', error)
    return NextResponse.json({ error: 'db insert failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
