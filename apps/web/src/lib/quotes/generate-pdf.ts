/**
 * KOVAS — Générateur PDF d'un devis (jsPDF — server-side compatible).
 *
 * Layout sobre A4 :
 *   - Header : logo cabinet (si dispo) à gauche / cartouche réf + dates à droite
 *   - Filet horizontal couleur brand_color_hex
 *   - 2 colonnes : Émetteur (organisation) ↔ Destinataire (client snapshot)
 *   - Tableau prestations avec lignes séparées
 *   - Sous-total HT / TVA / **Total TTC** (accent visuel)
 *   - Footer : SIRET, mentions L271-4, validité
 *
 * Style :
 *   - Helvetica/sans-serif (Urbanist n'est pas embarqué dans jspdf).
 *   - Couleurs neutres dérivées de brandColorHex (filets + total TTC).
 *
 * Pas de dépendance puppeteer / @react-pdf/renderer (non installés).
 */

import { jsPDF } from 'jspdf'
import {
  type QuoteClientSnapshot,
  type QuoteLineItem,
  type QuoteOrganizationSnapshot,
  type QuotePaymentMethod,
  QUOTE_PAYMENT_METHOD_LABELS,
  computeQuoteTotals,
  formatDateLong,
  formatEur,
} from './types'

export interface QuotePdfInput {
  reference: string
  /** Date émission ISO (YYYY-MM-DD ou ISO complet). */
  issuedAt: string
  /** Date d'expiration ISO. */
  expiresAt: string
  /** Lignes du devis. */
  lines: QuoteLineItem[]
  /** Snapshot du cabinet émetteur. */
  organization: QuoteOrganizationSnapshot
  /** Snapshot du client destinataire. */
  client: QuoteClientSnapshot
  /** Notes libres (mentions complémentaires). */
  notes?: string | null
  /** Délai de paiement. */
  paymentTermsDays: number
  paymentMethod: QuotePaymentMethod
  /** Couleur primaire du cabinet `#RRGGBB`. */
  brandColorHex: string
  /**
   * Logo (PNG/JPEG en data-URL ou base64). Optionnel. SVG n'est pas
   * supporté nativement par jspdf — un SVG arrive ici en data-URL est
   * silencieusement ignoré.
   */
  logoDataUrl?: string | null
}

export interface QuotePdfBranding {
  brandColorHex: string
  logoDataUrl?: string | null
}

/**
 * Parse `#RRGGBB` → tuple RGB 0-255 (fallback navy si invalide).
 */
function hexToRgb(hex: string): [number, number, number] {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return [15, 20, 25] // navy ink
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

/**
 * Helper jsPDF — section title.
 */
function sectionTitle(doc: jsPDF, label: string, x: number, y: number): number {
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(110, 110, 110)
  doc.text(label.toUpperCase(), x, y)
  doc.setTextColor(0, 0, 0)
  return y + 14
}

/**
 * Génère le PDF en mémoire et retourne un Buffer.
 */
export function generateQuotePdf(input: QuotePdfInput): Buffer {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  const innerWidth = pageWidth - margin * 2

  const [br, bg, bb] = hexToRgb(input.brandColorHex)

  // ============================================
  // 1. Header — logo + cartouche
  // ============================================
  let y = margin

  // Logo (si dispo)
  if (input.logoDataUrl && input.logoDataUrl.startsWith('data:image/')) {
    try {
      const fmt = input.logoDataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG'
      doc.addImage(input.logoDataUrl, fmt, margin, y, 110, 40, undefined, 'FAST')
    } catch {
      // ignore logo errors — PDF reste valide sans logo
    }
  } else {
    // Pas de logo → nom cabinet en gras
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(input.organization.name, margin, y + 18)
  }

  // Cartouche droite : référence + dates
  const rightX = pageWidth - margin
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 20, 25)
  doc.text('DEVIS', rightX, y + 18, { align: 'right' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(input.reference, rightX, y + 34, { align: 'right' })
  doc.text(`Émis le ${formatDateLong(input.issuedAt)}`, rightX, y + 48, { align: 'right' })
  doc.text(`Valable jusqu'au ${formatDateLong(input.expiresAt)}`, rightX, y + 62, {
    align: 'right',
  })
  doc.setTextColor(0, 0, 0)

  y += 90

  // ============================================
  // 2. Filet horizontal couleur brand
  // ============================================
  doc.setDrawColor(br, bg, bb)
  doc.setLineWidth(2)
  doc.line(margin, y, pageWidth - margin, y)
  doc.setLineWidth(0.5)
  doc.setDrawColor(200, 200, 200)
  y += 20

  // ============================================
  // 3. Émetteur / Destinataire (2 colonnes)
  // ============================================
  const colWidth = innerWidth / 2 - 10
  const colLeftX = margin
  const colRightX = margin + innerWidth / 2 + 10

  let yLeft = y
  let yRight = y

  yLeft = sectionTitle(doc, 'Émetteur', colLeftX, yLeft)
  yLeft = drawParty(doc, colLeftX, yLeft, colWidth, {
    displayName: input.organization.name,
    address: input.organization.address,
    city: input.organization.city,
    postalCode: input.organization.postalCode,
    siret: input.organization.siret,
    vatNumber: input.organization.vatNumber,
    certificationN: input.organization.certificationN,
  })

  yRight = sectionTitle(doc, 'Destinataire', colRightX, yRight)
  yRight = drawParty(doc, colRightX, yRight, colWidth, {
    displayName: input.client.displayName,
    companyName: input.client.companyName,
    address: input.client.address,
    city: input.client.city,
    postalCode: input.client.postalCode,
    siret: input.client.siret,
    email: input.client.email,
    phone: input.client.phone,
  })

  y = Math.max(yLeft, yRight) + 20

  // ============================================
  // 4. Tableau prestations
  // ============================================
  // Header tableau
  doc.setFillColor(245, 247, 244) // sage paper
  doc.rect(margin, y, innerWidth, 24, 'F')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(80, 80, 80)
  doc.text('DÉSIGNATION', margin + 8, y + 16)
  doc.text('QTÉ', margin + innerWidth - 220, y + 16, { align: 'right' })
  doc.text('PU HT', margin + innerWidth - 130, y + 16, { align: 'right' })
  doc.text('TOTAL HT', margin + innerWidth - 8, y + 16, { align: 'right' })
  doc.setTextColor(0, 0, 0)

  y += 30

  // Lignes
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  for (const line of input.lines) {
    if (y > pageHeight - 180) {
      doc.addPage()
      y = margin
    }
    const lineHt = Math.round(line.quantity * line.unitPriceHt * 100) / 100

    // Désignation (wrap si long)
    const designationLines = doc.splitTextToSize(
      line.designation,
      innerWidth - 250,
    ) as string[]
    doc.text(designationLines, margin + 8, y)
    doc.text(String(line.quantity), margin + innerWidth - 220, y, { align: 'right' })
    doc.text(formatEur(line.unitPriceHt), margin + innerWidth - 130, y, { align: 'right' })
    doc.text(formatEur(lineHt), margin + innerWidth - 8, y, { align: 'right' })

    const lineHeight = Math.max(designationLines.length * 12, 18)
    y += lineHeight + 6

    // Séparateur fin
    doc.setDrawColor(230, 230, 230)
    doc.line(margin, y - 4, pageWidth - margin, y - 4)
  }

  y += 10

  // ============================================
  // 5. Totaux (alignés à droite)
  // ============================================
  const totals = computeQuoteTotals(input.lines)
  const totalsX = pageWidth - margin
  const totalsLabelX = pageWidth - margin - 180

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text('Sous-total HT', totalsLabelX, y, { align: 'left' })
  doc.text(formatEur(totals.subtotalHt), totalsX, y, { align: 'right' })
  y += 16

  doc.text('TVA', totalsLabelX, y, { align: 'left' })
  doc.text(formatEur(totals.totalTva), totalsX, y, { align: 'right' })
  y += 20

  // Total TTC mis en valeur (filet brand + bold)
  doc.setFillColor(br, bg, bb)
  doc.rect(totalsLabelX - 8, y - 14, 188, 26, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Total TTC', totalsLabelX, y + 2, { align: 'left' })
  doc.text(formatEur(totals.totalTtc), totalsX - 4, y + 2, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  y += 36

  // ============================================
  // 6. Conditions paiement + notes
  // ============================================
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  doc.text(
    `Conditions de paiement : ${QUOTE_PAYMENT_METHOD_LABELS[input.paymentMethod]} à ${input.paymentTermsDays} jours.`,
    margin,
    y,
  )
  y += 14

  if (input.notes && input.notes.trim().length > 0) {
    const noteLines = doc.splitTextToSize(input.notes, innerWidth) as string[]
    doc.text(noteLines, margin, y)
    y += noteLines.length * 12 + 6
  }

  // ============================================
  // 7. Footer (mentions légales)
  // ============================================
  const footerY = pageHeight - 60
  doc.setDrawColor(220, 220, 220)
  doc.line(margin, footerY - 12, pageWidth - margin, footerY - 12)

  doc.setFontSize(7)
  doc.setTextColor(140, 140, 140)
  const footerLines: string[] = []
  if (input.organization.siret) {
    footerLines.push(`SIRET : ${input.organization.siret}`)
  }
  if (input.organization.vatNumber) {
    footerLines.push(`TVA : ${input.organization.vatNumber}`)
  }
  if (input.organization.certificationN) {
    footerLines.push(`Certification : ${input.organization.certificationN}`)
  }
  footerLines.push(
    'Diagnostics immobiliers — Art. L271-4 et suivants du Code de la construction et de l\'habitation.',
  )
  footerLines.push(
    `Devis valable jusqu'au ${formatDateLong(input.expiresAt)}. Signature pour acceptation par retour email ou courrier.`,
  )
  doc.text(footerLines, margin, footerY)
  doc.setTextColor(0, 0, 0)

  return Buffer.from(doc.output('arraybuffer'))
}

/**
 * Helper interne : dessine un bloc Émetteur/Destinataire à partir d'un partial.
 * Retourne la nouvelle position y.
 */
function drawParty(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  party: {
    displayName: string
    companyName?: string | null
    address?: string | null
    city?: string | null
    postalCode?: string | null
    siret?: string | null
    vatNumber?: string | null
    certificationN?: string | null
    email?: string | null
    phone?: string | null
  },
): number {
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 20, 25)
  const nameLines = doc.splitTextToSize(party.displayName, width) as string[]
  doc.text(nameLines, x, y)
  y += nameLines.length * 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)

  if (party.companyName && party.companyName !== party.displayName) {
    doc.text(party.companyName, x, y)
    y += 12
  }
  if (party.address) {
    const addrLines = doc.splitTextToSize(party.address, width) as string[]
    doc.text(addrLines, x, y)
    y += addrLines.length * 12
  }
  const cityLine = [party.postalCode, party.city].filter(Boolean).join(' ')
  if (cityLine) {
    doc.text(cityLine, x, y)
    y += 12
  }
  if (party.email) {
    doc.text(party.email, x, y)
    y += 12
  }
  if (party.phone) {
    doc.text(party.phone, x, y)
    y += 12
  }
  if (party.siret) {
    doc.text(`SIRET : ${party.siret}`, x, y)
    y += 12
  }
  if (party.vatNumber) {
    doc.text(`TVA : ${party.vatNumber}`, x, y)
    y += 12
  }
  if (party.certificationN) {
    doc.text(`Certif. : ${party.certificationN}`, x, y)
    y += 12
  }
  doc.setTextColor(0, 0, 0)
  return y
}
