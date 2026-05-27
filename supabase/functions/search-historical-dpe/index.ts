// KOVAS — Edge Function `search-historical-dpe`
//
// POST `/search-historical-dpe`
//
// Recherche un DPE historique pour une adresse donnée. Stratégie :
//   1. Cherche dans `dpe_historical_cache` (TTL 30j)
//   2. Si miss : interroge l'open data ADEME (search.koumoul.com)
//   3. Persiste le résultat dans le cache pour 30j
//
// Body :
// { "address": "12 rue de la Paix", "postal_code": "75002", "city": "Paris" }
//
// Réponse :
// { "found": true, "dpe": { ademe_number, energy_class, ges_class, diagnostic_date, conso_kwh_m2_an, ... } }
// ou { "found": false }
//
// Authentication : Bearer JWT user (Supabase Auth) — l'utilisateur doit être
// authentifié, mais la recherche elle-même utilise le service role pour écrire
// dans le cache partagé.

/// <reference lib="deno.ns" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

interface RequestBody {
  address: string
  postal_code?: string
  city?: string
}

function normalizeAddress(address: string, postalCode?: string | null): string {
  return `${address} ${postalCode ?? ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const ADEME_BASE_URL = 'https://data.ademe.fr/data-fair/api/v1'
const DATASET = 'dpe-v2-logements-existants'

interface AdemeRow {
  Numero_DPE?: string
  Date_etablissement_DPE?: string
  Nom_diagnostiqueur?: string
  Etiquette_DPE?: string
  Etiquette_GES?: string
  Conso_5_usages_par_m2_e_finale?: number
  Emission_GES_5_usages_par_m2?: number
  Adresse_brut?: string
  Code_postal_BAN?: string
}

async function searchAdemeApi(
  address: string,
  postalCode: string | undefined,
): Promise<AdemeRow | null> {
  const qs = new URLSearchParams()
  // q full-text sur adresse + CP
  const query = `${address} ${postalCode ?? ''}`.trim()
  qs.set('q', query)
  qs.set('size', '5')
  qs.set(
    'select',
    [
      'Numero_DPE',
      'Date_etablissement_DPE',
      'Nom_diagnostiqueur',
      'Etiquette_DPE',
      'Etiquette_GES',
      'Conso_5_usages_par_m2_e_finale',
      'Emission_GES_5_usages_par_m2',
      'Adresse_brut',
      'Code_postal_BAN',
    ].join(','),
  )
  qs.set('sort', '-Date_etablissement_DPE')

  const url = `${ADEME_BASE_URL}/datasets/${DATASET}/lines?${qs.toString()}`
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.warn(`ADEME ${res.status} for ${url}`)
      return null
    }
    const json = (await res.json()) as { results?: AdemeRow[] }
    const candidates = json.results ?? []
    if (candidates.length === 0) return null

    // Filtre CP si fourni
    if (postalCode) {
      const exactCp = candidates.find((r) => r.Code_postal_BAN === postalCode)
      if (exactCp) return exactCp
    }
    return candidates[0] ?? null
  } catch (e) {
    console.error('search ADEME error', e)
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing authorization' }, 401)

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!body.address) return json({ error: 'address is required' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) return json({ error: 'Supabase env missing' }, 500)

  // Verify user authentication first
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData } = await userClient.auth.getUser()
  if (!userData?.user) return json({ error: 'Unauthorized' }, 401)

  // Use service role for cache operations
  const adminSupabase = createClient(supabaseUrl, serviceRole)

  const normalized = normalizeAddress(body.address, body.postal_code)

  // 1. Cache lookup
  const { data: cached } = await adminSupabase
    .from('dpe_historical_cache')
    .select('*')
    .eq('address_normalized', normalized)
    .gt('expires_at', new Date().toISOString())
    .order('diagnostic_date', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (cached) {
    return json({
      found: true,
      source: 'cache',
      dpe: {
        ademe_number: cached.ademe_number,
        diagnostic_date: cached.diagnostic_date,
        diagnostician_name: cached.diagnostician_name,
        energy_class: cached.energy_class,
        ges_class: cached.ges_class,
        conso_kwh_m2_an: cached.conso_kwh_m2_an,
        ges_kgco2_m2_an: cached.ges_kgco2_m2_an,
      },
    })
  }

  // 2. Live ADEME query
  const row = await searchAdemeApi(body.address, body.postal_code)
  if (!row) {
    return json({ found: false })
  }

  // 3. Persist to cache
  const cacheRow = {
    address_normalized: normalized,
    postal_code: row.Code_postal_BAN ?? body.postal_code ?? null,
    ademe_number: row.Numero_DPE ?? null,
    diagnostic_date: row.Date_etablissement_DPE ?? null,
    diagnostician_name: row.Nom_diagnostiqueur ?? null,
    energy_class: row.Etiquette_DPE ?? null,
    ges_class: row.Etiquette_GES ?? null,
    conso_kwh_m2_an: row.Conso_5_usages_par_m2_e_finale ?? null,
    ges_kgco2_m2_an: row.Emission_GES_5_usages_par_m2 ?? null,
  }

  await adminSupabase.from('dpe_historical_cache').insert(cacheRow)

  return json({
    found: true,
    source: 'ademe_api',
    dpe: {
      ademe_number: cacheRow.ademe_number,
      diagnostic_date: cacheRow.diagnostic_date,
      diagnostician_name: cacheRow.diagnostician_name,
      energy_class: cacheRow.energy_class,
      ges_class: cacheRow.ges_class,
      conso_kwh_m2_an: cacheRow.conso_kwh_m2_an,
      ges_kgco2_m2_an: cacheRow.ges_kgco2_m2_an,
    },
  })
})
