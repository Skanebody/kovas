/**
 * Génération PDF (jsPDF) du rapport mensuel Observatoire KOVAS.
 *
 * Document de référence public 6-8 pages, distribué via lead magnet sur
 * /observatoire. Sources : data agrégée par `stats-aggregator.ts` (V1 mocké,
 * V2 RPC Supabase).
 *
 * Pattern aligné sur `apps/web/src/lib/legal/laft-attestation-pdf.ts` :
 * jsPDF (déjà dans le bundle), unit pt, format A4, helpers paragraph /
 * sectionTitle / ensureSpace.
 */

import { jsPDF } from 'jspdf'
import { DIAGNOSTICS, REGIONS } from './regions-data'
import type { ObservatoireStats, TopCity } from './stats-aggregator'

const MARGIN = 50
const PAGE_WIDTH = 595 // A4 points
const PAGE_HEIGHT = 842
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

// Couleurs brand v5 (RGB) — chartreuse réservé aux accents
const COLOR_INK = { r: 15, g: 20, b: 25 } // navy-deep #0F1419
const COLOR_INK_MUTE = { r: 91, g: 112, b: 136 } // ink-mute #5B7088
const COLOR_RULE = { r: 231, g: 226, b: 210 } // rule #E7E2D2

export interface ObservatoireReportData {
  stats: ObservatoireStats
  topCities: readonly TopCity[]
}

/**
 * Génère le rapport PDF mensuel complet.
 * Retourne le buffer brut prêt pour pièce jointe Resend.
 */
export function generateObservatoireReportPdf(data: ObservatoireReportData): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const { stats, topCities } = data

  let y = MARGIN

  // ============ COUVERTURE ============
  y = renderCover(doc, stats, y)

  // ============ 1. SYNTHÈSE ============
  doc.addPage()
  y = MARGIN
  y = sectionTitle(doc, '1. Synthèse exécutive', y)
  y = paragraph(
    doc,
    `Le marché du diagnostic immobilier en France métropolitaine reste structurellement dynamique en ${stats.lastUpdatedLabel}. La part de logements vendus classés F ou G atteint ${stats.fGRate} %, un chiffre qui rappelle l’ampleur du chantier de rénovation engagé par la Loi Climat.`,
    y,
  )
  y = paragraph(
    doc,
    `Le prix médian d’un diagnostic de performance énergétique en France s’établit à ${stats.dpeMedianPrice} € TTC. Le délai médian entre la commande et la signature du rapport est de ${stats.medianDelivery} jours, soit deux fois moins qu’il y a cinq ans.`,
    y,
  )
  y = paragraph(
    doc,
    `Le volume de diagnostics réalisés sur les douze derniers mois atteint ${formatNumber(stats.totalDiagnosticsYear)} unités. Les régions Île-de-France et Provence-Alpes-Côte d’Azur concentrent à elles seules 38 % de ce volume.`,
    y,
  )
  y += 8

  // ============ 2. KPI CLÉS ============
  y = sectionTitle(doc, '2. Indicateurs clés', y)
  y = renderKpiBlock(doc, 'Part F-G en vente', `${stats.fGRate} %`, y)
  y = renderKpiBlock(doc, 'Prix médian DPE', `${stats.dpeMedianPrice} €`, y)
  y = renderKpiBlock(doc, 'Délai médian rapport', `${stats.medianDelivery} jours`, y)
  y += 8

  // ============ 3. PRIX PAR RÉGION × DIAGNOSTIC ============
  doc.addPage()
  y = MARGIN
  y = sectionTitle(doc, '3. Prix médian par région et type de diagnostic', y)
  y = paragraph(
    doc,
    'Tarifs médians TTC observés sur les douze derniers mois, agrégés à partir des plateformes de devis et des données partenaires. Les écarts régionaux reflètent à la fois le coût du foncier, la densité du tissu professionnel et les contraintes d’accès terrain.',
    y,
  )
  y = renderPriceTable(doc, y)

  // ============ 4. DISTRIBUTION ÉNERGÉTIQUE ============
  doc.addPage()
  y = MARGIN
  y = sectionTitle(doc, '4. Distribution des classes énergétiques par région', y)
  y = paragraph(
    doc,
    'Distribution en pourcentage du parc diagnostiqué sur douze mois. Les régions septentrionales (Hauts-de-France, Grand Est, Normandie) présentent les parts F-G les plus élevées, reflet d’un parc ancien plus exposé.',
    y,
  )
  y = renderEnergyTable(doc, y)

  // ============ 5. TOP 10 VILLES ============
  doc.addPage()
  y = MARGIN
  y = sectionTitle(doc, '5. Classement des villes en transition énergétique', y)
  y = paragraph(
    doc,
    'Score composite (0 à 100) calculé à partir du ratio rénovations / 1000 habitants, de la variation annuelle de la part F-G et du taux de bénéficiaires MaPrimeRénov.',
    y,
  )
  y = renderTopCitiesTable(doc, topCities, y)

  // ============ 6. MÉTHODOLOGIE ============
  doc.addPage()
  y = MARGIN
  y = sectionTitle(doc, '6. Méthodologie et sources', y)
  y = paragraph(
    doc,
    'Les indicateurs publiés dans ce rapport sont consolidés à partir de plusieurs sources : base ADEME DPE (open data), Géorisques (ERP), INSEE (population, parc de logements), agrégation anonymisée des missions traitées via la plateforme KOVAS (seuil minimum 5 missions par couple région × diagnostic).',
    y,
  )
  y = paragraph(
    doc,
    'Les prix médians sont calculés sur la médiane glissante 90 jours afin de lisser les variations saisonnières. Toute mise à jour majeure de méthodologie est signalée dans le pied de page de ce document.',
    y,
  )
  y = paragraph(
    doc,
    'Licence : CC BY 4.0. Vous pouvez librement citer, redistribuer et adapter ces données à condition de mentionner la source (« Observatoire KOVAS, kovas.fr/observatoire »).',
    y,
    { mute: true, italic: true },
  )

  // Footer toutes pages
  applyFooter(doc, stats.lastUpdatedLabel)

  return new Uint8Array(doc.output('arraybuffer'))
}

// ============================================
// Renders sections
// ============================================

function renderCover(doc: jsPDF, stats: ObservatoireStats, y: number): number {
  let cursor = y + 40

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(COLOR_INK.r, COLOR_INK.g, COLOR_INK.b)
  doc.text('Observatoire KOVAS', MARGIN, cursor)
  cursor += 24

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(18)
  doc.text('du Diagnostic Immobilier', MARGIN, cursor)
  cursor += 30

  doc.setDrawColor(COLOR_INK.r, COLOR_INK.g, COLOR_INK.b)
  doc.setLineWidth(1.2)
  doc.line(MARGIN, cursor, MARGIN + 80, cursor)
  cursor += 40

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(COLOR_INK_MUTE.r, COLOR_INK_MUTE.g, COLOR_INK_MUTE.b)
  doc.text(`Édition ${stats.lastUpdatedLabel}`, MARGIN, cursor)
  cursor += 16
  doc.text('Rapport mensuel — toutes les data publiques du marché français', MARGIN, cursor)
  cursor += 50

  // Bloc KPI hero couverture
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(48)
  doc.setTextColor(COLOR_INK.r, COLOR_INK.g, COLOR_INK.b)
  doc.text(`${stats.fGRate} %`, MARGIN, cursor + 30)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(COLOR_INK_MUTE.r, COLOR_INK_MUTE.g, COLOR_INK_MUTE.b)
  doc.text('des biens vendus classés F ou G en France', MARGIN, cursor + 48)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(48)
  doc.setTextColor(COLOR_INK.r, COLOR_INK.g, COLOR_INK.b)
  doc.text(`${stats.dpeMedianPrice} €`, MARGIN, cursor + 110)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(COLOR_INK_MUTE.r, COLOR_INK_MUTE.g, COLOR_INK_MUTE.b)
  doc.text('prix médian d’un DPE en France métropolitaine', MARGIN, cursor + 128)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(48)
  doc.setTextColor(COLOR_INK.r, COLOR_INK.g, COLOR_INK.b)
  doc.text(`${stats.medianDelivery} jours`, MARGIN, cursor + 190)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(COLOR_INK_MUTE.r, COLOR_INK_MUTE.g, COLOR_INK_MUTE.b)
  doc.text('délai médian entre demande et signature du rapport', MARGIN, cursor + 208)

  return cursor + 240
}

function renderKpiBlock(doc: jsPDF, label: string, value: string, y: number): number {
  const next = ensureSpace(doc, y, 50)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(COLOR_INK.r, COLOR_INK.g, COLOR_INK.b)
  doc.text(value, MARGIN, next + 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(COLOR_INK_MUTE.r, COLOR_INK_MUTE.g, COLOR_INK_MUTE.b)
  doc.text(label, MARGIN + 120, next + 14)
  return next + 32
}

function renderPriceTable(doc: jsPDF, y: number): number {
  const cursor = ensureSpace(doc, y, 280)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(COLOR_INK.r, COLOR_INK.g, COLOR_INK.b)

  // Header
  const colWidths = [110, 40, 40, 40, 40, 40, 40, 40, 40, 50]
  const headers = ['Région', ...DIAGNOSTICS.map((d) => d.label), 'Volume']
  let x = MARGIN
  let row = cursor + 16
  for (const [i, header] of headers.entries()) {
    doc.text(header, x, row)
    x += colWidths[i]
  }
  row += 6
  doc.setDrawColor(COLOR_RULE.r, COLOR_RULE.g, COLOR_RULE.b)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, row, PAGE_WIDTH - MARGIN, row)
  row += 12

  // Rows
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  for (const region of REGIONS) {
    if (row > PAGE_HEIGHT - 100) {
      doc.addPage()
      row = MARGIN
    }
    x = MARGIN
    doc.setTextColor(COLOR_INK.r, COLOR_INK.g, COLOR_INK.b)
    doc.text(region.name, x, row)
    x += colWidths[0]
    for (const [i, diag] of DIAGNOSTICS.entries()) {
      doc.text(`${region.prices[diag.code]} €`, x, row)
      x += colWidths[i + 1]
    }
    doc.setTextColor(COLOR_INK_MUTE.r, COLOR_INK_MUTE.g, COLOR_INK_MUTE.b)
    doc.text(formatNumber(region.diagnosticsCount), x, row)
    row += 14
  }
  return row + 8
}

function renderEnergyTable(doc: jsPDF, y: number): number {
  const cursor = ensureSpace(doc, y, 260)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(COLOR_INK.r, COLOR_INK.g, COLOR_INK.b)

  const colWidths = [150, 36, 36, 36, 36, 36, 36, 36]
  const headers = ['Région', 'A', 'B', 'C', 'D', 'E', 'F', 'G']
  let x = MARGIN
  let row = cursor + 16
  for (const [i, header] of headers.entries()) {
    doc.text(header, x, row)
    x += colWidths[i]
  }
  row += 6
  doc.setDrawColor(COLOR_RULE.r, COLOR_RULE.g, COLOR_RULE.b)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, row, PAGE_WIDTH - MARGIN, row)
  row += 12

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  for (const region of REGIONS) {
    if (row > PAGE_HEIGHT - 100) {
      doc.addPage()
      row = MARGIN
    }
    x = MARGIN
    doc.setTextColor(COLOR_INK.r, COLOR_INK.g, COLOR_INK.b)
    doc.text(region.name, x, row)
    x += colWidths[0]
    const dist = [
      region.energyDistribution.a,
      region.energyDistribution.b,
      region.energyDistribution.c,
      region.energyDistribution.d,
      region.energyDistribution.e,
      region.energyDistribution.f,
      region.energyDistribution.g,
    ]
    for (const [i, value] of dist.entries()) {
      const isFG = i >= 5
      if (isFG) {
        doc.setTextColor(217, 119, 6) // amber pour F-G
      } else {
        doc.setTextColor(COLOR_INK.r, COLOR_INK.g, COLOR_INK.b)
      }
      doc.text(`${value} %`, x, row)
      x += colWidths[i + 1]
    }
    row += 14
  }
  return row + 8
}

function renderTopCitiesTable(doc: jsPDF, cities: readonly TopCity[], y: number): number {
  const cursor = ensureSpace(doc, y, 260)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(COLOR_INK.r, COLOR_INK.g, COLOR_INK.b)

  let row = cursor + 16
  for (const city of cities) {
    if (row > PAGE_HEIGHT - 100) {
      doc.addPage()
      row = MARGIN
    }
    // Rank
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(COLOR_INK.r, COLOR_INK.g, COLOR_INK.b)
    doc.text(`#${city.rank}`, MARGIN, row)

    // Nom
    doc.setFontSize(12)
    doc.text(city.name, MARGIN + 40, row)

    // Score
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(COLOR_INK_MUTE.r, COLOR_INK_MUTE.g, COLOR_INK_MUTE.b)
    doc.text(`Score ${city.score}/100`, MARGIN + 180, row)

    // Détails
    doc.setFontSize(9)
    doc.text(
      `${city.renovRatio} rénov./1000 hab. · F-G ${city.fgYoy.toFixed(1)} %/an · MaPrimeRénov ${city.primeRenov} %`,
      MARGIN + 280,
      row,
    )

    row += 20
    doc.setDrawColor(COLOR_RULE.r, COLOR_RULE.g, COLOR_RULE.b)
    doc.setLineWidth(0.5)
    doc.line(MARGIN, row - 6, PAGE_WIDTH - MARGIN, row - 6)
  }
  return row + 8
}

// ============================================
// Helpers PDF
// ============================================

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  const next = ensureSpace(doc, y, 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(COLOR_INK.r, COLOR_INK.g, COLOR_INK.b)
  doc.text(text, MARGIN, next + 4)
  return next + 22
}

function paragraph(
  doc: jsPDF,
  text: string,
  y: number,
  opts: { mute?: boolean; italic?: boolean } = {},
): number {
  doc.setFont('helvetica', opts.italic ? 'italic' : 'normal')
  doc.setFontSize(opts.mute ? 9 : 10.5)
  if (opts.mute) {
    doc.setTextColor(COLOR_INK_MUTE.r, COLOR_INK_MUTE.g, COLOR_INK_MUTE.b)
  } else {
    doc.setTextColor(COLOR_INK.r, COLOR_INK.g, COLOR_INK.b)
  }
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH) as string[]
  const lineHeight = opts.mute ? 12 : 14
  let cursor = ensureSpace(doc, y, lines.length * lineHeight)
  for (const line of lines) {
    doc.text(line, MARGIN, cursor)
    cursor += lineHeight
  }
  return cursor + 4
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - 70) {
    doc.addPage()
    return MARGIN
  }
  return y
}

function applyFooter(doc: jsPDF, edition: string): void {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(COLOR_RULE.r, COLOR_RULE.g, COLOR_RULE.b)
    doc.setLineWidth(0.5)
    doc.line(MARGIN, PAGE_HEIGHT - 50, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 50)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(COLOR_INK_MUTE.r, COLOR_INK_MUTE.g, COLOR_INK_MUTE.b)
    doc.text(
      `Observatoire KOVAS · Édition ${edition} · kovas.fr/observatoire`,
      MARGIN,
      PAGE_HEIGHT - 36,
    )
    doc.text(`Page ${i} sur ${pageCount}`, PAGE_WIDTH - MARGIN - 60, PAGE_HEIGHT - 36)
    doc.text(
      'Données sous licence CC BY 4.0. Reproduction autorisée avec mention de la source.',
      MARGIN,
      PAGE_HEIGHT - 24,
    )
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}
