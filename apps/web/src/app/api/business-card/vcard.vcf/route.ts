/**
 * GET /api/business-card/vcard.vcf
 *
 * Retourne le fichier .vcf de la carte de visite :
 *   - Authentifié (sans query) → carte du user courant
 *   - Public (?token=<public_token>) → lecture sans auth via service-role
 *
 * Incrémente `scan_count` à chaque téléchargement (utile pour la stat affichée
 * dans l'UI cabinet).
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import {
  fetchLogoBase64,
  loadBusinessCardByOrg,
  loadBusinessCardByToken,
  vcfFilename,
  type BusinessCardContext,
} from '@/lib/business-card/loader'
import { buildVCard } from '@/lib/business-card/vcard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  let context: BusinessCardContext | null = null

  if (token) {
    // Accès public — service-role pour bypass RLS, on incrémente scan_count.
    const admin = createAdminClient()
    context = await loadBusinessCardByToken(admin, token)
    if (!context) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    await incrementCounter(admin, 'scan_count', context.card.organization_id)
  } else {
    // Accès authentifié.
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
    if (!context) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
  }

  // Logo embedded (best-effort, échec silencieux si trop gros).
  let logoBase64: string | undefined
  if (context.logoSignedUrl && context.logoMime) {
    const fetched = await fetchLogoBase64(context.logoSignedUrl)
    if (fetched) logoBase64 = fetched
  }

  const vcardText = buildVCard({
    ...context.vcardInput,
    logoBase64,
    logoMime: logoBase64 ? context.logoMime ?? undefined : undefined,
  })

  const filename = vcfFilename(context.fullName)

  return new NextResponse(vcardText, {
    status: 200,
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=0, no-store',
    },
  })
}

/**
 * Incrément RPC-less : SELECT + UPDATE en deux temps (race condition tolérée
 * — stat best-effort). Si la table grandit, on remplacera par une RPC SQL.
 */
async function incrementCounter(
  // biome-ignore lint/suspicious/noExplicitAny: minimal cast pour bypass types
  admin: any,
  column: 'view_count' | 'scan_count',
  organizationId: string,
): Promise<void> {
  try {
    const { data: row } = await admin
      .from('business_cards')
      .select(column)
      .eq('organization_id', organizationId)
      .maybeSingle()
    const current = (row as Record<string, number> | null)?.[column] ?? 0
    await admin
      .from('business_cards')
      .update({ [column]: current + 1 })
      .eq('organization_id', organizationId)
  } catch {
    // Stats anonymes : best-effort, on n'échoue jamais à cause d'une stat.
  }
}
