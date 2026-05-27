/**
 * KOVAS — GET /api/ademe/dpe/historique
 *
 * Renvoie le cache local des DPE rapatriés (table `ademe_dpe_cache`) pour
 * affichage carte de France + listings. Query string :
 *   ?limit=500 (défaut)
 *   ?since=YYYY-MM-DD (optionnel)
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface AdemeDpeCacheRow {
  id: string
  organization_id: string
  numero_dpe: string
  date_etablissement_dpe: string | null
  etiquette_dpe: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
  etiquette_ges: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
  latitude: number | null
  longitude: number | null
  code_postal: string | null
  commune: string | null
  surface_habitable: number | null
  type_batiment: string | null
  conso_5_usages_par_m2_ep: number | null
  emission_ges_5_usages_par_m2: number | null
  synced_at: string
}

export async function GET(request: Request) {
  const { orgId, supabase } = await getCurrentUser()

  const url = new URL(request.url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 500), 2000)
  const since = url.searchParams.get('since')

  // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore régénérés
  let query = supabase
    .from('ademe_dpe_cache' as any)
    .select('*')
    .eq('organization_id', orgId)

  if (since) query = query.gte('date_etablissement_dpe', since)

  const { data, error, count } = await query
    .order('date_etablissement_dpe', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load DPE cache', detail: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({
    dpe: (data ?? []) as unknown as AdemeDpeCacheRow[],
    count: count ?? data?.length ?? 0,
  })
}
