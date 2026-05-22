/**
 * Génération PDF (via jsPDF) de l'attestation LAFT.
 *
 * Le PDF produit est imprimable, lisible en clair et conforme à un usage en cas
 * de contrôle DGFiP. Architecture : header KOVAS + identité éditeur + identité
 * client + déclaration + 4 conditions LAFT + signature + footer.
 *
 * Note : jsPDF est déjà utilisé dans apps/web/src/lib/exports/pdf.ts (deps
 * `jspdf` déjà présent). On préfère cette dépendance à pdf-lib pour ne pas
 * alourdir le bundle.
 */

import { jsPDF } from 'jspdf'
import { formatAddressLine } from './company-identity'
import { LAFT_CONDITIONS, type LaftAttestationData, formatFrenchDate } from './laft-attestation'

const MARGIN = 50
const PAGE_WIDTH = 595 // A4 en points
const PAGE_HEIGHT = 842
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

/**
 * Génère un PDF (Buffer) de l'attestation LAFT.
 */
export function generateLaftAttestationPdf(data: LaftAttestationData): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const { client, editor, attestationNumber, issuedAt, softwareVersion, scope } = data
  const issuedFr = formatFrenchDate(issuedAt)

  let y = MARGIN

  // ============ HEADER ============
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Attestation individuelle d’éditeur de logiciel', MARGIN, y)
  y += 22

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(74, 88, 120)
  doc.text('Loi anti-fraude TVA — Article 286, I, 3° bis du Code général des impôts', MARGIN, y)
  y += 14
  doc.text(`Référence : ${attestationNumber}    Émise le : ${issuedFr}`, MARGIN, y)
  y += 8

  doc.setDrawColor(15, 30, 61)
  doc.setLineWidth(1.2)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  y += 18
  doc.setTextColor(15, 30, 61)

  // ============ 1. ÉDITEUR ============
  y = sectionTitle(doc, '1. Éditeur attestant', y)
  y = paragraph(doc, `${editor.legalForm} ${editor.legalName}`, y, { bold: true })
  y = paragraph(doc, `Capital social : ${editor.capital}`, y)
  y = paragraph(doc, `Siège social : ${formatAddressLine(editor)}`, y)
  y = paragraph(doc, `${editor.rcs}`, y)
  y = paragraph(doc, `SIREN : ${editor.siren} — SIRET : ${editor.siret}`, y)
  y = paragraph(doc, `TVA intracommunautaire : ${editor.vatNumber}`, y)
  y = paragraph(doc, `Code APE : ${editor.apeCode}`, y)
  y = paragraph(doc, `Représenté par : ${editor.representative}, Président`, y)
  y += 8

  // ============ 2. CLIENT ============
  y = sectionTitle(doc, '2. Client utilisateur du logiciel', y)
  y = paragraph(doc, client.legalName, y, { bold: true })
  if (client.siren) y = paragraph(doc, `SIREN/SIRET : ${client.siren}`, y)
  const clientAddrParts = [
    client.address,
    [client.postalCode, client.city].filter(Boolean).join(' '),
  ].filter((s): s is string => Boolean(s && s.length > 0))
  if (clientAddrParts.length > 0) {
    y = paragraph(doc, `Adresse : ${clientAddrParts.join(' — ')}`, y)
  }
  if (client.certificationN) {
    y = paragraph(doc, `Certification COFRAC : ${client.certificationN}`, y)
  }
  y = paragraph(doc, `Identifiant compte KOVAS : ${client.orgId}`, y, { mono: true })
  y += 8

  // ============ 3. LOGICIEL ============
  y = sectionTitle(doc, '3. Logiciel concerné', y)
  y = paragraph(doc, `${editor.product360} — Module Devis & Factures`, y, { bold: true })
  y = paragraph(doc, `Version logicielle attestée : ${softwareVersion}`, y)
  y = paragraph(doc, `Périmètre : ${scope}`, y)
  y = paragraph(doc, `Domaine : ${editor.domain}`, y)
  y += 8

  // ============ 4. DÉCLARATION ============
  y = ensureSpace(doc, y, 80)
  y = sectionTitle(doc, '4. Déclaration de conformité', y)
  y = paragraph(
    doc,
    `Je soussigné, ${editor.representative}, Président de ${editor.legalForm} ${editor.legalName}, éditeur du logiciel ${editor.product360}, atteste sur l’honneur que le logiciel délivré à ${client.legalName} satisfait, dans sa version ${softwareVersion} et pour le périmètre ci-dessus, aux quatre conditions cumulatives prévues à l’article 286, I, 3° bis du Code général des impôts, telles que définies par le BOI-TVA-DECLA-30-10-30 et le BOI-CF-COM-20-30-20.`,
    y,
  )
  y += 6

  // ============ 5. 4 CONDITIONS ============
  for (const c of LAFT_CONDITIONS) {
    y = ensureSpace(doc, y, 60)
    y = subsectionTitle(doc, c.title, y)
    y = paragraph(doc, `Texte légal : ${c.legal}`, y, { italic: true, mute: true })
    y = paragraph(doc, `Mise en œuvre KOVAS : ${c.kovas}`, y)
    y += 4
  }

  // ============ 6. PORTÉE ============
  y = ensureSpace(doc, y, 80)
  y = sectionTitle(doc, '6. Portée et limites', y)
  y = paragraph(
    doc,
    `La présente attestation couvre exclusivement la fonction « tenue d’un journal des opérations de caisse » au sens de l’art. 286 I 3° bis CGI, appliquée aux factures émises par ${client.legalName} via le module Devis & Factures du logiciel ${editor.product360}. Elle ne couvre pas les opérations de caisse réalisées hors du logiciel ni les éventuels paramétrages contraires à la documentation utilisateur.`,
    y,
  )
  y = paragraph(
    doc,
    'En cas d’évolution majeure du logiciel susceptible d’affecter la conformité, une nouvelle attestation est émise automatiquement et notifiée par email. La conservation incombe au client utilisateur (durée recommandée : durée du contrat + 6 ans).',
    y,
  )

  // ============ SIGNATURE ============
  y = ensureSpace(doc, y, 80)
  y += 18
  y = paragraph(doc, `Fait à ${editor.address.city}, le ${issuedFr}.`, y)
  y += 6
  y = paragraph(doc, editor.representative, y, { bold: true })
  y = paragraph(doc, `Président, ${editor.legalForm} ${editor.legalName}`, y, { mute: true })

  // ============ FOOTER (toutes pages) ============
  applyFooter(doc, attestationNumber, editor)

  const arrayBuffer = doc.output('arraybuffer')
  return new Uint8Array(arrayBuffer)
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  const next = ensureSpace(doc, y, 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 30, 61)
  doc.text(text, MARGIN, next)
  return next + 14
}

function subsectionTitle(doc: jsPDF, text: string, y: number): number {
  const next = ensureSpace(doc, y, 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 30, 61)
  doc.text(text, MARGIN, next)
  return next + 12
}

function paragraph(
  doc: jsPDF,
  text: string,
  y: number,
  opts: {
    bold?: boolean
    italic?: boolean
    mute?: boolean
    mono?: boolean
  } = {},
): number {
  const style = opts.bold ? 'bold' : opts.italic ? 'italic' : 'normal'
  doc.setFont(opts.mono ? 'courier' : 'helvetica', style)
  doc.setFontSize(opts.mute ? 9.5 : 10.5)
  doc.setTextColor(opts.mute ? 74 : 15, opts.mute ? 88 : 30, opts.mute ? 120 : 61)
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH) as string[]
  const lineHeight = opts.mute ? 12 : 13
  let cursor = ensureSpace(doc, y, lines.length * lineHeight)
  for (const line of lines) {
    doc.text(line, MARGIN, cursor)
    cursor += lineHeight
  }
  return cursor + 2
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - 80) {
    doc.addPage()
    return MARGIN
  }
  return y
}

function applyFooter(
  doc: jsPDF,
  attestationNumber: string,
  editor: LaftAttestationData['editor'],
): void {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(213, 205, 184)
    doc.setLineWidth(0.5)
    doc.line(MARGIN, PAGE_HEIGHT - 60, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 60)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(74, 88, 120)
    const line1 = `${editor.legalForm} ${editor.legalName} — Capital ${editor.capital} — ${editor.rcs}`
    const line2 = `${formatAddressLine(editor)} — SIREN ${editor.siren} — TVA ${editor.vatNumber} — APE ${editor.apeCode}`
    const line3 = `Document généré automatiquement — Réf ${attestationNumber} — ${editor.domain} — Page ${i}/${pageCount}`
    doc.text(line1, MARGIN, PAGE_HEIGHT - 48)
    doc.text(line2, MARGIN, PAGE_HEIGHT - 36)
    doc.text(line3, MARGIN, PAGE_HEIGHT - 24)
  }
}
