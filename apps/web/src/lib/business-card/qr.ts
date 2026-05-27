/**
 * KOVAS — Générateur QR code pour cartes de visite vCard.
 *
 * Utilise la lib `qrcode` (déjà installée dans apps/web).
 *
 * Choix d'implémentation :
 *   - Niveau de correction d'erreur **H (30%)** : permet de superposer un logo
 *     central sans casser la scannabilité (jusqu'à 20% de la surface masquée).
 *   - Couleur sombre = `brandColorHex` de l'org (défaut #0F1419). Le fond reste
 *     blanc pour ne JAMAIS perdre le contraste.
 *   - On accepte le brand color mais on **clampe** vers `#0F1419` si la
 *     luminosité relative > 60% (le QR doit toujours être bien plus sombre
 *     que le fond blanc pour scanner sur n'importe quel appareil).
 *   - Format SVG privilégié (vectoriel, parfait pour impression A4 + cartes
 *     85×54 mm). PNG en option pour le partage web/social.
 *
 * Le logo central est composé en SVG (overlay vectoriel) — on évite ainsi
 * toute dépendance native (sharp / canvas) côté Vercel.
 */

import QRCode from 'qrcode'

const DEFAULT_DARK = '#0F1419'
const DEFAULT_LIGHT = '#FFFFFF'

interface QrOptions {
  /** Taille en pixels pour PNG, ou taille du viewBox pour SVG (default 512). */
  size?: number
  /** Couleur sombre hex (#RRGGBB). Clampée vers `#0F1419` si trop claire. */
  brandColor?: string
  /**
   * Si fourni, superpose un logo central. Pour SVG : data URI ou URL absolue.
   * Pour PNG : on désactive l'overlay logo (composition canvas-server pas
   * incluse en V1 — l'overlay logo n'est dispo qu'en SVG).
   */
  logoDataUri?: string
}

/**
 * Calcule la luminosité relative WCAG d'une couleur hex.
 * Retourne un float 0..1.
 */
function relativeLuminance(hex: string): number {
  const m = /^#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/.exec(hex)
  if (!m) return 0
  const channels = [m[1], m[2], m[3]].map((h) => {
    const c = Number.parseInt(h ?? '00', 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/**
 * Garantit une couleur QR scannable : si la couleur fournie est trop claire
 * (luminance > 0.6), on retombe sur le noir KOVAS pour préserver le contraste.
 */
function safeQrDarkColor(brandColor?: string): string {
  if (!brandColor) return DEFAULT_DARK
  if (!/^#[0-9A-Fa-f]{6}$/.test(brandColor)) return DEFAULT_DARK
  if (relativeLuminance(brandColor) > 0.6) return DEFAULT_DARK
  return brandColor.toUpperCase()
}

/**
 * Génère un QR code en PNG (Buffer). Pas d'overlay logo (V1).
 */
export async function generateVCardQrPng(
  vcardText: string,
  options: QrOptions = {},
): Promise<Buffer> {
  const size = options.size ?? 512
  const dark = safeQrDarkColor(options.brandColor)
  return QRCode.toBuffer(vcardText, {
    type: 'png',
    errorCorrectionLevel: 'H',
    width: size,
    margin: 2,
    color: { dark, light: DEFAULT_LIGHT },
  })
}

/**
 * Génère un QR code en SVG (string). Si `logoDataUri` est fourni, superpose
 * un disque blanc + logo centré occupant ~20% de la surface (sous le seuil
 * de tolérance correction H).
 */
export async function generateVCardQrSvg(
  vcardText: string,
  options: QrOptions = {},
): Promise<string> {
  const size = options.size ?? 512
  const dark = safeQrDarkColor(options.brandColor)
  const svgRaw = await QRCode.toString(vcardText, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    width: size,
    margin: 2,
    color: { dark, light: DEFAULT_LIGHT },
  })

  if (!options.logoDataUri) return svgRaw

  // qrcode SVG output : <svg viewBox="0 0 N N" ...>...</svg>
  // On extrait le viewBox pour positionner le logo proportionnellement.
  const viewBoxMatch = /viewBox="0 0 (\d+) (\d+)"/.exec(svgRaw)
  if (!viewBoxMatch) return svgRaw
  const vbWidth = Number.parseInt(viewBoxMatch[1]!, 10)
  const vbHeight = Number.parseInt(viewBoxMatch[2]!, 10)

  // Logo = 22% de la largeur (carré centré). Carré blanc de fond pour
  // garantir la lisibilité même sur un module noir.
  const logoSize = Math.round(vbWidth * 0.22)
  const logoX = Math.round((vbWidth - logoSize) / 2)
  const logoY = Math.round((vbHeight - logoSize) / 2)
  // Marge blanche autour du logo (4% de la largeur).
  const padding = Math.round(vbWidth * 0.04)
  const bgSize = logoSize + padding * 2
  const bgX = logoX - padding
  const bgY = logoY - padding

  // Sanitize : `logoDataUri` doit être une data URI (image/png|jpeg|svg+xml) ou
  // une URL https. On refuse tout javascript: ou autre.
  const isSafe =
    /^data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(options.logoDataUri) ||
    /^https:\/\//.test(options.logoDataUri)
  if (!isSafe) return svgRaw

  const overlay =
    `<rect x="${bgX}" y="${bgY}" width="${bgSize}" height="${bgSize}" rx="4" fill="${DEFAULT_LIGHT}"/>` +
    `<image href="${options.logoDataUri}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`

  // On injecte juste avant la fermeture </svg>.
  return svgRaw.replace('</svg>', `${overlay}</svg>`)
}
