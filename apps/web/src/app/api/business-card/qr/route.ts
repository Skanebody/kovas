/**
 * GET /api/business-card/qr
 *
 * Génère un QR code de la carte de visite pour scan rapide.
 *
 * Stratégie produit : le QR encode l'URL publique `https://kovas.fr/c/<token>`
 * (pas le vCard brut). Pourquoi ?
 *   - Avec un QR vCard brut, le téléphone affiche une bannière "Ajouter aux
 *     contacts" mais sans pouvoir tracker l'usage côté KOVAS.
 *   - Avec un QR URL, on incrémente `view_count` à chaque scan, et la page
 *     publique propose elle-même les boutons "Ajouter aux contacts" /
 *     "Apple Wallet" / "Partager". UX identique pour le scanner, observable
 *     côté cabinet.
 *
 * Query params :
 *   - format : png | svg (default svg)
 *   - size   : 128 | 256 | 512 | 1024 (default 512)
 *   - logo   : true | false (default true) — superposition logo (SVG only)
 *   - token  : <public_token> pour version publique. Sinon : auth requise.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import {
  fetchLogoBase64,
  loadBusinessCardByOrg,
  loadBusinessCardByToken,
  type BusinessCardContext,
} from '@/lib/business-card/loader'
import { generateVCardQrPng, generateVCardQrSvg } from '@/lib/business-card/qr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function publicCardUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kovas.fr'
  return `${base.replace(/\/$/, '')}/c/${token}`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const format = (url.searchParams.get('format') ?? 'svg') as 'png' | 'svg'
  const sizeRaw = Number.parseInt(url.searchParams.get('size') ?? '512', 10)
  const size = [128, 256, 512, 1024].includes(sizeRaw) ? sizeRaw : 512
  const logoEnabled = url.searchParams.get('logo') !== 'false'
  const token = url.searchParams.get('token')

  let context: BusinessCardContext | null = null

  if (token) {
    const admin = createAdminClient()
    context = await loadBusinessCardByToken(admin, token)
  } else {
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
    context = await loadBusinessCardByOrg(supabase, profile.default_org_id, user.id)
  }

  if (!context) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const cardUrl = publicCardUrl(context.card.public_token)

  // Logo central (SVG only) : data URI base64.
  let logoDataUri: string | undefined
  if (logoEnabled && format === 'svg' && context.logoSignedUrl && context.logoMime) {
    const base64 = await fetchLogoBase64(context.logoSignedUrl)
    if (base64) {
      logoDataUri = `data:${context.logoMime};base64,${base64}`
    }
  }

  if (format === 'png') {
    const buf = await generateVCardQrPng(cardUrl, {
      size,
      brandColor: context.brandColorHex,
    })
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  }

  const svg = await generateVCardQrSvg(cardUrl, {
    size,
    brandColor: context.brandColorHex,
    logoDataUri,
  })
  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
