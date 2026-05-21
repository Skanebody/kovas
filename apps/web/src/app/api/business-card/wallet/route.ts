/**
 * GET /api/business-card/wallet
 *
 * Génère un fichier `.pkpass` Apple Wallet pour la carte de visite.
 *
 * Auth requise pour le tier user (génération depuis l'app). Pour la page
 * publique `/c/<token>`, on autorise aussi `?token=...` afin que le visiteur
 * puisse ajouter le pass à son Wallet sans s'authentifier (UX cible).
 *
 * Réponses :
 *   - 200 + .pkpass : pass généré
 *   - 503 + JSON    : certificat Apple Wallet non configuré (mode dev/staging)
 *   - 404           : token inconnu / carte introuvable
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import {
  loadBusinessCardByOrg,
  loadBusinessCardByToken,
  vcfFilename,
  type BusinessCardContext,
} from '@/lib/business-card/loader'
import {
  generateWalletPass,
  isWalletPassEnabled,
} from '@/lib/business-card/wallet-pass'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isWalletPassEnabled()) {
    return NextResponse.json(
      {
        error: 'wallet_disabled',
        message:
          "L'intégration Apple Wallet n'est pas encore activée. Cette fonctionnalité sera disponible prochainement.",
      },
      { status: 503 },
    )
  }

  const url = new URL(request.url)
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

  const pkpass = await generateWalletPass(
    context.card.organization_id,
    context.vcardInput,
    context.card.public_token,
  )

  if (!pkpass) {
    // Cas théoriquement impossible (isWalletPassEnabled garde-fou en amont)
    // mais on protège contre les mauvaises configurations.
    return NextResponse.json(
      { error: 'wallet_generation_failed' },
      { status: 503 },
    )
  }

  const filename = vcfFilename(context.fullName).replace(/\.vcf$/, '.pkpass')
  return new NextResponse(new Uint8Array(pkpass), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=0, no-store',
    },
  })
}
