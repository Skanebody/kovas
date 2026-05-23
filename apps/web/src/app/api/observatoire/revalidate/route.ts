/**
 * POST /api/observatoire/revalidate
 *
 * Webhook appelé par l'Edge Function `observatoire-stats-refresh` après un
 * refresh réussi. Invalide le cache ISR des pages :
 *   - /observatoire
 *   - /observatoire/rapports
 *
 * Protection : Bearer token `OBSERVATOIRE_REVALIDATE_TOKEN`.
 *
 * Aussi appelable manuellement par l'admin via la page
 * /admin/observatoire/refresh (bouton "Régénérer maintenant").
 */

import { revalidatePath } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.OBSERVATOIRE_REVALIDATE_TOKEN
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'OBSERVATOIRE_REVALIDATE_TOKEN non configuré côté serveur' },
      { status: 500 },
    )
  }

  const auth = req.headers.get('authorization') ?? ''
  const provided = auth.replace(/^Bearer\s+/i, '').trim()
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let source = 'unknown'
  try {
    const body = (await req.json().catch(() => ({}))) as { source?: string }
    if (typeof body?.source === 'string') source = body.source
  } catch {
    // body optionnel
  }

  revalidatePath('/observatoire')
  revalidatePath('/observatoire/rapports')

  return NextResponse.json({
    ok: true,
    revalidated: ['/observatoire', '/observatoire/rapports'],
    source,
    at: new Date().toISOString(),
  })
}
