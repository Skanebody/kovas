// ============================================
// KOVAS Annuaire — Edge Function : geocode-with-ban
//
// Mission Phase A : geocodage des fiches diagnostiqueurs via la
//   Base Adresse Nationale (api-adresse.data.gouv.fr).
//
// API utilisee :
//   GET https://api-adresse.data.gouv.fr/search/?q=...&limit=1
//   - Gratuit, sans cle, licence Etalab 2.0
//   - Soft rate-limit ~50 req/s (on tient 30 req/s en interne pour rester safe)
//
// Modes :
//   - batch  : POST {} ou { mode: 'batch', limit: 500 }
//              Geocode les diagnostiqueurs sans coords ou non synchronises
//              depuis > 180 jours (TTL geocodage).
//   - single : POST { mode: 'single', diagnostician_id: '<uuid>' }
//              Geocode une fiche precise (utile pour onboarding claim).
//
// Auth : `Authorization: Bearer ${SERVICE_ROLE_KEY}` ou `x-cron-secret`.
//
// Variables d'environnement :
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - CRON_SECRET (optionnel)
//   - BAN_API_BASE_URL (optionnel, override pour tests — defaut api-adresse.data.gouv.fr)
//
// TODO : la table `diagnosticians` n'a pas de colonne `address` (rue) — on
// utilise (city + postal_code + department_code). Si la fiche claimee
// ajoute une rue dans `bio` ou un futur champ `street_address`, etendre la
// query BAN en consequence pour atteindre la precision `housenumber`.
// ============================================

/// <reference lib="deno.ns" />

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

// ────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────

const BAN_API_BASE_URL =
  Deno.env.get('BAN_API_BASE_URL') ?? 'https://api-adresse.data.gouv.fr'

/** Score minimum BAN pour considerer un match exploitable. */
const MIN_BAN_SCORE = 0.5

/** TTL geocodage : on resync au-dela de 180 jours. */
const GEO_TTL_DAYS = 180

/** Limite batch par defaut. */
const DEFAULT_BATCH_LIMIT = 500

/** Espacement minimum entre 2 requetes BAN (~30 req/s safe). */
const BAN_REQUEST_INTERVAL_MS = 35

/** Retries sur 429 / 503 (exponentiel : 500, 1500, 3500 ms). */
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 500

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

type BanAccuracy = 'housenumber' | 'street' | 'locality' | 'municipality' | 'unknown'

interface BanFeature {
  type: 'Feature'
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: {
    label: string
    score: number
    type: BanAccuracy
    postcode?: string
    citycode?: string
    city?: string
    context?: string
  }
}

interface BanResponse {
  type: 'FeatureCollection'
  features: BanFeature[]
}

interface DiagnosticianGeoCandidate {
  id: string
  city: string
  postal_code: string | null
  department_code: string
}

interface GeocodeOutcome {
  matched: boolean
  banAccuracy: BanAccuracy
  banLabel: string | null
  geoLat: number | null
  geoLng: number | null
  score: number | null
}

interface GeocodeRequestBody {
  mode?: 'batch' | 'single'
  diagnostician_id?: string
  limit?: number
}

interface GeocodeResponse {
  ok: boolean
  processed: number
  matched: number
  notFound: number
  errors: number
  durationMs: number
  errorMessages?: string[]
  error?: string
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Construit la query BAN a partir des champs disponibles.
 * Strategie : preferer (postal_code + city) — le plus precis sans rue.
 * Fallback : (department_code + city) si postal_code absent.
 */
function buildBanQuery(diag: DiagnosticianGeoCandidate): string {
  const parts: string[] = []
  if (diag.city) parts.push(diag.city)
  if (diag.postal_code) parts.push(diag.postal_code)
  else if (diag.department_code) parts.push(diag.department_code)
  return parts.join(' ').trim()
}

/**
 * Appel BAN avec retry exponentiel sur 429 / 503.
 * Retourne le 1er feature ou null.
 */
async function callBan(query: string): Promise<BanFeature | null> {
  const url = new URL(`${BAN_API_BASE_URL}/search/`)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '1')

  let lastError: string | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      })
      if (res.status === 429 || res.status === 503) {
        lastError = `HTTP ${res.status}`
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 200)
          continue
        }
        throw new Error(lastError)
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = (await res.json()) as BanResponse
      return data.features?.[0] ?? null
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      if (attempt >= MAX_RETRIES) throw new Error(lastError)
      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt))
    }
  }
  throw new Error(lastError ?? 'unknown BAN error')
}

/**
 * Normalise un type BAN en BanAccuracy de la check constraint DB.
 */
function normalizeBanType(rawType: string | undefined): BanAccuracy {
  switch (rawType) {
    case 'housenumber':
    case 'street':
    case 'locality':
    case 'municipality':
      return rawType
    default:
      return 'unknown'
  }
}

/**
 * Geocode un diagnostiqueur, met a jour la fiche, logue l'outcome.
 */
async function geocodeOne(
  supabase: SupabaseClient,
  diag: DiagnosticianGeoCandidate,
): Promise<GeocodeOutcome> {
  const tStart = Date.now()
  const query = buildBanQuery(diag)
  const nowIso = new Date().toISOString()

  if (!query) {
    // Pas de quoi geocoder — on marque unknown et on log
    await supabase
      .from('diagnosticians')
      .update({
        ban_accuracy: 'unknown',
        ban_last_synced_at: nowIso,
      })
      .eq('id', diag.id)
    await supabase.from('diagnostician_cross_validation_logs').insert({
      diagnostician_id: diag.id,
      source: 'BAN',
      outcome: 'not_found',
      payload: { reason: 'empty_query', city: diag.city, postal_code: diag.postal_code },
      error_message: null,
      latency_ms: Date.now() - tStart,
    })
    return {
      matched: false,
      banAccuracy: 'unknown',
      banLabel: null,
      geoLat: null,
      geoLng: null,
      score: null,
    }
  }

  let feature: BanFeature | null = null
  let banError: string | null = null
  try {
    feature = await callBan(query)
  } catch (err) {
    banError = err instanceof Error ? err.message : String(err)
  }

  const latencyMs = Date.now() - tStart

  if (banError) {
    await supabase.from('diagnostician_cross_validation_logs').insert({
      diagnostician_id: diag.id,
      source: 'BAN',
      outcome: banError.includes('429') ? 'rate_limited' : 'error',
      payload: { query },
      error_message: banError,
      latency_ms: latencyMs,
    })
    return {
      matched: false,
      banAccuracy: 'unknown',
      banLabel: null,
      geoLat: null,
      geoLng: null,
      score: null,
    }
  }

  if (!feature || feature.properties.score < MIN_BAN_SCORE) {
    await supabase
      .from('diagnosticians')
      .update({
        ban_accuracy: 'unknown',
        ban_last_synced_at: nowIso,
      })
      .eq('id', diag.id)
    await supabase.from('diagnostician_cross_validation_logs').insert({
      diagnostician_id: diag.id,
      source: 'BAN',
      outcome: 'not_found',
      payload: { query, score: feature?.properties.score ?? null },
      error_message: null,
      latency_ms: latencyMs,
    })
    return {
      matched: false,
      banAccuracy: 'unknown',
      banLabel: null,
      geoLat: null,
      geoLng: null,
      score: feature?.properties.score ?? null,
    }
  }

  const [lng, lat] = feature.geometry.coordinates
  const accuracy = normalizeBanType(feature.properties.type)
  const label = feature.properties.label
  const score = feature.properties.score

  const { error } = await supabase
    .from('diagnosticians')
    .update({
      geo_lat: lat,
      geo_lng: lng,
      ban_accuracy: accuracy,
      ban_label: label,
      ban_last_synced_at: nowIso,
    })
    .eq('id', diag.id)

  if (error) {
    await supabase.from('diagnostician_cross_validation_logs').insert({
      diagnostician_id: diag.id,
      source: 'BAN',
      outcome: 'error',
      payload: { query, score },
      error_message: `db update failed: ${error.message}`,
      latency_ms: latencyMs,
    })
    return {
      matched: false,
      banAccuracy: accuracy,
      banLabel: label,
      geoLat: lat,
      geoLng: lng,
      score,
    }
  }

  await supabase.from('diagnostician_cross_validation_logs').insert({
    diagnostician_id: diag.id,
    source: 'BAN',
    outcome: 'matched',
    payload: { query, score, accuracy, label },
    error_message: null,
    latency_ms: latencyMs,
  })

  return {
    matched: true,
    banAccuracy: accuracy,
    banLabel: label,
    geoLat: lat,
    geoLng: lng,
    score,
  }
}

// ────────────────────────────────────────────────────────────
// Candidate selection
// ────────────────────────────────────────────────────────────

/** Mode batch : recupere les fiches a (re)geocoder. */
async function selectBatchCandidates(
  supabase: SupabaseClient,
  limit: number,
): Promise<DiagnosticianGeoCandidate[]> {
  const ttlCutoff = new Date(Date.now() - GEO_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  // 1) Fiches sans coords du tout
  const { data: noGeo, error: noGeoErr } = await supabase
    .from('diagnosticians')
    .select('id, city, postal_code, department_code')
    .is('geo_lat', null)
    .limit(limit)
  if (noGeoErr) {
    console.error(`[geocode-with-ban] select no-geo failed: ${noGeoErr.message}`)
    return []
  }
  const noGeoRows = (noGeo ?? []) as DiagnosticianGeoCandidate[]
  if (noGeoRows.length >= limit) return noGeoRows.slice(0, limit)

  // 2) Completer avec les fiches stale (resync au-dela du TTL)
  const remaining = limit - noGeoRows.length
  const { data: stale, error: staleErr } = await supabase
    .from('diagnosticians')
    .select('id, city, postal_code, department_code')
    .not('geo_lat', 'is', null)
    .or(`ban_last_synced_at.is.null,ban_last_synced_at.lt.${ttlCutoff}`)
    .limit(remaining)
  if (staleErr) {
    console.error(`[geocode-with-ban] select stale failed: ${staleErr.message}`)
    return noGeoRows
  }
  const staleRows = (stale ?? []) as DiagnosticianGeoCandidate[]
  return [...noGeoRows, ...staleRows]
}

/** Mode single : recupere une fiche precise. */
async function selectSingleCandidate(
  supabase: SupabaseClient,
  diagnosticianId: string,
): Promise<DiagnosticianGeoCandidate | null> {
  const { data, error } = await supabase
    .from('diagnosticians')
    .select('id, city, postal_code, department_code')
    .eq('id', diagnosticianId)
    .maybeSingle<DiagnosticianGeoCandidate>()
  if (error) {
    console.error(`[geocode-with-ban] select single failed: ${error.message}`)
    return null
  }
  return data
}

// ────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────

function isAuthorized(req: Request): boolean {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''

  const authHeader = req.headers.get('Authorization') ?? ''
  if (serviceKey && authHeader === `Bearer ${serviceKey}`) return true

  const cronHeader = req.headers.get('x-cron-secret') ?? ''
  if (cronSecret && cronHeader === cronSecret) return true

  return false
}

// ────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  const t0 = Date.now()
  const errors: string[] = []

  try {
    if (!isAuthorized(req)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !supabaseServiceKey) {
      const response: GeocodeResponse = {
        ok: false,
        processed: 0,
        matched: 0,
        notFound: 0,
        errors: 1,
        durationMs: Date.now() - t0,
        error: 'missing supabase env',
      }
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ─── Parse body ───
    let body: GeocodeRequestBody = {}
    try {
      const text = await req.text()
      if (text && text.trim()) {
        body = JSON.parse(text) as GeocodeRequestBody
      }
    } catch {
      // Body absent ou non-JSON → mode batch defaut
      body = {}
    }

    const mode: 'batch' | 'single' = body.mode === 'single' ? 'single' : 'batch'

    // ─── Select candidates ───
    let candidates: DiagnosticianGeoCandidate[] = []
    if (mode === 'single') {
      if (!body.diagnostician_id) {
        const response: GeocodeResponse = {
          ok: false,
          processed: 0,
          matched: 0,
          notFound: 0,
          errors: 1,
          durationMs: Date.now() - t0,
          error: 'mode=single requires diagnostician_id',
        }
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const single = await selectSingleCandidate(supabase, body.diagnostician_id)
      if (single) candidates = [single]
    } else {
      const limit = typeof body.limit === 'number' && body.limit > 0
        ? Math.min(body.limit, 2000)
        : DEFAULT_BATCH_LIMIT
      candidates = await selectBatchCandidates(supabase, limit)
    }

    if (candidates.length === 0) {
      const response: GeocodeResponse = {
        ok: true,
        processed: 0,
        matched: 0,
        notFound: 0,
        errors: 0,
        durationMs: Date.now() - t0,
      }
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ─── Geocode loop with rate limiting ───
    let processed = 0
    let matched = 0
    let notFound = 0
    let errorCount = 0

    for (const diag of candidates) {
      try {
        const outcome = await geocodeOne(supabase, diag)
        processed++
        if (outcome.matched) matched++
        else notFound++
      } catch (err) {
        errorCount++
        const message = err instanceof Error ? err.message : String(err)
        errors.push(`${diag.id}: ${message}`)
      }
      // Rate limit interne (~30 req/s)
      await sleep(BAN_REQUEST_INTERVAL_MS)
    }

    const response: GeocodeResponse = {
      ok: errorCount === 0,
      processed,
      matched,
      notFound,
      errors: errorCount,
      durationMs: Date.now() - t0,
      errorMessages: errors.slice(0, 50),
    }
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const response: GeocodeResponse = {
      ok: false,
      processed: 0,
      matched: 0,
      notFound: 0,
      errors: 1,
      durationMs: Date.now() - t0,
      error: `unhandled exception: ${message}`,
    }
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
