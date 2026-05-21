/**
 * Email win-back J+7 post-résiliation.
 *
 * Envoyé par l'Edge Function `winback-email-sender` (cron quotidien 10h UTC).
 * Ne s'exécute que pour les cancellations confirmed_at <= now() - 7 jours et
 * winback_email_sent_at IS NULL.
 *
 * Ton : sobre, professionnel, signature humaine Benjamin. Aucun emoji. Aucun
 * gimmick gaming. Cf. avatar client docs/avatar-client.md.
 *
 * Le lien `reactivate` est unique (winback_code) et expire 6 mois après la
 * résiliation. Réutilisable seulement 1 fois (winback_code_used_at NULL).
 */

export interface WinbackEmailVars {
  firstName: string
  /** Premiers 100 caractères du feedback (sanitized) pour preuve qu'on a lu */
  feedbackExcerpt: string
  /** Code unique COMEBACK50-XXXXXXXX */
  winbackCode: string
  /** Réduction % (default 50) */
  discountPercent: number
  /** Durée réduction en mois (default 3) */
  discountDurationMonths: number
  /** URL d'app (default https://kovas.fr) */
  appUrl: string
}

export interface WinbackEmailPayload {
  subject: string
  text: string
  html: string
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildWinbackEmail(vars: WinbackEmailVars): WinbackEmailPayload {
  const firstNameClean = (vars.firstName || '').trim().split(' ')[0] || 'bonjour'
  const reactivateUrl = `${vars.appUrl.replace(/\/+$/, '')}/app/account?reactivate=${encodeURIComponent(vars.winbackCode)}`

  const subject = `On regrette de vous voir partir, ${firstNameClean}`

  const feedbackPart = vars.feedbackExcerpt
    ? `Vous nous avez écrit : « ${vars.feedbackExcerpt}${vars.feedbackExcerpt.length >= 100 ? '…' : ''} ». Nous l'avons lu attentivement.`
    : 'Nous avons relu votre retour attentivement.'

  const text = `${firstNameClean},

Cela fait une semaine que vous avez quitté KOVAS. Pas de relance — juste un mot rapide.

${feedbackPart}

Si vous souhaitez revenir, voici un code unique valide 6 mois :

  ${vars.winbackCode}

Il vous donne accès à votre formule précédente avec -${vars.discountPercent}% pendant ${vars.discountDurationMonths} mois.

Réactiver mon compte :
${reactivateUrl}

Pas de pression, pas de relance — ce code expire dans 6 mois et c'est tout.

Cordialement,

Benjamin Bel
Fondateur KOVAS
benjamin@kovas.fr
`

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>KOVAS</title></head>
<body style="margin:0;padding:0;background:#F8F5EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0F1E3D;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8F5EE;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF6;border:1px solid #D5CDB8;border-radius:18px;padding:32px;max-width:600px;">
        <tr><td style="font-size:15px;line-height:1.6;color:#0F1E3D;">
          <p style="margin:0 0 16px 0;">${escapeHtml(firstNameClean)},</p>
          <p style="margin:0 0 16px 0;">Cela fait une semaine que vous avez quitté KOVAS. Pas de relance — juste un mot rapide.</p>
          <p style="margin:0 0 16px 0;color:#4A5878;font-style:italic;">${escapeHtml(feedbackPart)}</p>
          <p style="margin:0 0 8px 0;">Si vous souhaitez revenir, voici un code unique valide 6 mois :</p>
          <p style="margin:0 0 16px 0;font-family:'JetBrains Mono',monospace;font-size:16px;background:#F8F5EE;border:1px solid #D5CDB8;border-radius:8px;padding:10px 16px;display:inline-block;">${escapeHtml(vars.winbackCode)}</p>
          <p style="margin:0 0 24px 0;">Il vous donne accès à votre formule précédente avec <strong>-${vars.discountPercent}% pendant ${vars.discountDurationMonths} mois</strong>.</p>
          <p style="margin:24px 0;">
            <a href="${escapeHtml(reactivateUrl)}" style="display:inline-block;background:#0F1E3D;color:#F8F5EE;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;">Réactiver mon compte</a>
          </p>
          <p style="margin:0 0 16px 0;font-size:13px;color:#7E8AA4;">Pas de pression, pas de relance — ce code expire dans 6 mois et c'est tout.</p>
          <p style="margin-top:32px;color:#4A5878;">— Benjamin Bel<br/>Fondateur KOVAS<br/><a href="mailto:benjamin@kovas.fr" style="color:#4A5878;">benjamin@kovas.fr</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return { subject, text, html }
}
