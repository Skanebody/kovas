/**
 * KOVAS — Template email digest mensuel d'upsell (L1).
 *
 * Format "rapport d'activité business sobre" :
 *   - Stats du mois (style Apple Santé KPI hero)
 *   - 1-2 suggestions max avec bouton "Démarrer essai 14j"
 *   - Signature humaine Benjamin
 *   - Lien préférences notifications email
 *
 * Pas de glow, pas de gradient fancy, pas d'emoji marketing.
 * Cf. docs/avatar-client.md — ton SOBRE PROFESSIONNEL.
 */

export interface MonthlyDigestSuggestion {
  title: string
  reasonLabel: string
  reasonBenefit: string
  priceLabel: string
  trialLabel: string
  ctaLabel: string
  ctaUrl: string
}

export interface MonthlyDigestData {
  recipientFirstName: string
  monthLabel: string // ex. "Mai 2026"
  missionsCount: number
  invoicesCount: number
  leadsCount: number
  hoursSavedEstimate: number
  suggestions: readonly MonthlyDigestSuggestion[]
  unsubscribeUrl: string
}

export function renderMonthlyDigestHtml(data: MonthlyDigestData): string {
  const {
    recipientFirstName,
    monthLabel,
    missionsCount,
    invoicesCount,
    leadsCount,
    hoursSavedEstimate,
    suggestions,
    unsubscribeUrl,
  } = data

  const suggestionsHtml = suggestions
    .map(
      (s) => `
    <tr><td style="padding:24px 0;border-top:1px solid #E5DECB;">
      <p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4A5878;margin:0 0 6px 0;">
        ${escapeHtml(s.reasonLabel)}
      </p>
      <h3 style="font-family:'Manrope',sans-serif;font-size:18px;font-weight:700;color:#0F1E3D;margin:0 0 8px 0;line-height:1.3;">
        ${escapeHtml(s.title)}
      </h3>
      <p style="font-family:'Manrope',sans-serif;font-size:14px;color:#4A5878;line-height:1.5;margin:0 0 14px 0;">
        ${escapeHtml(s.reasonBenefit)}
      </p>
      <p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#7E8AA4;margin:0 0 14px 0;">
        ${escapeHtml(s.priceLabel)} · ${escapeHtml(s.trialLabel)}
      </p>
      <a href="${escapeHtml(s.ctaUrl)}" style="display:inline-block;background:#D4F542;color:#0F1419;font-family:'Manrope',sans-serif;font-weight:600;font-size:13px;padding:10px 22px;border-radius:999px;text-decoration:none;">
        ${escapeHtml(s.ctaLabel)}
      </a>
    </td></tr>`,
    )
    .join('')

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Votre activité du mois — KOVAS 360</title>
</head>
<body style="margin:0;padding:0;background:#F8F5EE;font-family:'Manrope',Arial,sans-serif;color:#0F1E3D;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F8F5EE;padding:32px 0;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#FDFBF6;border-radius:24px;padding:32px;">
      <tr><td>
        <p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4A5878;margin:0 0 6px 0;">
          KOVAS 360 · Rapport mensuel
        </p>
        <h1 style="font-family:'Instrument Serif',serif;font-style:italic;font-size:32px;color:#0F1E3D;margin:0 0 6px 0;line-height:1.15;">
          ${escapeHtml(monthLabel)}
        </h1>
        <p style="font-family:'Manrope',sans-serif;font-size:14px;color:#4A5878;line-height:1.5;margin:0 0 28px 0;">
          Bonjour ${escapeHtml(recipientFirstName)}, voici un aperçu de votre activité du mois.
        </p>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top:1px solid #E5DECB;margin-bottom:8px;">
          <tr>
            <td style="padding:20px 0;border-bottom:1px solid #E5DECB;">
              <p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4A5878;margin:0 0 4px 0;">Missions réalisées</p>
              <p style="font-family:'Instrument Serif',serif;font-style:italic;font-size:42px;color:#0F1E3D;margin:0;line-height:1;">${missionsCount}</p>
            </td>
            <td style="padding:20px 0;border-bottom:1px solid #E5DECB;">
              <p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4A5878;margin:0 0 4px 0;">Factures émises</p>
              <p style="font-family:'Instrument Serif',serif;font-style:italic;font-size:42px;color:#0F1E3D;margin:0;line-height:1;">${invoicesCount}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 0;border-bottom:1px solid #E5DECB;">
              <p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4A5878;margin:0 0 4px 0;">Demandes reçues</p>
              <p style="font-family:'Instrument Serif',serif;font-style:italic;font-size:42px;color:#0F1E3D;margin:0;line-height:1;">${leadsCount}</p>
            </td>
            <td style="padding:20px 0;border-bottom:1px solid #E5DECB;">
              <p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4A5878;margin:0 0 4px 0;">Temps estimé économisé</p>
              <p style="font-family:'Instrument Serif',serif;font-style:italic;font-size:42px;color:#0F1E3D;margin:0;line-height:1;">${hoursSavedEstimate}h</p>
            </td>
          </tr>
        </table>

        ${
          suggestions.length > 0
            ? `<div style="margin-top:24px;">
                 <p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#4A5878;margin:0 0 4px 0;">Suggestions personnalisées</p>
                 <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">${suggestionsHtml}</table>
               </div>`
            : ''
        }

        <p style="font-family:'Manrope',sans-serif;font-size:14px;color:#0F1E3D;margin:32px 0 4px 0;">Benjamin</p>
        <p style="font-family:'Manrope',sans-serif;font-size:12px;color:#4A5878;margin:0;">Fondateur · KOVAS 360</p>

        <p style="font-family:'Manrope',sans-serif;font-size:11px;color:#7E8AA4;margin:24px 0 0 0;line-height:1.5;">
          Vous recevez ce mail parce que vous avez activé les rapports mensuels d&apos;activité.
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#7E8AA4;text-decoration:underline;">Préférences de notification</a>.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
