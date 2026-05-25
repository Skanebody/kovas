/**
 * KOVAS — Edge Function ingest-ban-cache-daily.
 *
 * Pré-warm quotidien du cache BAN sur les adresses fréquemment consultées
 * (top 1000 missions actives + top 500 dossiers récents). Réduit la latence
 * de A1.3.4 profil unifié pour les utilisateurs récurrents.
 *
 * Cron : `0 3 * * *` (3h UTC tous les jours).
 *
 * Stratégie :
 *   1. Collecte les `address_full + address_postcode + address_city` distincts
 *      depuis `properties` modifiés < 30j (limit 1500)
 *   2. Pour chaque adresse non encore en cache : hit api-adresse + UPSERT
 *      data.properties_unified avec ban_id + lat/lng seuls (les autres sources
 *      sont gardées NULL pour être remplies au premier accès)
 *
 * Throttle 500ms (BAN tolère 50 req/s mais on reste conservatif).
 *
 * Idempotence : ON CONFLICT (ban_id) DO NOTHING (ne pas écraser les profils
 * complets déjà construits par buildPropertyUnifiedProfile).
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §10 — pré-warm data lake.
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

const ADDRESS_BATCH_LIMIT = 1500
const THROTTLE_MS = 500
const TIMEOUT_BAN_MS = 4000

interface PropertyAddressRow {
  address_full: string | null
  address_postcode: string | null
  address_city: string | null
}

interface BanLookupResult {
  ban_id: string
  lat: number
  lng: number
  postcode: string
  city: string
  city_insee_code: string
}

interface IngestStats {
  candidates: number
  unique_addresses: number
  cached_hits: number
  fresh_resolved: number
  errors: number
  duration_ms: number
}

async function fetchRecentAddresses(
  supabase: ReturnType<typeof createClient>,
): Promise<PropertyAddressRow[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const { data, error } = await (supabase as any)
    .from('properties')
    .select('address_full, address_postcode, address_city')
    .gte('updated_at', thirtyDaysAgo)
    .not('address_full', 'is', null)
    .limit(ADDRESS_BATCH_LIMIT)
  if (error) {
    console.error('[ingest-ban-cache] addresses load failed:', error.message)
    return []
  }
  return (data ?? []) as PropertyAddressRow[]
}

function dedupeAddresses(rows: PropertyAddressRow[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of rows) {
    if (!r.address_full) continue
    const composed = [r.address_full, r.address_postcode ?? '', r.address_city ?? '']
      .filter(Boolean)
      .join(' ')
      .trim()
    if (composed.length < 8 || seen.has(composed.toLowerCase())) continue
    seen.add(composed.toLowerCase())
    out.push(composed)
  }
  return out
}

async function fetchBan(address: string): Promise<BanLookupResult | null> {
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_BAN_MS) })
    if (!r.ok) return null
    const data = (await r.json()) as {
      features?: Array<{
        geometry: { coordinates: [number, number] }
        properties: {
          id: string
          postcode?: string
          city?: string
          citycode?: string
        }
      }>
    }
    const f = data.features?.[0]
    if (!f) return null
    return {
      ban_id: f.properties.id,
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      postcode: f.properties.postcode ?? '',
      city: f.properties.city ?? '',
      city_insee_code: f.properties.citycode ?? '',
    }
  } catch {
    return null
  }
}

async function isAlreadyCached(
  supabase: ReturnType<typeof createClient>,
  banId: string,
): Promise<boolean> {
  const { data } = await (supabase as any)
    .schema('data')
    .from('properties_unified')
    .select('ban_id')
    .eq('ban_id', banId)
    .maybeSingle()
  return Boolean(data)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = req.headers.get('x-cron-secret') ?? ''
  if (
    authHeader !== `Bearer ${SERVICE_ROLE_KEY}` &&
    (cronSecret === '' || cronSecret !== CRON_SECRET)
  ) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const startedAt = Date.now()
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const stats: IngestStats = {
    candidates: 0,
    unique_addresses: 0,
    cached_hits: 0,
    fresh_resolved: 0,
    errors: 0,
    duration_ms: 0,
  }

  try {
    const rows = await fetchRecentAddresses(supabase)
    stats.candidates = rows.length

    const addresses = dedupeAddresses(rows)
    stats.unique_addresses = addresses.length

    for (const address of addresses) {
      const banResult = await fetchBan(address)
      if (!banResult) {
        stats.errors += 1
        await sleep(THROTTLE_MS)
        continue
      }

      const alreadyCached = await isAlreadyCached(supabase, banResult.ban_id)
      if (alreadyCached) {
        stats.cached_hits += 1
        await sleep(THROTTLE_MS)
        continue
      }

      // Insert minimal cache row — sera complétée au prochain accès via buildPropertyUnifiedProfile
      const { error: upsertErr } = await (supabase as any)
        .schema('data')
        .from('properties_unified')
        .upsert(
          {
            ban_id: banResult.ban_id,
            ban_lat: banResult.lat,
            ban_lng: banResult.lng,
            postcode: banResult.postcode,
            city: banResult.city,
            commune_insee: banResult.city_insee_code,
            last_synced_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(), // 8j ago → forcera refresh complet au prochain accès
            source_versions: { ban: new Date().toISOString() },
            freshness_score: 0,
          },
          { onConflict: 'ban_id', ignoreDuplicates: true },
        )

      if (upsertErr) {
        console.error(`[ingest-ban-cache] upsert failed for ${address}:`, upsertErr.message)
        stats.errors += 1
      } else {
        stats.fresh_resolved += 1
      }

      await sleep(THROTTLE_MS)
    }

    stats.duration_ms = Date.now() - startedAt
    return new Response(JSON.stringify({ ok: true, stats }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    console.error('[ingest-ban-cache-daily] fatal error', err)
    stats.duration_ms = Date.now() - startedAt
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        stats,
      }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }
})
