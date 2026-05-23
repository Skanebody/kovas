/**
 * Templates email + SMS pour les codes de vérification claim.
 * Ton sobre professionnel, jamais d'emoji (cf. CLAUDE.md §21bis avatar).
 */

export function buildClaimEmailVerification(opts: {
  code: string
  diagnosticianName: string
  claimUrl: string
}): { subject: string; text: string; html: string } {
  const { code, diagnosticianName, claimUrl } = opts

  const subject = `KOVAS — Code de vérification : ${code}`

  const text = `Bonjour,

Vous avez demandé à réclamer la fiche professionnelle "${diagnosticianName}" sur l'annuaire KOVAS.

Votre code de vérification :

   ${code}

Ce code expire dans 10 minutes.

Saisissez-le sur la page :
${claimUrl}

Si vous n'êtes pas à l'origine de cette demande, ignorez ce message. Aucune action ne sera prise.

Cordialement,
L'équipe KOVAS
contact@kovas.fr
`

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#F8F5EE;padding:32px 16px;color:#0F1E3D;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;margin:0 auto;background:#FDFBF6;border:1px solid #E5DECB;border-radius:18px;padding:32px;">
    <tr><td>
      <p style="margin:0 0 16px 0;font-size:14px;color:#4A5878;">KOVAS — Annuaire diagnostiqueurs</p>
      <h1 style="margin:0 0 24px 0;font-size:22px;font-weight:700;color:#0F1E3D;">Code de vérification</h1>
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;">Vous avez demandé à réclamer la fiche professionnelle <strong>${escapeHtml(diagnosticianName)}</strong> sur l'annuaire KOVAS.</p>
      <p style="margin:0 0 8px 0;font-size:13px;color:#4A5878;">Votre code :</p>
      <div style="font-family:'JetBrains Mono','Courier New',monospace;font-size:36px;font-weight:700;letter-spacing:0.2em;background:#F8F5EE;border:1px solid #D5CDB8;border-radius:12px;padding:20px;text-align:center;margin:8px 0 24px 0;color:#0F1E3D;">${code}</div>
      <p style="margin:0 0 16px 0;font-size:13px;color:#4A5878;">Ce code expire dans 10 minutes.</p>
      <p style="margin:0 0 24px 0;"><a href="${claimUrl}" style="display:inline-block;background:#0F1E3D;color:#F8F5EE;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">Saisir le code</a></p>
      <hr style="border:none;border-top:1px solid #E5DECB;margin:24px 0;">
      <p style="margin:0;font-size:12px;color:#7E8AA4;">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message. Aucune action ne sera prise.</p>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}

export function buildClaimSmsVerification(code: string): string {
  // Brevo SMS limite à 160 caractères pour 1 SMS facturé.
  return `KOVAS : votre code de verification est ${code}. Il expire dans 10 minutes. Si vous n'etes pas a l'origine de cette demande, ignorez ce SMS.`
}

export function buildClaimAdminNotification(opts: {
  diagnosticianName: string
  claimId: string
  contactEmail: string | null
  contactPhone: string | null
}): { subject: string; text: string } {
  return {
    subject: `[KOVAS Admin] Nouvelle demande de réclamation manuelle — ${opts.diagnosticianName}`,
    text: `Une nouvelle demande de réclamation manuelle vient d'arriver.

Fiche : ${opts.diagnosticianName}
Claim ID : ${opts.claimId}
Contact email : ${opts.contactEmail ?? '—'}
Contact téléphone : ${opts.contactPhone ?? '—'}

Vérifier les justificatifs uploadés et accepter/rejeter sur :
https://kovas.fr/app/admin/claims/${opts.claimId}

(Cette page admin sera disponible en V1.5)
`,
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
