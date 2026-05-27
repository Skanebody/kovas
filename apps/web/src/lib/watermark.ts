/**
 * Utilitaires watermark "Essai KOVAS" — Protection 4 anti-abus.
 * Cf. docs/trial-protection.md §5
 *
 * V1 sprint J3.5 : signatures + tests unitaires sur strings.
 * Implémentation réelle PDF/DOCX : J11-J12 (module exports).
 */

export const WATERMARK_TEXT = 'Document généré en essai KOVAS — kovas.fr'
export const WATERMARK_CSV_PREFIX = '# Essai KOVAS — kovas.fr'

/**
 * Ajoute une ligne de header watermark à un export CSV.
 */
export function applyCsvWatermarkLine(csv: string, missionReference: string): string {
  const today = new Date().toISOString().split('T')[0]
  const watermark = `${WATERMARK_CSV_PREFIX} — Mission ${missionReference} — Export ${today}\n`
  return watermark + csv
}

/**
 * Injecte le watermark dans le XML Liciel (LIV_administratif.xml).
 * Le champ <notes_administratives> est visible dans Liciel après import.
 */
export function applyZipLicielWatermark(xmlContent: string): string {
  const watermarkNode =
    '<notes_administratives>Mission générée via essai KOVAS — kovas.fr</notes_administratives>'

  // Si la balise existe déjà, remplacer son contenu
  if (xmlContent.includes('<notes_administratives>')) {
    return xmlContent.replace(
      /<notes_administratives>[^<]*<\/notes_administratives>/,
      watermarkNode,
    )
  }

  // Sinon, l'ajouter avant </document>
  return xmlContent.replace('</document>', `  ${watermarkNode}\n</document>`)
}

/**
 * Ajoute le watermark dans un PDF buffer (stub — implémentation J11-J12).
 * Utilisera pdf-lib ou @react-pdf/renderer pour le rendu réel.
 */
export async function applyPdfWatermark(
  _pdfBuffer: Buffer,
  _options?: { fontSize?: number; color?: string },
): Promise<Buffer> {
  throw new Error(
    'applyPdfWatermark: stub V1. Implémentation J11-J12 via pdf-lib (footer chaque page).',
  )
}

/**
 * Ajoute le watermark dans un DOCX buffer (stub — implémentation J11-J12).
 */
export async function applyDocxWatermark(_docxBuffer: Buffer): Promise<Buffer> {
  throw new Error('applyDocxWatermark: stub V1. Implémentation J11-J12 via docx (header section).')
}

/**
 * Détermine si le watermark doit être appliqué pour un user donné.
 * Watermark = trial actif ET non converti.
 */
export interface WatermarkContext {
  isTrial: boolean
  converted: boolean
}

export function shouldApplyWatermark(ctx: WatermarkContext): boolean {
  return ctx.isTrial && !ctx.converted
}
