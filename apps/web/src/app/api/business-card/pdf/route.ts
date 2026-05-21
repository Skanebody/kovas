/**
 * GET /api/business-card/pdf
 *
 * Génère un PDF A4 imprimable avec la carte de visite (format CR80 : 85×54 mm).
 *   - Recto : nom + cabinet + titre + tel + email + web + adresse
 *   - Verso : QR code + KOVAS sobre footer
 *   - 10 cartes par page A4 (2 colonnes × 5 lignes), repères de découpe
 *
 * Auth requise (page d'édition cabinet). Pas d'accès public (téléchargement
 * de PDF imprimable = action du diagnostiqueur uniquement).
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  fetchLogoBase64,
  loadBusinessCardByOrg,
  vcfFilename,
} from '@/lib/business-card/loader'
import { generateVCardQrPng } from '@/lib/business-card/qr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Conversions mm → points PDF (1 mm = 2.834645 pt)
const MM = 2.834645
const A4_WIDTH = 210 * MM
const A4_HEIGHT = 297 * MM
const CARD_W = 85 * MM
const CARD_H = 54 * MM

// Layout : 2 colonnes × 5 lignes centrées avec marges égales.
const COLS = 2
const ROWS = 5
const TOTAL_W = COLS * CARD_W
const TOTAL_H = ROWS * CARD_H
const MARGIN_X = (A4_WIDTH - TOTAL_W) / 2
const MARGIN_Y = (A4_HEIGHT - TOTAL_H) / 2

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/.exec(hex)
  if (!m) return { r: 0.06, g: 0.08, b: 0.1 } // #0F1419
  return {
    r: Number.parseInt(m[1]!, 16) / 255,
    g: Number.parseInt(m[2]!, 16) / 255,
    b: Number.parseInt(m[3]!, 16) / 255,
  }
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('default_org_id')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.default_org_id) {
    return NextResponse.json({ error: 'no_org' }, { status: 400 })
  }

  const context = await loadBusinessCardByOrg(supabase, profile.default_org_id, user.id)
  if (!context) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // QR PNG haute résolution (1024) pour impression nette à 54 mm × 54 mm.
  const cardUrl = `${(process.env.NEXT_PUBLIC_APP_URL ?? 'https://kovas.fr').replace(/\/$/, '')}/c/${context.card.public_token}`
  const qrPng = await import('@/lib/business-card/qr').then((m) =>
    m.generateVCardQrPng(cardUrl, {
      size: 1024,
      brandColor: context.brandColorHex,
    }),
  )
  // (Ré-import volontaire pour avoir le buffer dès la résolution — `generateVCardQrPng`
  // est déjà importée plus bas, on évite le dup en utilisant l'import statique.)
  void generateVCardQrPng

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([A4_WIDTH, A4_HEIGHT])

  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique)
  const qrImage = await pdf.embedPng(qrPng)

  // Logo embed optionnel
  let logoImage: Awaited<ReturnType<typeof pdf.embedPng>> | null = null
  if (context.logoSignedUrl && context.logoMime) {
    const base64 = await fetchLogoBase64(context.logoSignedUrl)
    if (base64) {
      const buf = Buffer.from(base64, 'base64')
      try {
        logoImage =
          context.logoMime === 'image/jpeg'
            ? await pdf.embedJpg(buf)
            : await pdf.embedPng(buf)
      } catch {
        logoImage = null
      }
    }
  }

  const brand = hexToRgb(context.brandColorHex)
  const ink = rgb(0.06, 0.08, 0.1) // #0F1419
  const inkMute = rgb(0.4, 0.42, 0.45)
  const cutColor = rgb(0.75, 0.78, 0.74) // sage discret

  const v = context.vcardInput
  // Recto / Verso alternés en damier : col 0 = recto, col 1 = verso de la
  // carte précédente. Pour simplifier l'impression A4, on dispose 5 paires
  // recto-verso (10 cartes physiques = 5 × CR80 face + 5 × dos).
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = MARGIN_X + col * CARD_W
      // PDF origin = bas-gauche
      const y = A4_HEIGHT - MARGIN_Y - (row + 1) * CARD_H

      // Repères de découpe (4 traits courts dans les coins, hors zone bleed)
      const tickLen = 3 * MM
      page.drawLine({
        start: { x: x - tickLen, y },
        end: { x, y },
        thickness: 0.3,
        color: cutColor,
      })
      page.drawLine({
        start: { x, y: y - tickLen },
        end: { x, y },
        thickness: 0.3,
        color: cutColor,
      })
      page.drawLine({
        start: { x: x + CARD_W, y },
        end: { x: x + CARD_W + tickLen, y },
        thickness: 0.3,
        color: cutColor,
      })
      page.drawLine({
        start: { x: x + CARD_W, y: y - tickLen },
        end: { x: x + CARD_W, y },
        thickness: 0.3,
        color: cutColor,
      })

      if (col === 0) {
        // RECTO — infos texte
        const padX = 5 * MM
        const padTop = 6 * MM
        let cursorY = y + CARD_H - padTop

        // Logo + cabinet en haut
        if (logoImage) {
          const lh = 10 * MM
          const ratio = logoImage.width / logoImage.height
          const lw = lh * ratio
          page.drawImage(logoImage, {
            x: x + padX,
            y: cursorY - lh,
            width: Math.min(lw, 22 * MM),
            height: lh,
          })
          cursorY -= lh + 1 * MM
        }

        // Cabinet
        page.drawText(truncate(v.organization, 32), {
          x: x + padX,
          y: cursorY - 3 * MM,
          size: 8,
          font: fontBold,
          color: ink,
        })
        cursorY -= 5 * MM

        // Nom (typo italic mock — Helvetica Oblique = la plus proche dans
        // les polices standard PDF, sans embed font custom).
        page.drawText(`${v.firstName} ${v.lastName}`, {
          x: x + padX,
          y: cursorY - 5 * MM,
          size: 13,
          font: fontItalic,
          color: rgb(brand.r, brand.g, brand.b),
        })
        cursorY -= 7 * MM

        // Titre
        if (v.title) {
          page.drawText(truncate(v.title, 42), {
            x: x + padX,
            y: cursorY - 3 * MM,
            size: 7,
            font,
            color: inkMute,
          })
          cursorY -= 5 * MM
        }

        // Infos contact bas de carte
        const contactBottomY = y + 6 * MM
        let infoY = contactBottomY + 8 * MM
        const drawInfo = (label: string, value: string | undefined) => {
          if (!value) return
          page.drawText(value, {
            x: x + padX,
            y: infoY,
            size: 7,
            font,
            color: ink,
          })
          page.drawText(label, {
            x: x + padX,
            y: infoY + 2.5 * MM,
            size: 5,
            font,
            color: inkMute,
          })
          infoY -= 5 * MM
        }
        drawInfo('TÉL.', v.phoneMobile)
        drawInfo('EMAIL', v.emailWork)
        drawInfo('WEB', v.website)
      } else {
        // VERSO — QR centré + footer
        const qrSize = 36 * MM
        const qx = x + (CARD_W - qrSize) / 2
        const qy = y + (CARD_H - qrSize) / 2 + 3 * MM
        page.drawImage(qrImage, { x: qx, y: qy, width: qrSize, height: qrSize })
        page.drawText('Scanner pour ajouter aux contacts', {
          x: x + 6 * MM,
          y: y + 4 * MM,
          size: 6,
          font,
          color: inkMute,
        })
      }
    }
  }

  const bytes = await pdf.save()
  const filename = vcfFilename(context.fullName).replace(/\.vcf$/, '-cartes.pdf')

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=0, no-store',
    },
  })
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return `${s.slice(0, n - 1)}…`
}
