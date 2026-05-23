'use client'

/**
 * KOVAS — Génération côté client des documents administratifs dossier V1.
 *
 * Utilise jsPDF (déjà bundlé pour les rapports diagnostics + invoices). Le
 * rendu est volontairement minimaliste : entête KOVAS + titre + métadonnées
 * client/bien + corps placeholder. Le contenu détaillé sera livré au sprint
 * admin-docs V1.5.
 *
 * Ce module touche uniquement au DOM (download via Blob URL) : il est
 * client-only par construction.
 */

import { jsPDF } from 'jspdf'
import {
  ADMIN_DOCS,
  type AdminDocContext,
  type AdminDocKind,
  buildAdminDocBody,
  buildAdminDocFileName,
} from './admin-docs'

const MARGIN_MM = 18
const PAGE_W_MM = 210

/**
 * Génère le PDF et déclenche le téléchargement immédiat dans le navigateur.
 * Retourne le nom du fichier généré (utile pour les toasts).
 */
export function downloadAdminDoc(
  kind: AdminDocKind,
  ctx: AdminDocContext,
): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const meta = ADMIN_DOCS[kind]

  // Entête KOVAS
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 30, 61) // navy
  doc.text('KOVAS', MARGIN_MM, MARGIN_MM)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(74, 88, 120) // ink-mute
  doc.text(
    'Logiciel de diagnostic immobilier — Nexus 1993 SASU',
    MARGIN_MM,
    MARGIN_MM + 4,
  )

  // Filet séparateur
  doc.setDrawColor(213, 205, 184) // border
  doc.setLineWidth(0.3)
  doc.line(
    MARGIN_MM,
    MARGIN_MM + 7,
    PAGE_W_MM - MARGIN_MM,
    MARGIN_MM + 7,
  )

  // Titre document
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(15, 30, 61)
  doc.text(meta.fullTitle, MARGIN_MM, MARGIN_MM + 20)

  // Date d'émission
  const today = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(126, 138, 164) // ink-faint
  doc.text(`Émis le ${today}`, MARGIN_MM, MARGIN_MM + 26)

  // Corps
  const lines = buildAdminDocBody(kind, ctx)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(31, 46, 77) // ink-soft
  let cursorY = MARGIN_MM + 40
  const lineHeight = 6
  const maxW = PAGE_W_MM - MARGIN_MM * 2

  for (const raw of lines) {
    if (raw === '') {
      cursorY += lineHeight * 0.6
      continue
    }
    const wrapped = doc.splitTextToSize(raw, maxW)
    for (const seg of wrapped) {
      doc.text(seg, MARGIN_MM, cursorY)
      cursorY += lineHeight
    }
  }

  // Pied de page placeholder V1
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(126, 138, 164)
  doc.text(
    'Document V1 — modèle minimaliste. Le contenu détaillé spécifique à votre',
    MARGIN_MM,
    277,
  )
  doc.text(
    'cabinet sera livré dans une version ultérieure de KOVAS.',
    MARGIN_MM,
    281,
  )

  // Référence dossier dans le coin droit
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(74, 88, 120)
  doc.text(
    ctx.dossierReference,
    PAGE_W_MM - MARGIN_MM,
    277,
    { align: 'right' },
  )

  const fileName = buildAdminDocFileName(kind, ctx.dossierReference)
  doc.save(fileName)
  return fileName
}
