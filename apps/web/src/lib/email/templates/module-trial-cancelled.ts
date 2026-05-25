/**
 * Template email — Confirmation d'annulation d'essai gratuit module add-on
 * (CLAUDE.md §17 + CLAUDE.md §5 anti-friction).
 *
 * Ton SOBRE PROFESSIONNEL : vouvoiement, signature "— Benjamin / KOVAS",
 * zéro émoji fun, HTML inline compatible Gmail/Outlook.
 *
 * Trigger : Edge Function module-trial-tick lorsque user_decision='cancel' et
 * que trial_ends_at <= now() (ou immédiatement après cancel manuel UI).
 *
 * Message clé : aucun prélèvement effectué, module désactivé, possibilité de
 * réactiver plus tard. Pas de relance commerciale.
 */

import { formatLegalMentions } from '@/lib/legal/company-identity'

export interface ModuleTrialCancelledData {
  recipientName: string
  recipientEmail: string
  moduleDisplayName: string
  cancelledAtIso: string
  dashboardUrl: string
}

import type { ModuleTrialEmailContent } from './module-trial-j-minus-5'

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
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function renderHtml(d: ModuleTrialCancelledData): string {
  const firstName = d.recipientName.split(' ')[0] ?? d.recipientName
  const safeModule = escapeHtml(d.moduleDisplayName)
  const safeDashboard = escapeHtml(d.dashboardUrl)
  const cancelledDate = escapeHtml(formatDateFr(d.cancelledAtIso))

  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Essai annulé — ${safeModule}</title></head>
<body style="margin:0;padding:0;background-color:${COLOR_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLOR_INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR_BG};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:${COLOR_PAPER};border:1px solid ${COLOR_RULE};border-radius:12px;overflow:hidden;">
      <tr><td style="padding:28px 32px 16px 32px;border-bottom:1px solid ${COLOR_RULE};">
        <p style="margin:0 0 6px 0;font-family:'SFMono-Regular',Menlo,Monaco,Consolas,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COLOR_INK_MUTE};">
          KOVAS — Confirmation
        </p>
        <h1 style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:${COLOR_INK};">
          Essai annulé — ${safeModule}
        </h1>
      </td></tr>
      <tr><td style="padding:24px 32px 8px 32px;">
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:${COLOR_INK};">
          Bonjour ${escapeHtml(firstName)},
        </p>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:${COLOR_INK};">
          C'est confirmé : votre essai du module <strong>${safeModule}</strong> a été annulé le ${cancelledDate}.
        </p>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:${COLOR_INK};">
          <strong>Aucun prélèvement n'a été effectué.</strong> Votre forfait KOVAS reste actif aux mêmes conditions.
        </p>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.55;color:${COLOR_INK};">
          Vous pourrez réactiver ce module à tout moment depuis votre tableau de bord, sans nouvelle période d'essai gratuit.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
          <tr><td style="background-color:${COLOR_INK};border-radius:999px;">
            <a href="${safeDashboard}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:${COLOR_BG};text-decoration:none;">
              Retour au tableau de bord
            </a>
          </td></tr>
        </table>
        <p style="margin:0 0 6px 0;font-size:14px;line-height:1.55;color:${COLOR_INK};">
          Bonne continuation,
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

function renderText(d: ModuleTrialCancelledData): string {
  const firstName = d.recipientName.split(' ')[0] ?? d.recipientName
  return `Bonjour ${firstName},

C'est confirmé : votre essai du module ${d.moduleDisplayName} a été annulé le ${formatDateFr(d.cancelledAtIso)}.

Aucun prélèvement n'a été effectué. Votre forfait KOVAS reste actif aux mêmes conditions.

Vous pourrez réactiver ce module à tout moment depuis votre tableau de bord, sans nouvelle période d'essai gratuit :
${d.dashboardUrl}

Bonne continuation,
— Benjamin / KOVAS

---
${formatLegalMentions()}
`
}

export function buildModuleTrialCancelledEmail(
  data: ModuleTrialCancelledData,
): ModuleTrialEmailContent {
  return {
    subject: `Essai annulé — ${data.moduleDisplayName}`,
    html: renderHtml(data),
    text: renderText(data),
  }
}
