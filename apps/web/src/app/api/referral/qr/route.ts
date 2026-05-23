import { NextResponse } from 'next/server'
import QRCode from 'qrcode'

/**
 * Génère un QR code SVG pour une URL fournie en query string.
 *
 * Usage : `/api/referral/qr?url=https://kovas.fr/r/KOV-A4F2G`
 *
 * Sécurité :
 *   - Limite l'URL à 512 chars pour éviter les abus
 *   - Cache 1h via `Cache-Control: public, max-age=3600`
 *   - Format SVG (pas de PNG → pas de risque de payload binaire)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url || url.length > 512) {
    return new NextResponse('Missing or invalid url', { status: 400 })
  }

  // Validation : URL bien formée
  try {
    new URL(url)
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  try {
    const svg = await QRCode.toString(url, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 480,
      color: {
        dark: '#0F1419', // sidebar-bg navy
        light: '#FFFFFF',
      },
    })

    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, immutable',
      },
    })
  } catch (err) {
    return new NextResponse(
      `QR generation failed: ${err instanceof Error ? err.message : 'unknown'}`,
      { status: 500 },
    )
  }
}
