/**
 * Email transactionnel — wrapper Resend (CLAUDE.md §8).
 *
 * Strategy V1 :
 * - Si RESEND_API_KEY défini → vraie envoi via Resend
 * - Sinon (dev/staging sans clé) → log console + retour stub success
 *
 * À installer côté dev :
 *   pnpm add resend
 *
 * Configuration :
 *   RESEND_API_KEY=re_xxx
 *   RESEND_FROM=KOVAS <contact@kovas.fr>
 */

export interface EmailPayload {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  /** Type d'email pour tracking / opt-out par catégorie */
  category: EmailCategory
  /** Override expéditeur par défaut (KOVAS <contact@kovas.fr>). */
  from?: string
  /** Reply-To custom (transactional / personnal sender). */
  replyTo?: string
  /** Tags Resend additionnels (sequence, step, etc.). La catégorie est toujours ajoutée. */
  tags?: Array<{ name: string; value: string }>
}

export type EmailCategory =
  | 'transactional' // auth, reset password, confirmations
  | 'alert' // alertes critiques (quota DPE, RDV manqué, etc.)
  | 'digest' // récap mensuel / hebdo
  | 'product' // changelog, annonces

export interface EmailResult {
  success: boolean
  id?: string
  error?: string
  /** True si stubbed (dev sans clé Resend) */
  stub?: boolean
}

const FROM_DEFAULT = process.env.RESEND_FROM ?? 'KOVAS <contact@kovas.fr>'

/**
 * Envoie un email transactionnel.
 * Server-only — RESEND_API_KEY est secret, ne jamais exposer côté client.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    // Mode dev / staging sans clé — stub success + log
    console.log('[email:stub]', {
      to: payload.to,
      subject: payload.subject,
      category: payload.category,
      text: payload.text?.slice(0, 200),
    })
    return { success: true, stub: true }
  }

  try {
    // HTTP POST vers Resend API directement (pas besoin du SDK pour 1 endpoint)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: payload.from ?? FROM_DEFAULT,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        reply_to: payload.replyTo,
        tags: [
          { name: 'category', value: payload.category },
          ...(payload.tags ?? []),
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP ${response.status}`)
      return { success: false, error: errText.slice(0, 500) }
    }

    const data = (await response.json().catch(() => ({}))) as { id?: string }
    return { success: true, id: data.id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

/**
 * Email d'alerte quota DPE (CLAUDE.md §4 V1.5).
 * Déclenché par cron / trigger Supabase au passage des seuils 80/90/95/99%.
 */
export async function sendDpeQuotaAlert(opts: {
  to: string
  firstName: string
  count: number
  limit: number
  percentage: number
}): Promise<EmailResult> {
  const { to, firstName, count, limit, percentage } = opts
  const remaining = limit - count

  const subjectByLevel =
    percentage >= 99
      ? `🚨 Limite DPE atteinte (${count}/${limit})`
      : percentage >= 95
        ? `⚠️ Critique : ${remaining} DPE restants cette année`
        : percentage >= 90
          ? `Attention : ${remaining} DPE restants avant la limite légale`
          : `Vous approchez du quota DPE annuel (${percentage}%)`

  const text = `Bonjour ${firstName},

Vous avez réalisé ${count} attestations DPE cette année (${percentage}% du quota légal de ${limit}/an).
${
  percentage >= 99
    ? `\nLa limite légale est atteinte. Toute nouvelle attestation DPE doit attendre l'année prochaine.\n`
    : percentage >= 95
      ? `\nIl ne vous reste que ${remaining} DPE possibles cette année. Revoyez votre planning.\n`
      : `\nIl vous reste ${remaining} DPE possibles cette année.\n`
}
Connectez-vous à votre tableau de bord KOVAS pour suivre votre quota en temps réel :
https://kovas.fr/app/gain

Cordialement,
Benjamin Bel
Fondateur KOVAS
`

  return sendEmail({
    to,
    subject: subjectByLevel,
    text,
    category: 'alert',
  })
}

/**
 * Email de notification — déblocage d'un nouveau statut professionnel.
 *
 * Ton SOBRE PROFESSIONNEL (cf. docs/avatar-client.md) :
 *   vouvoiement, aucun emoji marketing, signature humaine Benjamin.
 *
 * Max 1 email / mois côté caller (anti-spam).
 */
export async function sendLevelUnlockedEmail(opts: {
  to: string
  firstName: string
  levelLabel: string
  levelDescription: string
}): Promise<EmailResult> {
  const { to, firstName, levelLabel, levelDescription } = opts

  const text = `Bonjour ${firstName},

Vous venez de débloquer le statut "${levelLabel}" sur KOVAS.

${levelDescription}

Ce statut reconnaît votre engagement et votre activité sur la plateforme. Il est consultable depuis votre tableau de bord :
https://kovas.fr/app/account/progression

Aucune action n'est requise de votre part. Ce statut ne donne accès à aucun avantage tarifaire — il s'agit d'une marque de reconnaissance.

Cordialement,
Benjamin Bel
Fondateur KOVAS
`

  return sendEmail({
    to,
    subject: `Nouveau statut KOVAS : ${levelLabel}`,
    text,
    category: 'product',
  })
}
