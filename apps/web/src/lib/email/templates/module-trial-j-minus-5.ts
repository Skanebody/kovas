/**
 * Template email — Rappel J-5 essai gratuit module add-on (CLAUDE.md §17 + addon_modules).
 *
 * Ton SOBRE PROFESSIONNEL : vouvoiement, signature "— Benjamin / KOVAS",
 * zéro émoji fun, HTML inline compatible Gmail/Outlook.
 *
 * Trigger : Edge Function module-trial-tick (cron quotidien 09:00 UTC) lorsque
 * `trial_ends_at - now() <= 5 days AND reminder_j_minus_5_sent_at IS NULL`.
 */

import { formatLegalMentions } from '@/lib/legal/company-identity'

export interface ModuleTrialJMinus5Data {
  recipientName: string
  recipientEmail: string
  moduleDisplayName: string
  modulePriceEurPerMonth: number
  trialEndsAtIso: string
  disableUrl: string
  dashboardUrl: string
}

export interface ModuleTrialEmailContent {
  subject: string
  html: string
  text: string
}

const COLOR_INK = '#0F1E3D'
const COLOR_INK_MUTE = '#4A5878'
const COLOR_BG = '#F8F5EE'
const COLOR_PAPER = '#FDFBF6'
const COLOR_RULE = '#D5CDB8'

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDateFr(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d)
}

function renderHtml(d: ModuleTrialJMinus5Data): string {
  const firstName = d.recipientName.split(' ')[0] ?? d.recipientName
  const safeModule = escapeHtml(d.moduleDisplayName)
  const safeDisable = escapeHtml(d.disableUrl)
  const safeDashboard = escapeHtml(d.dashboardUrl)
  const endDate = escapeHtml(formatDateFr(d.trialEndsAtIso))

  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Plus que 5 jours d'essai sur ${safeModule}</title></head>
<body style="margin:0;padding:0;background-color:${COLOR_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLOR_INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR_BG};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:${COLOR_PAPER};border:1px solid ${COLOR_RULE};border-radius:12px;overflow:hidden;">
      <tr><td style="padding:28px 32px 16px 32px;border-bottom:1px solid ${COLOR_RULE};">
        <p style="margin:0 0 6px 0;font-family:'SFMono-Regular',Menlo,Monaco,Consolas,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COLOR_INK_MUTE};">
          KOVAS — Essai module
        </p>
        <h1 style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:${COLOR_INK};">
          Plus que 5 jours d'essai sur ${safeModule}
        </h1>
      </td></tr>
      <tr><td style="padding:24px 32px 8px 32px;">
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:${COLOR_INK};">
          Bonjour ${escapeHtml(firstName)},
        </p>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:${COLOR_INK};">
          Votre essai gratuit de 14 jours sur le module <strong>${safeModule}</strong> se termine le <strong>${endDate}</strong>.
        </p>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:${COLOR_INK};">
          Sans action de votre part, le module sera reconduit automatiquement à <strong>${d.modulePriceEurPerMonth} € HT/mois</strong>,
          prélevé sur la carte enregistrée à la souscription de votre forfait KOVAS 360.
        </p>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.55;color:${COLOR_INK};">
          Si vous ne souhaitez pas poursuivre, vous pouvez désactiver le module en un clic ci-dessous.
          Aucune justification ne vous sera demandée.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
          <tr><td style="background-color:${COLOR_INK};border-radius:999px;">
            <a href="${safeDisable}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:${COLOR_BG};text-decoration:none;">
              Désactiver ${safeModule}
            </a>
          </td></tr>
        </table>
        <p style="margin:0 0 28px 0;font-size:13px;line-height:1.55;color:${COLOR_INK_MUTE};">
          Vous pouvez aussi gérer vos modules depuis votre tableau de bord :
          <a href="${safeDashboard}" style="color:${COLOR_INK_MUTE};">${safeDashboard}</a>
        </p>
        <p style="margin:0 0 6px 0;font-size:14px;line-height:1.55;color:${COLOR_INK};">
          Bonne semaine,
        </p>
        <p style="margin:0;font-size:14px;line-height:1.55;color:${COLOR_INK};">
          — Benjamin / KOVAS
        </p>
      </td></tr>
      <tr><td style="padding:20px 32px 24px 32px;border-top:1px solid ${COLOR_RULE};background-color:${COLOR_BG};">
        <p style="margin:0;font-size:11px;line-height:1.6;color:${COLOR_INK_MUTE};">
          ${escapeHtml(formatLegalMentions())}
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

function renderText(d: ModuleTrialJMinus5Data): string {
  const firstName = d.recipientName.split(' ')[0] ?? d.recipientName
  return `Bonjour ${firstName},

Votre essai gratuit de 14 jours sur le module ${d.moduleDisplayName} se termine le ${formatDateFr(d.trialEndsAtIso)}.

Sans action de votre part, le module sera reconduit automatiquement à ${d.modulePriceEurPerMonth} € HT/mois, prélevé sur la carte enregistrée à la souscription de votre forfait KOVAS 360.

Si vous ne souhaitez pas poursuivre, vous pouvez désactiver le module en un clic :
${d.disableUrl}

Aucune justification ne vous sera demandée.

Bonne semaine,
— Benjamin / KOVAS

---
${formatLegalMentions()}
`
}

export function buildModuleTrialJMinus5Email(
  data: ModuleTrialJMinus5Data,
): ModuleTrialEmailContent {
  return {
    subject: `Plus que 5 jours d'essai sur ${data.moduleDisplayName}`,
    html: renderHtml(data),
    text: renderText(data),
  }
}
