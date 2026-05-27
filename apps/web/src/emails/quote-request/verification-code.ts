/**
 * KOVAS — Email "Vérifiez votre email" (anti-spam K1).
 *
 * Envoyé au particulier juste après soumission du formulaire. Le code 6 chiffres
 * confirme que l'email est joignable et que la demande n'est pas un bot.
 *
 * Ton sobre rassurant — navy + cream brand B2C.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface VerificationCodeEmailParams {
  first_name: string
  code: string
  tracking_token: string
  base_url: string
}

export function renderVerificationCodeEmail(params: VerificationCodeEmailParams): {
  subject: string
  html: string
  text: string
} {
  const subject = `Confirmez votre demande de devis — code ${params.code}`
  const verifyUrl = `${params.base_url}/verifier-mon-email/${params.tracking_token}`

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F8F5EE;margin:0;padding:24px;color:#0F1E3D">
  <div style="max-width:600px;margin:0 auto;background:#FDFBF6;border-radius:18px;padding:32px;border:1px solid #D5CDB8">
    <p style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#7E8AA4;margin:0 0 8px">Vérification</p>
    <h1 style="margin:0 0 16px;font-size:24px;color:#0F1E3D">Bonjour ${escapeHtml(params.first_name)},</h1>

    <p style="margin:0 0 16px;line-height:1.6;color:#1F2E4D">
      Pour finaliser votre demande de devis, merci de confirmer votre adresse email
      en saisissant le code ci-dessous sur la page KOVAS.
    </p>

    <div style="margin:24px 0;padding:24px;background:#F8F5EE;border-radius:12px;border:1px solid #D5CDB8;text-align:center">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#7E8AA4">Code de vérification</p>
      <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.2em;color:#0F1E3D;font-family:'JetBrains Mono',Consolas,monospace">
        ${escapeHtml(params.code)}
      </p>
      <p style="margin:8px 0 0;font-size:12px;color:#7E8AA4">Valable 30 minutes</p>
    </div>

    <div style="margin:32px 0;text-align:center">
      <a href="${escapeHtml(verifyUrl)}"
         style="display:inline-block;padding:12px 32px;background:#0F1E3D;color:#F8F5EE;text-decoration:none;border-radius:999px;font-weight:600">
        Confirmer ma demande
      </a>
    </div>

    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#1F2E4D">
      Une fois confirmée, votre demande sera transmise à plusieurs diagnostiqueurs
      certifiés de votre secteur. Vous recevrez leurs réponses directement par email
      sous 24-48 heures.
    </p>

    <hr style="border:none;border-top:1px solid #D5CDB8;margin:32px 0">
    <p style="font-size:12px;color:#7E8AA4;margin:0;line-height:1.6">
      Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet email :
      votre adresse ne sera pas ajoutée à nos bases.<br><br>
      KOVAS met en relation particuliers et diagnostiqueurs immobiliers certifiés.
    </p>
  </div>
</body></html>
  `.trim()

  const text = [
    `Bonjour ${params.first_name},`,
    ``,
    `Pour finaliser votre demande de devis, merci de confirmer votre adresse email`,
    `en saisissant ce code 6 chiffres :`,
    ``,
    `   ${params.code}`,
    ``,
    `(valable 30 minutes)`,
    ``,
    `Confirmer ma demande : ${verifyUrl}`,
    ``,
    `Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.`,
    ``,
    `— L'équipe KOVAS`,
  ].join('\n')

  return { subject, html, text }
}

/**
 * Email envoyé au requester APRÈS vérification réussie : récap + lien suivi.
 */
export function renderQuoteSentToMultipleEmail(params: {
  first_name: string
  recipient_count: number
  tracking_token: string
  base_url: string
  diagnostics_labels: string[]
  property_city: string | null
}): { subject: string; html: string; text: string } {
  const subject = `Votre demande a été transmise à ${params.recipient_count} diagnostiqueurs`
  const trackUrl = `${params.base_url}/mes-demandes/${params.tracking_token}`

  const diagList = params.diagnostics_labels
    .map((d) => `<li style="margin:2px 0">${escapeHtml(d)}</li>`)
    .join('')

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F8F5EE;margin:0;padding:24px;color:#0F1E3D">
  <div style="max-width:600px;margin:0 auto;background:#FDFBF6;border-radius:18px;padding:32px;border:1px solid #D5CDB8">
    <p style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#7E8AA4;margin:0 0 8px">Demande confirmée</p>
    <h1 style="margin:0 0 16px;font-size:24px;color:#0F1E3D">Bonjour ${escapeHtml(params.first_name)},</h1>

    <p style="margin:0 0 16px;line-height:1.6;color:#1F2E4D">
      Votre demande de devis a bien été transmise à <strong>${params.recipient_count}
      diagnostiqueurs certifiés</strong>${params.property_city ? ` proches de ${escapeHtml(params.property_city)}` : ''}.
      Ils vous contacteront directement sous 24 à 48 heures ouvrées.
    </p>

    <div style="margin:24px 0;padding:16px;background:#F8F5EE;border-radius:12px;border:1px solid #D5CDB8">
      <p style="margin:0 0 8px;font-size:12px;color:#4A5878;font-weight:600">Diagnostics demandés</p>
      <ul style="margin:4px 0;padding-left:20px;font-size:14px;color:#1F2E4D">${diagList}</ul>
    </div>

    <div style="margin:32px 0;text-align:center">
      <a href="${escapeHtml(trackUrl)}"
         style="display:inline-block;padding:12px 32px;background:#0F1E3D;color:#F8F5EE;text-decoration:none;border-radius:999px;font-weight:600">
        Suivre l’état de ma demande
      </a>
    </div>

    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#1F2E4D">
      Comparez sereinement les réponses : prix, délais, disponibilités. Vous n’avez
      aucune obligation et la consultation est entièrement gratuite.
    </p>

    <hr style="border:none;border-top:1px solid #D5CDB8;margin:32px 0">
    <p style="font-size:12px;color:#7E8AA4;margin:0;line-height:1.6">
      KOVAS met en relation particuliers et diagnostiqueurs immobiliers certifiés.
      Vous n’avez pas de compte à créer — votre demande est gratuite et sans engagement.
    </p>
  </div>
</body></html>
  `.trim()

  const text = [
    `Bonjour ${params.first_name},`,
    ``,
    `Votre demande de devis a bien été transmise à ${params.recipient_count} diagnostiqueurs certifiés.`,
    `Ils vous contacteront directement sous 24 à 48 heures ouvrées.`,
    ``,
    `Diagnostics demandés :`,
    ...params.diagnostics_labels.map((d) => `- ${d}`),
    ``,
    `Suivre l'état de ma demande : ${trackUrl}`,
    ``,
    `— L'équipe KOVAS`,
  ].join('\n')

  return { subject, html, text }
}
