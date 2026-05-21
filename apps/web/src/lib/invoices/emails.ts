/**
 * Templates email pour le module Factures :
 *  - Émission ("Votre facture FAC-2026-00042")
 *  - Rappel amical J+7
 *  - Rappel formel J+15
 *  - Mise en demeure J+30
 *  - Confirmation paiement (interne au diagnostiqueur)
 *
 * Tous les emails sont en français, ton sobre professionnel, signature
 * humaine (full_name du diagnostiqueur).
 */

import { sendEmail } from '@/lib/email/send'
import { computeLatePenalties, L441_10_FOOTNOTE } from './penalties'

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDateFr(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function wrapHtml(args: {
  bodyHtml: string
  diagnosticianName: string
  diagnosticianEmail: string
}): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>KOVAS</title></head>
<body style="margin:0;padding:0;background:#F5F7F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0F1419;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F7F4;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;padding:32px;max-width:600px;">
        <tr><td style="font-size:15px;line-height:1.55;color:#0F1419;">
          ${args.bodyHtml}
          <p style="margin-top:32px;color:#6B7280;font-size:14px;">— ${escapeHtml(args.diagnosticianName)}<br/>${escapeHtml(args.diagnosticianEmail)}</p>
        </td></tr>
        <tr><td style="border-top:1px solid #E5E7EB;padding-top:16px;font-size:11px;color:#9CA3AF;">
          Cet email vous est envoyé via KOVAS — la plateforme métier des diagnostiqueurs immobiliers.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 12px 0;">${escapeHtml(text)}</p>`
}

function buttonHtml(label: string, url: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#0F1419;color:#FFFFFF;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(label)}</a></p>`
}

function ibanBlockHtml(args: {
  bankName: string | null
  iban: string | null
  bic: string | null
  reference: string
}): string {
  if (!args.iban) return ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;padding:14px 18px;background:#F5F7F4;border:1px solid #E5E7EB;border-radius:12px;font-size:13px;line-height:1.6;">
    <tr><td>
      <strong style="color:#0F1419;">Virement bancaire</strong><br/>
      ${args.bankName ? `${escapeHtml(args.bankName)}<br/>` : ''}
      IBAN : <code style="font-family:Menlo,Consolas,monospace;">${escapeHtml(args.iban)}</code><br/>
      ${args.bic ? `BIC : <code style="font-family:Menlo,Consolas,monospace;">${escapeHtml(args.bic)}</code><br/>` : ''}
      Référence à indiquer : <strong>${escapeHtml(args.reference)}</strong>
    </td></tr>
  </table>`
}

// ──────────────────────────────────────────────────────────────────────
// 1. Email d'émission ("Votre facture FAC-XXXX")
// ──────────────────────────────────────────────────────────────────────

export interface IssuedEmailArgs {
  to: string
  recipientFirstName: string | null
  invoiceReference: string
  amountTtc: number
  dueDate: string | null
  paymentLinkUrl: string | null
  pdfDownloadUrl: string | null
  diagnosticianName: string
  diagnosticianEmail: string
  bankName: string | null
  iban: string | null
  bic: string | null
  notes: string | null
}

export async function sendInvoiceIssuedEmail(args: IssuedEmailArgs) {
  const greeting = args.recipientFirstName
    ? `Bonjour ${args.recipientFirstName},`
    : 'Bonjour,'

  const lines = [
    greeting,
    `Vous trouverez ci-joint votre facture ${args.invoiceReference} d'un montant de ${formatEur(args.amountTtc)} TTC.`,
    args.dueDate
      ? `Échéance de paiement : ${formatDateFr(args.dueDate)}.`
      : 'Merci de procéder au règlement dans les meilleurs délais.',
  ]
  if (args.notes) lines.push(args.notes)

  const ctaBlock = args.paymentLinkUrl
    ? buttonHtml('Régler en ligne', args.paymentLinkUrl)
    : ''

  const pdfBlock = args.pdfDownloadUrl
    ? `<p style="margin:8px 0;font-size:13px;color:#6B7280;"><a href="${escapeHtml(args.pdfDownloadUrl)}" style="color:#0F1419;text-decoration:underline;">Télécharger la facture (PDF)</a></p>`
    : ''

  const ibanBlock = !args.paymentLinkUrl
    ? ibanBlockHtml({
        bankName: args.bankName,
        iban: args.iban,
        bic: args.bic,
        reference: args.invoiceReference,
      })
    : ''

  const bodyHtml = lines.map(paragraph).join('') + ctaBlock + pdfBlock + ibanBlock
  const text = `${lines.join('\n\n')}\n\n${args.paymentLinkUrl ? `Régler en ligne : ${args.paymentLinkUrl}\n` : ''}${args.pdfDownloadUrl ? `Télécharger la facture : ${args.pdfDownloadUrl}\n` : ''}${args.iban ? `\nIBAN : ${args.iban} — Référence : ${args.invoiceReference}` : ''}`

  return sendEmail({
    to: args.to,
    subject: `Votre facture ${args.invoiceReference}`,
    html: wrapHtml({
      bodyHtml,
      diagnosticianName: args.diagnosticianName,
      diagnosticianEmail: args.diagnosticianEmail,
    }),
    text,
    category: 'transactional',
  })
}

// ──────────────────────────────────────────────────────────────────────
// 2. Rappel J+7 (amical)
// ──────────────────────────────────────────────────────────────────────

export interface ReminderEmailArgs {
  to: string
  recipientFirstName: string | null
  invoiceReference: string
  amountTtc: number
  amountUnpaid: number
  daysLate: number
  dueDate: string | null
  paymentLinkUrl: string | null
  pdfDownloadUrl: string | null
  diagnosticianName: string
  diagnosticianEmail: string
  bankName: string | null
  iban: string | null
  bic: string | null
}

export async function sendReminderJ7Email(args: ReminderEmailArgs) {
  const greeting = args.recipientFirstName
    ? `Bonjour ${args.recipientFirstName},`
    : 'Bonjour,'

  const lines = [
    greeting,
    `Petit rappel concernant la facture ${args.invoiceReference} (${formatEur(args.amountUnpaid)}) arrivée à échéance le ${formatDateFr(args.dueDate)}.`,
    `Si le règlement est déjà en cours, merci d'ignorer ce message.`,
    `Sinon vous pouvez procéder au paiement en quelques clics ci-dessous.`,
  ]
  const ctaBlock = args.paymentLinkUrl ? buttonHtml('Régler la facture', args.paymentLinkUrl) : ''
  const ibanBlock = ibanBlockHtml({
    bankName: args.bankName,
    iban: args.iban,
    bic: args.bic,
    reference: args.invoiceReference,
  })
  const pdfBlock = args.pdfDownloadUrl
    ? `<p style="margin:8px 0;font-size:13px;color:#6B7280;"><a href="${escapeHtml(args.pdfDownloadUrl)}" style="color:#0F1419;text-decoration:underline;">Revoir la facture (PDF)</a></p>`
    : ''

  return sendEmail({
    to: args.to,
    subject: `Rappel : facture ${args.invoiceReference}`,
    html: wrapHtml({
      bodyHtml: lines.map(paragraph).join('') + ctaBlock + pdfBlock + ibanBlock,
      diagnosticianName: args.diagnosticianName,
      diagnosticianEmail: args.diagnosticianEmail,
    }),
    text: lines.join('\n\n'),
    category: 'transactional',
  })
}

// ──────────────────────────────────────────────────────────────────────
// 3. Rappel J+15 (formel)
// ──────────────────────────────────────────────────────────────────────

export async function sendReminderJ15Email(args: ReminderEmailArgs) {
  const greeting = args.recipientFirstName
    ? `Bonjour ${args.recipientFirstName},`
    : 'Bonjour,'

  const lines = [
    greeting,
    `Malgré mon premier rappel, la facture ${args.invoiceReference} (${formatEur(args.amountUnpaid)}) reste impayée à ce jour (échéance : ${formatDateFr(args.dueDate)}, soit ${args.daysLate} jours de retard).`,
    `Conformément à l'article L.441-10 du Code de commerce, des pénalités de retard pourront s'appliquer à compter du 31e jour suivant l'échéance, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 €.`,
    `Si une difficulté ponctuelle empêche le règlement, contactez-moi rapidement pour convenir d'une solution.`,
  ]
  const ctaBlock = args.paymentLinkUrl ? buttonHtml('Régler en ligne', args.paymentLinkUrl) : ''
  const ibanBlock = ibanBlockHtml({
    bankName: args.bankName,
    iban: args.iban,
    bic: args.bic,
    reference: args.invoiceReference,
  })

  return sendEmail({
    to: args.to,
    subject: `Facture ${args.invoiceReference} — règlement attendu`,
    html: wrapHtml({
      bodyHtml: lines.map(paragraph).join('') + ctaBlock + ibanBlock,
      diagnosticianName: args.diagnosticianName,
      diagnosticianEmail: args.diagnosticianEmail,
    }),
    text: lines.join('\n\n'),
    category: 'transactional',
  })
}

// ──────────────────────────────────────────────────────────────────────
// 4. Mise en demeure J+30
// ──────────────────────────────────────────────────────────────────────

export async function sendReminderJ30Email(args: ReminderEmailArgs) {
  const greeting = args.recipientFirstName
    ? `Bonjour ${args.recipientFirstName},`
    : 'Bonjour,'

  const penalties = computeLatePenalties({
    unpaidAmountHt: args.amountUnpaid,
    daysLate: args.daysLate,
  })

  const lines = [
    greeting,
    `À ce jour, malgré mes précédents rappels, la facture ${args.invoiceReference} (${formatEur(args.amountUnpaid)}) reste impayée — ${args.daysLate} jours après son échéance du ${formatDateFr(args.dueDate)}.`,
    `En application de l'article L.441-10 du Code de commerce, les pénalités suivantes sont désormais exigibles :`,
    `• Intérêts de retard (taux ${penalties.ratePercent.toString().replace('.', ',')} % annuel × ${penalties.daysLate} jours) : ${formatEur(penalties.interestEur)}`,
    `• Indemnité forfaitaire de recouvrement : ${formatEur(penalties.flatFeeEur)}`,
    `• Soit un total de pénalités de ${formatEur(penalties.totalEur)} à ajouter au montant principal.`,
    `Cette présente mise en demeure vous est adressée avant engagement d'une procédure de recouvrement. Sans règlement intégral sous 8 jours, je serai contraint de saisir les voies de droit appropriées (injonction de payer, médiation, contentieux).`,
    `Je reste à votre disposition pour convenir d'un échelonnement amiable si la difficulté est temporaire.`,
    L441_10_FOOTNOTE,
  ]
  const ctaBlock = args.paymentLinkUrl ? buttonHtml('Régler immédiatement', args.paymentLinkUrl) : ''
  const ibanBlock = ibanBlockHtml({
    bankName: args.bankName,
    iban: args.iban,
    bic: args.bic,
    reference: args.invoiceReference,
  })

  return sendEmail({
    to: args.to,
    subject: `Mise en demeure — facture ${args.invoiceReference}`,
    html: wrapHtml({
      bodyHtml: lines.map(paragraph).join('') + ctaBlock + ibanBlock,
      diagnosticianName: args.diagnosticianName,
      diagnosticianEmail: args.diagnosticianEmail,
    }),
    text: lines.join('\n\n'),
    category: 'transactional',
  })
}
