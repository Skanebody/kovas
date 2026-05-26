import type { AideResult } from '@/lib/data-gouv/mes-aides-reno'
/**
 * Génère l'annexe PDF "Aides à la rénovation énergétique" jointe aux exports
 * DPE F/G. Tonalité : sobre, professionnelle, vouvoiement, sans IA mentionnée.
 *
 * Le projet utilise jsPDF (cf. `apps/web/src/lib/exports/pdf.ts`) — on reste
 * sur la même librairie pour ne pas multiplier les dépendances.
 */
import { jsPDF } from 'jspdf'

export interface AidesAnnexeContext {
  /** Référence du dossier ou de la mission DPE (DOS-2026-00042). */
  reference: string
  /** Adresse du bien telle qu'affichée en en-tête de rapport. */
  adresse_bien: string
  /** Classe DPE constatée par le diagnostiqueur. */
  dpe_actuel: 'F' | 'G'
  /** Classe DPE projetée (par défaut C, paramétrable). */
  dpe_projete: string
  /** Liste des aides éligibles renvoyées par le simulateur France Rénov'. */
  aides: AideResult[]
  /** Horodatage de génération (ISO 8601). */
  generated_at: string
}

const MARGIN = 40
const PAGE_WIDTH = 595 // A4 portrait en pt
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

export function generateAidesAnnexePdf(ctx: AidesAnnexeContext): Buffer {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = MARGIN

  // ---------------------------------------------------------------------------
  // 1. Header
  // ---------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Annexe — Aides à la rénovation énergétique', MARGIN, y)
  y += 22

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(96)
  doc.text(`Référence DPE : ${ctx.reference}`, MARGIN, y)
  y += 13
  const wrappedAddress = doc.splitTextToSize(`Bien : ${ctx.adresse_bien}`, CONTENT_WIDTH)
  for (const line of wrappedAddress) {
    doc.text(line as string, MARGIN, y)
    y += 13
  }
  doc.setTextColor(0)
  y += 8

  // Séparateur fin
  doc.setDrawColor(213, 205, 184) // border token KOVAS
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  y += 18

  // ---------------------------------------------------------------------------
  // 2. Intro accessible
  // ---------------------------------------------------------------------------
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const intro =
    `Votre logement obtient un DPE de classe ${ctx.dpe_actuel}. Vous pouvez bénéficier ` +
    `des aides publiques ci-dessous pour le rénover et viser une classe ${ctx.dpe_projete} ` +
    'ou supérieure.'
  const wrappedIntro = doc.splitTextToSize(intro, CONTENT_WIDTH)
  for (const line of wrappedIntro) {
    doc.text(line as string, MARGIN, y)
    y += 14
  }
  y += 10

  // ---------------------------------------------------------------------------
  // 3. Tableau des aides
  // ---------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Aides éligibles', MARGIN, y)
  y += 18

  // En-tête de tableau
  const COL_AIDE_X = MARGIN
  const COL_MONTANT_X = MARGIN + 220
  const COL_CONDITIONS_X = MARGIN + 320
  const COL_CONDITIONS_WIDTH = CONTENT_WIDTH - 320

  doc.setFontSize(9)
  doc.setTextColor(96)
  doc.text('Aide', COL_AIDE_X, y)
  doc.text('Montant estimé', COL_MONTANT_X, y)
  doc.text('Conditions principales', COL_CONDITIONS_X, y)
  doc.setTextColor(0)
  y += 6
  doc.setDrawColor(213, 205, 184)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  y += 12

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  let total = 0
  for (const aide of ctx.aides) {
    // Saut de page si on déborde
    if (y > 720) {
      doc.addPage()
      y = MARGIN
    }
    total += aide.montant_eur

    // Label aide (bold)
    doc.setFont('helvetica', 'bold')
    const wrappedLabel = doc.splitTextToSize(aide.label, 200)
    let labelY = y
    for (const line of wrappedLabel) {
      doc.text(line as string, COL_AIDE_X, labelY)
      labelY += 12
    }

    // Montant
    doc.setFont('helvetica', 'bold')
    doc.text(formatEur(aide.montant_eur), COL_MONTANT_X, y)

    // Conditions (multi-lignes)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const conditionsText = aide.conditions.map((c) => `• ${c}`).join('\n')
    const wrappedConditions = doc.splitTextToSize(conditionsText, COL_CONDITIONS_WIDTH)
    let conditionsY = y
    for (const line of wrappedConditions) {
      doc.text(line as string, COL_CONDITIONS_X, conditionsY)
      conditionsY += 11
    }
    doc.setFontSize(10)

    // Bloc complet : on prend le max des hauteurs
    const labelHeight = labelY - y
    const conditionsHeight = conditionsY - y
    y += Math.max(labelHeight, conditionsHeight, 22) + 6

    // Séparateur léger entre aides
    doc.setDrawColor(229, 222, 203)
    doc.line(MARGIN, y - 3, PAGE_WIDTH - MARGIN, y - 3)
    y += 4
  }

  // ---------------------------------------------------------------------------
  // 4. Total + mention "sous réserve"
  // ---------------------------------------------------------------------------
  if (y > 700) {
    doc.addPage()
    y = MARGIN
  }
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(`Total estimé : ${formatEur(roundHundred(total))}`, MARGIN, y)
  y += 20

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(96)
  const reserve =
    "Sous réserve d'éligibilité et de validation par France Rénov'. Les montants " +
    'ci-dessus sont des ordres de grandeur calculés à partir du simulateur officiel.'
  const wrappedReserve = doc.splitTextToSize(reserve, CONTENT_WIDTH)
  for (const line of wrappedReserve) {
    doc.text(line as string, MARGIN, y)
    y += 12
  }
  doc.setTextColor(0)
  y += 16

  // ---------------------------------------------------------------------------
  // 5. Mention légale
  // ---------------------------------------------------------------------------
  if (y > 700) {
    doc.addPage()
    y = MARGIN
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Bon à savoir', MARGIN, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const mention =
    "Cette annexe est informative. KOVAS ne traite pas les dossiers d'aide. Pour la " +
    "constitution du dossier officiel et l'évaluation précise de vos droits, vous êtes " +
    "invité à contacter un conseiller France Rénov' (0 808 800 700 ou france-renov.gouv.fr)."
  const wrappedMention = doc.splitTextToSize(mention, CONTENT_WIDTH)
  for (const line of wrappedMention) {
    doc.text(line as string, MARGIN, y)
    y += 12
  }

  // ---------------------------------------------------------------------------
  // 6. Footer (sur la dernière page seulement, on garde simple)
  // ---------------------------------------------------------------------------
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(128)
    const footer = `Données issues du simulateur officiel France Rénov' — mesaidesreno.beta.gouv.fr — généré le ${formatDate(ctx.generated_at)}`
    doc.text(footer, MARGIN, doc.internal.pageSize.getHeight() - 24)
    doc.setTextColor(0)
  }

  return Buffer.from(doc.output('arraybuffer'))
}

function formatEur(amount: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} €`
}

function roundHundred(n: number): number {
  return Math.round(n / 100) * 100
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR')
  } catch {
    return iso.split('T')[0] ?? iso
  }
}
