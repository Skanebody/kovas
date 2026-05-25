/**
 * KOVAS — Orchestrator A1.3.4 : construit le profil unifié propriété.
 * Cache via table data.properties_unified (TTL 7 jours).
 */

import { createClient } from '@supabase/supabase-js'
import {
  type PropertyUnifiedProfile,
  computeFreshnessScore,
  fetchBan,
  fetchDpeFromAdeme,
  fetchErpFromGeorisques,
  fetchParcelleFromIGN,
  fetchTransactionsFromDVF,
} from './unified-profile'

const CACHE_TTL_MS = 7 * 24 * 3600 * 1000 // 7 jours

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

export interface BuildOptions {
  forceRefresh?: boolean
  address?: string
}

export async function buildPropertyUnifiedProfile(
  banIdOrAddress: string,
  opts: BuildOptions = {},
): Promise<PropertyUnifiedProfile | { error: string; status: number }> {
  const supabase = getServiceClient()
  const looksLikeBanId = /^[a-z0-9_-]{20,}$/i.test(banIdOrAddress)

  // 1. Géocodage ou lookup BAN
  let banId = looksLikeBanId ? banIdOrAddress : null
  let banData: Awaited<ReturnType<typeof fetchBan>> = null
  if (!banId) {
    banData = await fetchBan(opts.address ?? banIdOrAddress)
    if (!banData) return { error: 'address not found in BAN', status: 404 }
    banId = banData.id
  }

  // 2. Cache lookup
  if (!opts.forceRefresh) {
    const { data: cached } = await supabase
      .schema('data' as never)
      .from('properties_unified')
      .select('*')
      .eq('ban_id', banId)
      .maybeSingle()
    if (cached) {
      const last = new Date((cached as { last_synced_at: string }).last_synced_at).getTime()
      if (Date.now() - last < CACHE_TTL_MS) {
        return materializeProfile(cached as Record<string, unknown>, supabase)
      }
    }
  }

  // 3. Si on n'a que le ban_id, on doit récupérer lat/lng via BAN lookup inverse
  // Pour V1 : si banId fourni sans address, on tente fetchBan sur ban_id (limite)
  if (!banData) {
    banData = await fetchBan(banId)
    if (!banData) return { error: 'BAN lookup failed for given ban_id', status: 404 }
  }

  // 4. Fetch parallèle 4 sources externes
  const partialFailures: string[] = []
  const [parcelle, erpRisks, dpeHistory] = await Promise.all([
    fetchParcelleFromIGN(banData.lat, banData.lng).catch(() => null),
    fetchErpFromGeorisques(banData.lat, banData.lng).catch(() => ({
      naturels: [],
      technologiques: [],
      miniers: [],
      radon_level: null,
      seismique: null,
    })),
    fetchDpeFromAdeme(banData.lat, banData.lng).catch(() => []),
  ])
  if (!parcelle) partialFailures.push('ign_cadastre')

  // 5. Transactions DVF dépendent de la parcelle
  const transactions = parcelle
    ? await fetchTransactionsFromDVF(banData.city_insee_code, parcelle.id).catch(() => {
        partialFailures.push('dvf')
        return []
      })
    : []
  if (!parcelle) partialFailures.push('dvf')

  // 6. Diagnostiqueurs zone via RPC PostGIS
  type DiagZoneRow = {
    anonymous_id: string
    count_operations: number
    last_operation_date: string | null
  }
  const { data: diagZoneRaw } = await supabase.rpc('diagnosticians_within_radius', {
    center_lat: banData.lat,
    center_lng: banData.lng,
    radius_meters: 5000,
  })
  const diagZone: PropertyUnifiedProfile['diagnostiqueurs_zone'] = (
    (diagZoneRaw ?? []) as DiagZoneRow[]
  ).map((d) => ({
    anonymous_id: d.anonymous_id,
    count_operations_5km: Number(d.count_operations) || 0,
    last_active: d.last_operation_date,
  }))

  // 7. Build profile
  const now = new Date().toISOString()
  const sourceVersions: Record<string, string> = {
    ban: now,
    ign_cadastre: parcelle ? now : '1970-01-01T00:00:00Z',
    ademe: now,
    dvf: transactions.length > 0 ? now : '1970-01-01T00:00:00Z',
    georisques: now,
    internal: now,
  }

  const profile: PropertyUnifiedProfile = {
    ban: banData,
    parcelle,
    transactions,
    dpe_history: dpeHistory,
    erp_risks: erpRisks,
    diagnostiqueurs_zone: diagZone,
    meta: {
      last_synced_at: now,
      source_versions: sourceVersions,
      freshness_score: computeFreshnessScore(sourceVersions),
      ...(partialFailures.length > 0 ? { partial_failures: partialFailures } : {}),
    },
  }

  // 8. Persiste dans data.properties_unified (niveau 3 du data lake)
  await supabase
    .schema('data' as never)
    .from('properties_unified')
    .upsert(
      {
        ban_id: banData.id,
        parcelle_cadastre_id: parcelle?.id ?? null,
        lat: banData.lat,
        lng: banData.lng,
        postcode: banData.postcode,
        city: banData.city,
        city_insee_code: banData.city_insee_code,
        department: banData.department,
        surface_terrain_m2: parcelle?.surface_terrain_m2 ?? null,
        surface_bati_m2: parcelle?.surface_bati_m2 ?? null,
        year_built_estimated: parcelle?.year_built_estimated ?? null,
        building_type: parcelle?.building_type ?? null,
        data: { profile } as never,
        source_versions: sourceVersions as never,
        last_synced_at: now,
        freshness_score: profile.meta.freshness_score,
      } as never,
      { onConflict: 'ban_id' },
    )

  return profile
}

/** Reconstruit le profil depuis une ligne cachée en DB (lecture cache hit). */
function materializeProfile(
  row: Record<string, unknown>,
  _supabase: ReturnType<typeof getServiceClient>,
): PropertyUnifiedProfile {
  const data = (row.data as { profile?: PropertyUnifiedProfile })?.profile
  if (data) return data
  // Fallback : reconstruire depuis colonnes principales si data.profile pas hydraté
  return {
    ban: {
      id: row.ban_id as string,
      lat: Number(row.lat),
      lng: Number(row.lng),
      postcode: (row.postcode as string) ?? '',
      city: (row.city as string) ?? '',
      city_insee_code: (row.city_insee_code as string) ?? '',
      department: (row.department as string) ?? '',
    },
    parcelle: row.parcelle_cadastre_id
      ? {
          id: row.parcelle_cadastre_id as string,
          surface_terrain_m2: (row.surface_terrain_m2 as number) ?? null,
          surface_bati_m2: (row.surface_bati_m2 as number) ?? null,
          year_built_estimated: (row.year_built_estimated as number) ?? null,
          building_type: (row.building_type as string) ?? null,
        }
      : null,
    transactions: [],
    dpe_history: [],
    erp_risks: {
      naturels: [],
      technologiques: [],
      miniers: [],
      radon_level: null,
      seismique: null,
    },
    diagnostiqueurs_zone: [],
    meta: {
      last_synced_at: (row.last_synced_at as string) ?? new Date().toISOString(),
      source_versions: (row.source_versions as Record<string, string>) ?? {},
      freshness_score: (row.freshness_score as number) ?? 0,
    },
  }
}
