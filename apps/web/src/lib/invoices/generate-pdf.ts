/**
 * Génération PDF facture A4 — KOVAS Module P3.
 *
 * Stack : jsPDF (déjà installé pour les rapports diagnostics).
 * Layout : A4 portrait, font Helvetica (substitut natif jsPDF — Urbanist
 * remplacée car non-bundlée). Le PDF est volontairement sobre, lisible,
 * conforme aux mentions légales obligatoires Code Commerce L441-9.
 *
 * Mentions obligatoires couvertes :
 * - Identité émetteur (raison sociale, SIRET, TVA, adresse)
 * - Identité client + adresse
 * - Numéro facture + date émission + date d'échéance
 * - Désignation prestations + qté + PU HT + total
 * - Total HT, TVA, TTC
 * - Mention TVA non applicable / applicable
 * - Conditions paiement + date d'échéance
 * - Mention L441-10 (intérêts + indemnité 40 €)
 * - IBAN + BIC pour virement
 * - QR code SEPA (optionnel) en pied de page
 *
 * Output : Uint8Array (PDF binaire prêt à uploader Supabase Storage).
 * Server-only.
 */

import { jsPDF } from 'jspdf'
import {
  type InvoiceClientSnapshot,
  type InvoiceIssuerSnapshot,
  type InvoiceLineItem,
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
} from './types'
import { L441_10_FOOTNOTE } from './penalties'
import { generateSepaQrDataUrl } from './sepa-qr'

export type InvoiceDocumentKind = 'invoice' | 'credit_note'

export interface GenerateInvoicePdfInput {
  /** "invoice" pour facture, "credit_note" pour avoir */
  kind: InvoiceDocumentKind
  reference: string
  /** Date d'émission (YYYY-MM-DD) */
  issuedAt: string | null
  /** Date d'échéance (YYYY-MM-DD), null pour avoir */
  dueDate: string | null
  /** Délai paiement en jours (mention "Paiement à 30 jours") */
  paymentTermsDays: number
  paymentMethod: PaymentMethod | null
  notes: string | null
  lineItems: InvoiceLineItem[]
  tvaRate: number
  amountHt: number
  amountTva: number
  amountTtc: number
  issuer: InvoiceIssuerSnapshot
  client: InvoiceClientSnapshot
  /** Référence facture d'origine (uniquement pour avoir) */
  creditNoteForReference?: string | null
  /** Référence devis d'origine (optionnel) */
  quoteReference?: string | null
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

function safeText(value: string | null | undefined): string {
  return (value ?? '').toString()
}

/**
 * Génère le PDF facture sous forme d'Uint8Array.
 */
export async function generateInvoicePdf(input: GenerateInvoicePdfInput): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const pageHeight = 297
  const marginX = 18
  const colors = {
    ink: '#0F1419',
    inkMute: '#6B7280',
    accent: input.issuer.brand_color_hex ?? '#0F1419',
    rule: '#E5E7EB',
  }
  const isCreditNote = input.kind === 'credit_note'

  let y = 18

  // ──────────────────────────────────────────────────────
  // En-tête : émetteur (gauche) + titre + numéro (droite)
  // ──────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(colors.ink)
  doc.text(safeText(input.issuer.name), marginX, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(colors.inkMute)
  y += 5
  if (input.issuer.address) {
    doc.text(safeText(input.issuer.address), marginX, y)
    y += 4
  }
  const cityLine = [input.issuer.postal_code, input.issuer.city].filter(Boolean).join(' ')
  if (cityLine) {
    doc.text(cityLine, marginX, y)
    y += 4
  }
  if (input.issuer.country && input.issuer.country !== 'FR') {
    doc.text(safeText(input.issuer.country), marginX, y)
    y += 4
  }
  if (input.issuer.siret) {
    doc.text(`SIRET : ${input.issuer.siret}`, marginX, y)
    y += 4
  }
  if (input.issuer.vat_number) {
    doc.text(`TVA : ${input.issuer.vat_number}`, marginX, y)
    y += 4
  }

  // Bloc titre + numéro (aligné à droite)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(colors.accent)
  const title = isCreditNote ? 'AVOIR' : 'FACTURE'
  doc.text(title, pageWidth - marginX, 20, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(colors.ink)
  doc.text(`N° ${input.reference}`, pageWidth - marginX, 28, { align: 'right' })
  doc.setTextColor(colors.inkMute)
  doc.setFontSize(9)
  doc.text(`Date d'émission : ${formatDateFr(input.issuedAt)}`, pageWidth - marginX, 33, {
    align: 'right',
  })
  if (!isCreditNote && input.dueDate) {
    doc.text(`Date d'échéance : ${formatDateFr(input.dueDate)}`, pageWidth - marginX, 38, {
      align: 'right',
    })
  }
  if (isCreditNote && input.creditNoteForReference) {
    doc.text(
      `Annule la facture ${input.creditNoteForReference}`,
      pageWidth - marginX,
      38,
      { align: 'right' },
    )
  }
  if (input.quoteReference) {
    const yQuote = isCreditNote ? 43 : input.dueDate ? 43 : 38
    doc.text(`Devis : ${input.quoteReference}`, pageWidth - marginX, yQuote, { align: 'right' })
  }

  // ──────────────────────────────────────────────────────
  // Bloc client (à droite, plus bas)
  // ──────────────────────────────────────────────────────
  y = Math.max(y, 50) + 4
  // Séparateur
  doc.setDrawColor(colors.rule)
  doc.setLineWidth(0.2)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 8

  // Client à droite
  const clientX = pageWidth - 90
  let yClient = y
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(colors.ink)
  doc.text('Facturé à', clientX, yClient)
  yClient += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(safeText(input.client.display_name), clientX, yClient)
  yClient += 5
  doc.setFontSize(9)
  doc.setTextColor(colors.inkMute)
  if (input.client.address) {
    const addrLines = doc.splitTextToSize(safeText(input.client.address), 70) as string[]
    for (const line of addrLines) {
      doc.text(line, clientX, yClient)
      yClient += 4
    }
  }
  const clientCityLine = [input.client.postal_code, input.client.city].filter(Boolean).join(' ')
  if (clientCityLine) {
    doc.text(clientCityLine, clientX, yClient)
    yClient += 4
  }
  if (input.client.siret) {
    doc.text(`SIRET : ${input.client.siret}`, clientX, yClient)
    yClient += 4
  }
  if (input.client.email) {
    doc.text(safeText(input.client.email), clientX, yClient)
    yClient += 4
  }

  y = Math.max(y + 6, yClient) + 6

  // ──────────────────────────────────────────────────────
  // Tableau prestations
  // ──────────────────────────────────────────────────────
  doc.setDrawColor(colors.rule)
  doc.setFillColor(245, 247, 244) // sage #F5F7F4
  doc.rect(marginX, y, pageWidth - marginX * 2, 8, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(colors.ink)
  const col = {
    designation: marginX + 3,
    qty: marginX + 105,
    pu: marginX + 130,
    tva: marginX + 152,
    total: pageWidth - marginX - 3,
  }
  const yHeader = y + 5.5
  doc.text('Désignation', col.designation, yHeader)
  doc.text('Qté', col.qty, yHeader, { align: 'center' })
  doc.text('P.U. HT', col.pu, yHeader, { align: 'right' })
  doc.text('TVA', col.tva, yHeader, { align: 'right' })
  doc.text('Total HT', col.total, yHeader, { align: 'right' })

  y += 11
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(colors.ink)
  doc.setFontSize(9)

  for (const item of input.lineItems) {
    const lineHt = item.unit_price_ht * item.quantity
    // Avoir : montants négatifs visuellement
    const displayHt = isCreditNote ? -Math.abs(lineHt) : lineHt
    const displayPu = isCreditNote ? -Math.abs(item.unit_price_ht) : item.unit_price_ht

    const labelLines = doc.splitTextToSize(safeText(item.label), 95) as string[]
    const lineHeight = Math.max(5, labelLines.length * 4)

    // Saut de page si dépassement
    if (y + lineHeight > pageHeight - 70) {
      doc.addPage()
      y = 20
    }

    for (let i = 0; i < labelLines.length; i++) {
      doc.text(labelLines[i] ?? '', col.designation, y + i * 4)
    }
    doc.text(String(item.quantity), col.qty, y, { align: 'center' })
    doc.text(formatEur(displayPu), col.pu, y, { align: 'right' })
    doc.text(`${item.tva_rate.toString().replace('.', ',')} %`, col.tva, y, { align: 'right' })
    doc.text(formatEur(displayHt), col.total, y, { align: 'right' })

    y += lineHeight + 2
    doc.setDrawColor(colors.rule)
    doc.line(marginX, y - 1.5, pageWidth - marginX, y - 1.5)
  }

  // ──────────────────────────────────────────────────────
  // Totaux
  // ──────────────────────────────────────────────────────
  y += 4
  if (y > pageHeight - 80) {
    doc.addPage()
    y = 20
  }

  const totalsX = pageWidth - marginX - 70
  const valuesX = pageWidth - marginX - 3
  const sign = isCreditNote ? -1 : 1
  doc.setFontSize(10)
  doc.setTextColor(colors.inkMute)
  doc.text('Total HT', totalsX, y)
  doc.setTextColor(colors.ink)
  doc.text(formatEur(input.amountHt * sign), valuesX, y, { align: 'right' })
  y += 5
  doc.setTextColor(colors.inkMute)
  doc.text(`TVA (${input.tvaRate.toString().replace('.', ',')} %)`, totalsX, y)
  doc.setTextColor(colors.ink)
  doc.text(formatEur(input.amountTva * sign), valuesX, y, { align: 'right' })
  y += 7

  // Total TTC en gros
  doc.setDrawColor(colors.ink)
  doc.setLineWidth(0.3)
  doc.line(totalsX - 2, y - 2, valuesX + 2, y - 2)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(colors.ink)
  doc.text(isCreditNote ? 'Total à rembourser TTC' : 'Total TTC', totalsX, y + 4)
  doc.text(formatEur(input.amountTtc * sign), valuesX, y + 4, { align: 'right' })
  y += 12

  // ──────────────────────────────────────────────────────
  // Bloc paiement (facture seulement, pas avoir)
  // ──────────────────────────────────────────────────────
  if (!isCreditNote) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(colors.ink)
    doc.text('Modalités de paiement', marginX, y)
    y += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(colors.inkMute)
    doc.text(
      `Conditions : paiement à ${input.paymentTermsDays} jour${input.paymentTermsDays > 1 ? 's' : ''} — échéance le ${formatDateFr(input.dueDate)}`,
      marginX,
      y,
    )
    y += 4
    if (input.paymentMethod) {
      doc.text(
        `Mode de paiement privilégié : ${PAYMENT_METHOD_LABEL[input.paymentMethod] ?? input.paymentMethod}`,
        marginX,
        y,
      )
      y += 4
    }

    if (input.issuer.iban) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(colors.ink)
      doc.text('Virement bancaire', marginX, y + 2)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(colors.inkMute)
      if (input.issuer.bank_name) {
        doc.text(`Banque : ${input.issuer.bank_name}`, marginX, y)
        y += 4
      }
      doc.text(`IBAN : ${input.issuer.iban}`, marginX, y)
      y += 4
      if (input.issuer.bic) {
        doc.text(`BIC : ${input.issuer.bic}`, marginX, y)
        y += 4
      }
      doc.text(`Référence à indiquer : ${input.reference}`, marginX, y)
      y += 4
    }

    // QR code SEPA (si IBAN dispo)
    if (input.issuer.iban) {
      const qrDataUrl = await generateSepaQrDataUrl({
        bic: input.issuer.bic,
        beneficiaryName: input.issuer.name,
        iban: input.issuer.iban,
        amountEur: input.amountTtc,
        reference: input.reference,
        remittanceInfo: `Facture ${input.reference}`,
      })
      if (qrDataUrl) {
        const qrX = pageWidth - marginX - 35
        const qrY = y - 26
        try {
          doc.addImage(qrDataUrl, 'PNG', qrX, qrY, 30, 30)
          doc.setFontSize(7)
          doc.setTextColor(colors.inkMute)
          doc.text('Scannez pour payer', qrX + 15, qrY + 33, { align: 'center' })
        } catch {
          // Ignore — QR optionnel
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────
  // Notes libres
  // ──────────────────────────────────────────────────────
  if (input.notes) {
    y += 8
    if (y > pageHeight - 40) {
      doc.addPage()
      y = 20
    }
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(colors.inkMute)
    const notesLines = doc.splitTextToSize(safeText(input.notes), pageWidth - marginX * 2) as string[]
    for (const line of notesLines) {
      doc.text(line, marginX, y)
      y += 4
    }
  }

  // ──────────────────────────────────────────────────────
  // Pied de page — mentions légales (toujours en bas)
  // ──────────────────────────────────────────────────────
  const footerY = pageHeight - 24
  doc.setDrawColor(colors.rule)
  doc.setLineWidth(0.2)
  doc.line(marginX, footerY - 2, pageWidth - marginX, footerY - 2)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(colors.inkMute)
  if (!isCreditNote) {
    const lines = doc.splitTextToSize(L441_10_FOOTNOTE, pageWidth - marginX * 2) as string[]
    let yy = footerY
    for (const line of lines) {
      doc.text(line, marginX, yy)
      yy += 3
    }
  } else {
    doc.text(
      'Avoir émis en application de l\'article 272 du Code général des impôts.',
      marginX,
      footerY,
    )
  }

  doc.setFontSize(6)
  doc.setTextColor(170, 170, 170)
  // Doctolib network effect §17 #2 : pointer vers l'annuaire dans le footer
  // du document client. Chaque facture envoyée = une exposition de kovas.fr
  // à un particulier qui pourra découvrir d'autres diagnostiqueurs.
  doc.text(
    `Document généré avec KOVAS · Trouver un diagnostiqueur sur kovas.fr/trouver-un-diagnostiqueur · ${formatDateFr(new Date().toISOString().slice(0, 10))}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' },
  )
  doc.setTextColor(0, 0, 0)

  // jsPDF retourne ArrayBuffer en 'arraybuffer'
  const ab = doc.output('arraybuffer') as ArrayBuffer
  return new Uint8Array(ab)
}
