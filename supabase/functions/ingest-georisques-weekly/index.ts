/**
 * KOVAS — Edge Function ingest-georisques-weekly.
 *
 * Pré-warm hebdomadaire de `data.properties_erp_risks` sur les centroïdes des
 * top 500 communes (par volume de transactions DVF). Permet à l'algo A1.3.4
 * (profil unifié) de servir < 200ms quand un utilisateur arrive sur une zone
 * dense, sans hit live l'API Géorisques (qui est lente : 1-3s par appel).
 *
 * Cron : `0 4 * * 1` (lundi 4h UTC).
 *
 * Stratégie :
 *   1. Charge les top 500 INSEE codes triés par `total_transactions_12m` DESC
 *      (matview analytics.transactions_history_by_commune)
 *   2. Pour chaque commune : récupère le centroïde via fetch BAN
 *      (https://api-adresse.data.gouv.fr/search/?q={city}&type=municipality)
 *   3. Hit Géorisques /synthese?latlon=lng,lat
 *   4. UPSERT dans data.properties_erp_risks (clé = ban_id du centroïde)
 *
 * Throttle 1.5s entre appels (Géorisques rate-limit non documenté, prudent).
 * Volume estimé : 500 communes × 1.5s = ~12.5 min de cron hebdo.
 *
 * Idempotence : UPSERT avec ON CONFLICT (ban_id) DO UPDATE.
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §10 — pré-warm data lake.
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

const TOP_COMMUNES_LIMIT = 500
const THROTTLE_MS = 1500
const TIMEOUT_BAN_MS = 5000
const TIMEOUT_GEORISQUES_MS = 8000

interface CommuneRow {
  commune_insee: string
}

interface BanCentroid {
  ban_id: string
  lat: number
  lng: number
}

interface GeorisquesRisks {
  naturels: string[]
  technologiques: string[]
  miniers: string[]
  radon_level: number | null
  seismique: string | null
}

interface IngestStats {
  total_communes: number
  centroids_resolved: number
  georisques_fetched: number
  upserts: number
  errors: number
  duration_ms: number
}

async function fetchTopCommunes(supabase: ReturnType<typeof createClient>): Promise<CommuneRow[]> {
  const { data, error } = await (supabase as any)
    .schema('analytics')
    .from('transactions_history_by_commune')
    .select('commune_insee')
    .order('total_transactions_12m', { ascending: false })
    .limit(TOP_COMMUNES_LIMIT)
  if (error) {
    console.error('[ingest-georisques] top communes load failed:', error.message)
    return []
  }
  return ((data ?? []) as CommuneRow[]).filter((r) => r.commune_insee)
}

async function fetchBanCentroid(insee: string): Promise<BanCentroid | null> {
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(insee)}&type=municipality&limit=1`
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_BAN_MS) })
    if (!r.ok) return null
    const data = (await r.json()) as {
      features?: Array<{
        geometry: { coordinates: [number, number] }
        properties: { citycode?: string; id: string }
      }>
    }
    const f = data.features?.[0]
    if (!f) return null
    return {
      ban_id: f.properties.id ?? insee,
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }
  } catch {
    return null
  }
}

async function fetchGeorisques(lat: number, lng: number): Promise<GeorisquesRisks | null> {
  try {
    const url = `https://www.georisques.gouv.fr/api/v1/risques/synthese?latlon=${lng},${lat}`
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_GEORISQUES_MS) })
    if (!r.ok) return null
    const data = (await r.json()) as {
      risques?: {
        naturels?: Array<string | { libelle: string }>
        technologiques?: Array<string | { libelle: string }>
        miniers?: Array<string | { libelle: string }>
      }
      radon?: { niveau?: number }
      sismique?: { zone?: string }
    }
    const norm = (arr?: Array<string | { libelle: string }>): string[] =>
      (arr ?? []).map((x) => (typeof x === 'string' ? x : x.libelle))
    return {
      naturels: norm(data.risques?.naturels),
      technologiques: norm(data.risques?.technologiques),
      miniers: norm(data.risques?.miniers),
      radon_level: data.radon?.niveau ?? null,
      seismique: data.sismique?.zone ?? null,
    }
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

Deno.serve(async (req: Request) => {
  // Auth
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
    total_communes: 0,
    centroids_resolved: 0,
    georisques_fetched: 0,
    upserts: 0,
    errors: 0,
    duration_ms: 0,
  }

  try {
    const communes = await fetchTopCommunes(supabase)
    stats.total_communes = communes.length

    for (const commune of communes) {
      const centroid = await fetchBanCentroid(commune.commune_insee)
      if (!centroid) {
        stats.errors += 1
        await sleep(THROTTLE_MS)
        continue
      }
      stats.centroids_resolved += 1

      const risks = await fetchGeorisques(centroid.lat, centroid.lng)
      if (!risks) {
        stats.errors += 1
        await sleep(THROTTLE_MS)
        continue
      }
      stats.georisques_fetched += 1

      // UPSERT data.properties_erp_risks
      const { error: upsertErr } = await (supabase as any)
        .schema('data')
        .from('properties_erp_risks')
        .upsert(
          {
            ban_id: centroid.ban_id,
            commune_insee: commune.commune_insee,
            lat: centroid.lat,
            lng: centroid.lng,
            risques_naturels: risks.naturels,
            risques_technologiques: risks.technologiques,
            risques_miniers: risks.miniers,
            radon_level: risks.radon_level,
            seismique_zone: risks.seismique,
            ingested_at: new Date().toISOString(),
          },
          { onConflict: 'ban_id' },
        )

      if (upsertErr) {
        console.error(
          `[ingest-georisques] upsert failed for ${commune.commune_insee}:`,
          upsertErr.message,
        )
        stats.errors += 1
      } else {
        stats.upserts += 1
      }

      await sleep(THROTTLE_MS)
    }

    stats.duration_ms = Date.now() - startedAt

    return new Response(JSON.stringify({ ok: true, stats }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    console.error('[ingest-georisques-weekly] fatal error', err)
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
