/**
 * Template email — Premier prélèvement effectué après conversion d'essai module
 * add-on en abonnement payant (CLAUDE.md §17, §5 anti-friction).
 *
 * Ton SOBRE PROFESSIONNEL : vouvoiement, signature "— Benjamin / KOVAS",
 * zéro émoji fun, HTML inline compatible Gmail/Outlook.
 *
 * Trigger : Edge Function module-trial-tick au moment où `trial_ends_at <= now()`
 * et que l'utilisateur n'a pas annulé : on encaisse + on envoie ce récap.
 */

import { formatLegalMentions } from '@/lib/legal/company-identity'

export interface ModuleTrialConvertedData {
  recipientName: string
  recipientEmail: string
  moduleDisplayName: string
  /** Montant HT en euros, ex 9 (Vision IA) / 12 (Documents) / etc. */
  firstPaymentEurHt: number
  /** Montant TTC en euros (TVA 20%). */
  firstPaymentEurTtc: number
  /** Date prochain prélèvement ISO (J+30 typiquement). */
  nextChargeIso: string
  manageUrl: string
  invoiceUrl?: string | null
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

function formatEur(v: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

function formatDateFr(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function renderHtml(d: ModuleTrialConvertedData): string {
  const firstName = d.recipientName.split(' ')[0] ?? d.recipientName
  const safeModule = escapeHtml(d.moduleDisplayName)
  const safeManage = escapeHtml(d.manageUrl)
  const safeInvoice = d.invoiceUrl ? escapeHtml(d.invoiceUrl) : null
  const nextDate = escapeHtml(formatDateFr(d.nextChargeIso))

  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Premier prélèvement effectué — ${safeModule}</title></head>
<body style="margin:0;padding:0;background-color:${COLOR_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLOR_INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR_BG};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:${COLOR_PAPER};border:1px solid ${COLOR_RULE};border-radius:12px;overflow:hidden;">
      <tr><td style="padding:28px 32px 16px 32px;border-bottom:1px solid ${COLOR_RULE};">
        <p style="margin:0 0 6px 0;font-family:'SFMono-Regular',Menlo,Monaco,Consolas,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COLOR_INK_MUTE};">
          KOVAS — Confirmation d'abonnement
        </p>
        <h1 style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:${COLOR_INK};">
          Premier prélèvement effectué — ${safeModule}
        </h1>
      </td></tr>
      <tr><td style="padding:24px 32px 8px 32px;">
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:${COLOR_INK};">
          Bonjour ${escapeHtml(firstName)},
        </p>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:${COLOR_INK};">
          Votre essai gratuit de 14 jours sur le module <strong>${safeModule}</strong> est terminé.
          Le module est désormais actif sur votre compte.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;">
          <tr><td style="padding:14px 16px;border:1px solid ${COLOR_RULE};border-radius:8px;background-color:#FBF8F0;">
            <p style="margin:0 0 8px 0;font-family:'SFMono-Regular',Menlo,Monaco,Consolas,monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${COLOR_INK_MUTE};">
              Récapitulatif
            </p>
            <p style="margin:0 0 4px 0;font-size:14px;color:${COLOR_INK};">
              Montant HT : <strong>${formatEur(d.firstPaymentEurHt)}</strong>
            </p>
            <p style="margin:0 0 4px 0;font-size:14px;color:${COLOR_INK};">
              Montant TTC (TVA 20 %) : <strong>${formatEur(d.firstPaymentEurTtc)}</strong>
            </p>
            <p style="margin:0;font-size:14px;color:${COLOR_INK_MUTE};">
              Prochain prélèvement : ${nextDate}
            </p>
          </td></tr>
        </table>
        <p style="margin:0 0 24px 0;font-size:14px;line-height:1.55;color:${COLOR_INK};">
          Vous pouvez interrompre l'abonnement à tout moment depuis votre tableau de bord, sans engagement.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
          <tr><td style="background-color:${COLOR_INK};border-radius:999px;">
            <a href="${safeManage}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:${COLOR_BG};text-decoration:none;">
              Gérer mon abonnement
            </a>
          </td></tr>
        </table>
        ${
          safeInvoice
            ? `<p style="margin:0 0 28px 0;font-size:13px;line-height:1.55;color:${COLOR_INK_MUTE};">
                Télécharger la facture : <a href="${safeInvoice}" style="color:${COLOR_INK_MUTE};">${safeInvoice}</a>
              </p>`
            : ''
        }
        <p style="margin:0 0 6px 0;font-size:14px;line-height:1.55;color:${COLOR_INK};">
          Merci pour votre confiance,
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

function renderText(d: ModuleTrialConvertedData): string {
  const firstName = d.recipientName.split(' ')[0] ?? d.recipientName
  return `Bonjour ${firstName},

Votre essai gratuit de 14 jours sur le module ${d.moduleDisplayName} est terminé.
Le module est désormais actif sur votre compte.

Récapitulatif :
- Montant HT : ${formatEur(d.firstPaymentEurHt)}
- Montant TTC (TVA 20%) : ${formatEur(d.firstPaymentEurTtc)}
- Prochain prélèvement : ${formatDateFr(d.nextChargeIso)}

Vous pouvez interrompre l'abonnement à tout moment depuis votre tableau de bord, sans engagement.

Gérer mon abonnement : ${d.manageUrl}
${d.invoiceUrl ? `Télécharger la facture : ${d.invoiceUrl}\n` : ''}
Merci pour votre confiance,
— Benjamin / KOVAS

---
${formatLegalMentions()}
`
}

export function buildModuleTrialConvertedEmail(
  data: ModuleTrialConvertedData,
): ModuleTrialEmailContent {
  return {
    subject: `Premier prélèvement effectué — ${data.moduleDisplayName} (${formatEur(data.firstPaymentEurHt)} HT)`,
    html: renderHtml(data),
    text: renderText(data),
  }
}
