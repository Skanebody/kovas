/**
 * KOVAS — API publique : GET /api/public/v1/property/[banId]
 *
 * Profil unifié propriété (algo A1.3.4). Cross-source BAN + IGN + DVF + ADEME
 * + Géorisques + Internal. Anonymisation stricte (aucun nom diagnostiqueur).
 *
 * Rate limiting :
 *   - 60 req/min sans API key (IP-based)
 *   - 600 req/min avec X-API-Key
 * (Rate limiter à implémenter dans agent ultérieur, ici stub minimal)
 *
 * Cache : 7 jours via data.properties_unified (niveau 3 data lake).
 * Headers : Cache-Control public, max-age=604800, s-maxage=604800
 *
 * Authority : docs/refonte-2026-05/REFONTE-ACQUI-TARGET-V2.md chapitres 8+10.
 */

import { NextResponse } from 'next/server'
import { buildPropertyUnifiedProfile } from '@/lib/property/build-profile'

export const runtime = 'nodejs'
export const revalidate = 604800 // 7 jours ISR

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ banId: string }> },
) {
  const { banId } = await params
  if (!banId || banId.length < 5 || banId.length > 100) {
    return NextResponse.json({ error: 'invalid banId' }, { status: 400 })
  }

  try {
    const result = await buildPropertyUnifiedProfile(banId)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=604800, s-maxage=604800',
        'X-Source-Updated-At': result.meta.last_synced_at,
        'API-Version': '1.0',
      },
    })
  } catch (err) {
    console.error('[api/public/property] error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'internal error' },
      { status: 500 },
    )
  }
}
