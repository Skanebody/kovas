/**
 * Wrapper minimal Brevo Transactional SMS API.
 *
 * Strategy V1 :
 * - Si BREVO_API_KEY défini → vraie envoi via Brevo
 * - Sinon (dev/staging sans clé) → log console + retour stub success
 *
 * Configuration :
 *   BREVO_API_KEY=xkeysib-xxx
 *   BREVO_SMS_SENDER=KOVAS  (max 11 alphanumériques, configuré côté Brevo)
 *
 * Coût : ~0,15€/SMS FR (cf. CLAUDE.md §4)
 */

export interface SmsResult {
  success: boolean
  messageId?: string
  error?: string
  stub?: boolean
}

const SENDER = process.env.BREVO_SMS_SENDER ?? 'KOVAS'

/**
 * Envoie un SMS transactionnel via Brevo.
 * `recipient` doit être au format E.164 (+33...).
 */
export async function sendSms(opts: {
  recipient: string
  content: string
  category?: string
}): Promise<SmsResult> {
  const apiKey = process.env.BREVO_API_KEY

  if (!apiKey) {
    console.log('[sms:stub]', {
      to: opts.recipient,
      content: opts.content.slice(0, 80),
      category: opts.category ?? 'transactional',
    })
    return { success: true, stub: true }
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: SENDER,
        recipient: opts.recipient,
        content: opts.content,
        type: 'transactional',
        tag: opts.category ?? 'claim_verification',
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP ${response.status}`)
      return { success: false, error: errText.slice(0, 500) }
    }

    const data = (await response.json().catch(() => ({}))) as { reference?: string }
    return { success: true, messageId: data.reference }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}
