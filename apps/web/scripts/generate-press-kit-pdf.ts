import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
/**
 * KOVAS — Generation des PDF du kit media (fact-sheet + charte graphique)
 *
 * Lance ce script depuis `apps/web/` :
 *   pnpm dlx tsx scripts/generate-press-kit-pdf.ts
 *
 * Genere deux fichiers PDF dans `public/press-kit/` :
 *   - fact-sheet-kovas-mai-2026.pdf : 1 page A4 portrait, identite societe + chiffres cibles
 *   - charte-graphique-kovas.pdf : 1 page A4 portrait, palette V5 + typo + tokens
 *
 * Aucune dependance externe (jsPDF deja installe). Idempotent : ecrase les
 * fichiers existants. A relancer a chaque modification des chiffres officiels
 * (CLAUDE.md §1, §7).
 */
import { jsPDF } from 'jspdf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PRESS_KIT_DIR = resolve(__dirname, '../public/press-kit')

// Couleurs DS v5 KOVAS (RGB)
const COLOR_NAVY: [number, number, number] = [15, 20, 25]
const COLOR_INK_MUTE: [number, number, number] = [90, 96, 104]
const COLOR_SAGE_BG: [number, number, number] = [245, 247, 244]
const COLOR_CHARTREUSE: [number, number, number] = [212, 245, 66]
const COLOR_RULE: [number, number, number] = [213, 217, 211]

mkdirSync(PRESS_KIT_DIR, { recursive: true })

// ============================================================================
// 1) Fact sheet KOVAS — Mai 2026
// ============================================================================

function generateFactSheet(): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  // Fond sage pale
  doc.setFillColor(...COLOR_SAGE_BG)
  doc.rect(0, 0, 210, 297, 'F')

  // Logo bloc top
  doc.setFillColor(...COLOR_NAVY)
  doc.rect(20, 20, 60, 18, 'F')
  doc.setFillColor(...COLOR_CHARTREUSE)
  doc.circle(75, 29, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('KOVAS', 25, 33)

  // Titre fact-sheet
  doc.setTextColor(...COLOR_NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.text('Fact Sheet', 20, 60)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...COLOR_INK_MUTE)
  doc.text('Mai 2026 — version 1.0', 20, 67)

  // Section 1 — Identite legale
  doc.setDrawColor(...COLOR_RULE)
  doc.line(20, 78, 190, 78)
  doc.setTextColor(...COLOR_NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('IDENTITE LEGALE', 20, 86)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...COLOR_NAVY)
  const identityRows: Array<[string, string]> = [
    ['Editeur', 'SASU Nexus 1993'],
    ['Marque', 'KOVAS (depot INPI classes 9 + 42)'],
    ['Fondateur', 'Benjamin Bel'],
    ['Siege social', 'Paris 8e'],
    ['Direction', 'Normandie (operationnel)'],
    ['Date demarrage', 'Avril 2026'],
    ['Lancement public', 'Septembre-octobre 2026'],
    ['Domaine', 'kovas.fr'],
    ['Contact', 'contact@kovas.fr'],
  ]
  let y = 94
  for (const [label, value] of identityRows) {
    doc.setTextColor(...COLOR_INK_MUTE)
    doc.text(label, 20, y)
    doc.setTextColor(...COLOR_NAVY)
    doc.text(value, 70, y)
    y += 6
  }

  // Section 2 — Mission
  doc.setDrawColor(...COLOR_RULE)
  doc.line(20, y + 4, 190, y + 4)
  y += 12
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('MISSION', 20, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...COLOR_NAVY)
  const missionText =
    'KOVAS est une plateforme SaaS B2B dediee aux diagnostiqueurs immobiliers' +
    ' independants francais. Elle elimine la friction terrain (saisie vocale,' +
    ' photos geolocalisees, exports multi-format) et complete les logiciels' +
    ' metier existants (Liciel, OBBC, AnalysImmo, ORIS).'
  const split = doc.splitTextToSize(missionText, 170)
  doc.text(split, 20, y)
  y += split.length * 5 + 4

  // Section 3 — Cibles
  doc.setDrawColor(...COLOR_RULE)
  doc.line(20, y, 190, y)
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('CHIFFRES CIBLES', 20, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...COLOR_NAVY)
  const kpiRows: Array<[string, string]> = [
    ['Marche cible FR', '13 000 diagnostiqueurs independants'],
    ['ARR cible M24', '1 000 000 EUR'],
    ['ARR cible M36', '2 500 000 - 3 000 000 EUR'],
    ['Marge brute cible', '77 % (M12) -> 85 %+ (M36)'],
    ['Equipe', 'Solopreneur (sans levee de fonds)'],
    ['Hebergement', 'EU (Supabase Paris + Vercel EU)'],
    ['Phase 1 (M0-M9)', 'PWA compagnon a Liciel'],
    ['Phase 2 (M10-M18)', 'KOVAS Complet (cert ADEME 3CL-2021)'],
    ['Phase 3 (M19+)', 'KOVAS Augmente (IA conversationnelle metier)'],
  ]
  for (const [label, value] of kpiRows) {
    doc.setTextColor(...COLOR_INK_MUTE)
    doc.text(label, 20, y)
    doc.setTextColor(...COLOR_NAVY)
    doc.text(value, 70, y)
    y += 6
  }

  // Footer
  doc.setDrawColor(...COLOR_RULE)
  doc.line(20, 275, 190, 275)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR_INK_MUTE)
  doc.text('Document presse KOVAS — usage editorial autorise. contact@kovas.fr', 20, 282)
  doc.text('SASU Nexus 1993 — Mai 2026', 20, 287)

  const buf = Buffer.from(doc.output('arraybuffer'))
  const outPath = resolve(PRESS_KIT_DIR, 'fact-sheet-kovas-mai-2026.pdf')
  writeFileSync(outPath, buf)
  console.log(`[fact-sheet] Genere : ${outPath} (${buf.length} bytes)`)
}

// ============================================================================
// 2) Charte graphique KOVAS DS v5
// ============================================================================

function generateChartGraphique(): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  doc.setFillColor(...COLOR_SAGE_BG)
  doc.rect(0, 0, 210, 297, 'F')

  doc.setFillColor(...COLOR_NAVY)
  doc.rect(20, 20, 60, 18, 'F')
  doc.setFillColor(...COLOR_CHARTREUSE)
  doc.circle(75, 29, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('KOVAS', 25, 33)

  doc.setTextColor(...COLOR_NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.text('Charte graphique', 20, 60)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...COLOR_INK_MUTE)
  doc.text('Design System v5 — Mai 2026', 20, 67)

  // Palette
  doc.setDrawColor(...COLOR_RULE)
  doc.line(20, 78, 190, 78)
  doc.setTextColor(...COLOR_NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('PALETTE PRIMAIRE', 20, 86)

  const palette: Array<{ name: string; hex: string; rgb: [number, number, number] }> = [
    { name: 'Sage bg', hex: '#F5F7F4', rgb: [245, 247, 244] },
    { name: 'Navy ink', hex: '#0F1419', rgb: [15, 20, 25] },
    { name: 'Chartreuse accent', hex: '#D4F542', rgb: [212, 245, 66] },
    { name: 'Ink mute', hex: '#5A6068', rgb: [90, 96, 104] },
    { name: 'Rule', hex: '#D5D9D3', rgb: [213, 217, 211] },
    { name: 'Paper', hex: '#FFFFFF', rgb: [255, 255, 255] },
  ]
  let x = 20
  let y = 95
  for (const c of palette) {
    doc.setFillColor(...c.rgb)
    doc.setDrawColor(...COLOR_RULE)
    doc.rect(x, y, 25, 25, 'FD')
    doc.setTextColor(...COLOR_NAVY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(c.name, x, y + 32)
    doc.setTextColor(...COLOR_INK_MUTE)
    doc.text(c.hex, x, y + 36)
    x += 30
    if (x > 170) {
      x = 20
      y += 50
    }
  }

  // Typo
  y = 200
  doc.setDrawColor(...COLOR_RULE)
  doc.line(20, y - 5, 190, y - 5)
  doc.setTextColor(...COLOR_NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('TYPOGRAPHIE', 20, y + 3)
  y += 12

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...COLOR_NAVY)
  const fonts: Array<[string, string]> = [
    ['Urbanist 800', 'Headlines, KPI hero, marque'],
    ['Manrope 400/600', 'Body, UI, listes'],
    ['Instrument Serif italic', 'Accents editoriaux KPI'],
    ['JetBrains Mono 500', 'Chiffres, heures, codes, eyebrows'],
  ]
  for (const [font, usage] of fonts) {
    doc.setTextColor(...COLOR_NAVY)
    doc.text(font, 20, y)
    doc.setTextColor(...COLOR_INK_MUTE)
    doc.text(usage, 80, y)
    y += 6
  }

  // Principes
  y += 6
  doc.setDrawColor(...COLOR_RULE)
  doc.line(20, y, 190, y)
  doc.setTextColor(...COLOR_NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('PRINCIPES', 20, y + 8)
  y += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLOR_NAVY)
  const principles = [
    '1. Productivite B2B sobre (registre Synthex/Quora, pas fintech glass)',
    '2. Background sage pale + sidebar navy icon-only 80px',
    '3. Accent unique chartreuse (CTA, micro-highlights)',
    '4. Cards solides (glass reserve marketing landing seulement)',
    "5. Vouvoiement professionnel, jamais d'emoji marketing dans l'app",
  ]
  for (const line of principles) {
    doc.text(line, 20, y)
    y += 5
  }

  doc.setDrawColor(...COLOR_RULE)
  doc.line(20, 275, 190, 275)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR_INK_MUTE)
  doc.text('Charte graphique KOVAS DS v5 — usage editorial autorise.', 20, 282)
  doc.text('SASU Nexus 1993 — contact@kovas.fr — Mai 2026', 20, 287)

  const buf = Buffer.from(doc.output('arraybuffer'))
  const outPath = resolve(PRESS_KIT_DIR, 'charte-graphique-kovas.pdf')
  writeFileSync(outPath, buf)
  console.log(`[charte] Genere : ${outPath} (${buf.length} bytes)`)
}

// ============================================================================
// Main
// ============================================================================

generateFactSheet()
generateChartGraphique()
console.log('\nPress kit PDF generation done.')
