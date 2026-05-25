/**
 * KOVAS — Edge Function ingest-ign-cadastre-weekly.
 *
 * Pré-warm hebdomadaire du cadastre IGN sur les ban_id déjà présents dans
 * data.properties_unified mais sans parcelle_cadastre_id. Comble les profils
 * unifiés partiels.
 *
 * Cron : `0 5 * * 2` (mardi 5h UTC).
 *
 * Stratégie :
 *   1. SELECT ban_id, ban_lat, ban_lng FROM data.properties_unified
 *      WHERE parcelle_cadastre_id IS NULL LIMIT 1000
 *   2. Pour chaque : hit IGN cadastre WFS via lat/lng
 *      (https://wxs.ign.fr/geoportail/ws/cadastre/parcelles?...)
 *   3. UPDATE data.properties_unified avec parcelle_cadastre_id + surface_terrain
 *
 * Throttle 2s entre appels (IGN rate-limit prudent).
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §10 — pré-warm data lake.
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const IGN_API_KEY = Deno.env.get('IGN_API_KEY') ?? 'essentiels'

const BATCH_LIMIT = 1000
const THROTTLE_MS = 2000
const TIMEOUT_MS = 8000

interface UnifiedRow {
  ban_id: string
  ban_lat: number
  ban_lng: number
}

interface CadastreParcelle {
  id: string
  surface_terrain_m2: number | null
}

interface IngestStats {
  candidates: number
  resolved: number
  no_parcelle: number
  errors: number
  duration_ms: number
}

async function fetchPendingRows(supabase: ReturnType<typeof createClient>): Promise<UnifiedRow[]> {
  const { data, error } = await (supabase as any)
    .schema('data')
    .from('properties_unified')
    .select('ban_id, ban_lat, ban_lng')
    .is('parcelle_cadastre_id', null)
    .not('ban_lat', 'is', null)
    .not('ban_lng', 'is', null)
    .limit(BATCH_LIMIT)
  if (error) {
    console.error('[ingest-ign-cadastre] load failed:', error.message)
    return []
  }
  return (data ?? []) as UnifiedRow[]
}

async function fetchCadastreFromIGN(lat: number, lng: number): Promise<CadastreParcelle | null> {
  try {
    // IGN Géoplateforme — WFS cadastre / parcelles
    // Note : API publique IGN nécessite parfois clé. 'essentiels' tolérée 5/s.
    const bbox = `${lng - 0.0001},${lat - 0.0001},${lng + 0.0001},${lat + 0.0001}`
    const baseUrl = `https://wxs.ign.fr/${IGN_API_KEY}/geoportail/ws/cadastre/wfs`
    const query =
      '?service=WFS&version=2.0.0&request=GetFeature' +
      '&typeNames=BDPARCELLAIRE-VECTEUR_WLD_WGS84G:parcelle' +
      '&outputFormat=application/json&srsName=EPSG:4326&count=1'
    const url = `${baseUrl}${query}&bbox=${bbox}`
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!r.ok) return null
    const data = (await r.json()) as {
      features?: Array<{
        properties: {
          IDU?: string
          CONTENANCE?: number
        }
      }>
    }
    const f = data.features?.[0]
    if (!f) return null
    return {
      id: f.properties.IDU ?? '',
      surface_terrain_m2:
        typeof f.properties.CONTENANCE === 'number' ? f.properties.CONTENANCE : null,
    }
  } catch {
    return null
  }
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
    resolved: 0,
    no_parcelle: 0,
    errors: 0,
    duration_ms: 0,
  }

  try {
    const rows = await fetchPendingRows(supabase)
    stats.candidates = rows.length

    for (const row of rows) {
      const parcelle = await fetchCadastreFromIGN(row.ban_lat, row.ban_lng)
      if (!parcelle || !parcelle.id) {
        stats.no_parcelle += 1
        await sleep(THROTTLE_MS)
        continue
      }

      const { error: updateErr } = await (supabase as any)
        .schema('data')
        .from('properties_unified')
        .update({
          parcelle_cadastre_id: parcelle.id,
          surface_terrain_m2: parcelle.surface_terrain_m2,
          source_versions_ign_cadastre: new Date().toISOString(),
        })
        .eq('ban_id', row.ban_id)

      if (updateErr) {
        console.error(`[ingest-ign-cadastre] update failed for ${row.ban_id}:`, updateErr.message)
        stats.errors += 1
      } else {
        stats.resolved += 1
      }

      await sleep(THROTTLE_MS)
    }

    stats.duration_ms = Date.now() - startedAt
    return new Response(JSON.stringify({ ok: true, stats }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    console.error('[ingest-ign-cadastre-weekly] fatal error', err)
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
