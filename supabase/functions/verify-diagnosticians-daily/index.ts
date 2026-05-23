// ============================================
// KOVAS Annuaire — Edge Function : verify-diagnosticians-daily
//
// Mission : croisement quotidien de 3 sources externes pour chaque
//           diagnostiqueur en base, calcul de `activity_score` (0-1) et
//           levée éventuelle de `fraud_signals` si en dessous du seuil 0.5.
//
// Sources croisées (graceful degradation si env manquant) :
//   1. DHUP        — hash dhup_source_id toujours présent dans dernier import
//                    → flag dhup_active. Source de vérité certifications.
//                    Détection via `dhup_last_synced_at` récent (< 60 jours).
//   2. Sirene API  — SIRET actif (état administratif 'A')
//                    → drive `sirene_state` + `sirene_active` (GENERATED col).
//                    Auth : OAuth2 INSEE_CLIENT_ID / INSEE_CLIENT_SECRET.
//   3. Google Places API — enrichissement réputation (rating + review_count)
//                    → écrit `gmb_place_id`, `gmb_rating`, `gmb_review_count`.
//                    Auth : header X-Goog-Api-Key=GOOGLE_PLACES_API_KEY.
//
// Score d'activité (0-1, somme pondérée) :
//   • DHUP actif (sync < 60j)               : +0.40
//   • SIRET actif (sirene_state='active')   : +0.30
//   • GMB présent avec rating > 0           : +0.20
//   • ≥ 1 certification non expirée         : +0.10
//
// Bascule fraud_signals si score < 0.5 :
//   - jsonb append {type, severity, detected_at, reason}
//   - validation_status reste tel quel (séparation des préoccupations),
//     mais la fiche est masquée du public via RLS qui combine
//     `coalesce(sirene_active, true) = true AND activity_score >= 0.5`.
//
// Idempotence : la fonction peut tourner 100x sans corrompre les données.
// Chaque champ est UPDATÉ avec le timestamp courant ; les fraud_signals
// existants sont remplacés (pas append cumulatif) pour éviter l'inflation.
//
// Batch : 500 diagnostiqueurs par défaut, ordre LRU par activity_score_computed_at.
// 13 000 / 500 = 26 jours pour parcourir tout l'annuaire (rotation).
//
// Auth : Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}
//        OU header x-cron-secret: ${CRON_SECRET}
//
// Trigger :
//   - pg_cron quotidien 03:00 UTC (cf. migration 20260524190000)
//   - manuel via /admin/diagnostiqueurs/audit (bouton "Vérif manuelle")
//
// Variables d'environnement requises :
//   - SUPABASE_URL                     (auto)
//   - SUPABASE_SERVICE_ROLE_KEY        (auto)
//   - CRON_SECRET                      (optionnel)
//   - INSEE_CLIENT_ID                  (optionnel — si absent : skip Sirene)
//   - INSEE_CLIENT_SECRET              (optionnel — si absent : skip Sirene)
//   - GOOGLE_PLACES_API_KEY            (optionnel — si absent : skip GMB)
//   - INSEE_THROTTLE_MS                (défaut 1500 ms — 40 req/min sandbox safe)
//   - GMB_THROTTLE_MS                  (défaut 200 ms — 300 req/min safe)
//   - DHUP_FRESHNESS_DAYS              (défaut 60 — au-delà : dhup_active=false)
// ============================================

/// <reference lib="deno.ns" />

import { type SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface DiagnosticianRow {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  city: string | null
  postcode: string | null
  sirene_siret: string | null
  sirene_state: 'active' | 'ceased' | 'unknown' | null
  dhup_last_synced_at: string | null
  certifications: Array<{
    type: string
    organism?: string
    number?: string
    valid_until?: string | null
    status?: string
  }> | null
  gmb_place_id: string | null
  gmb_rating: number | null
  gmb_review_count: number | null
  activity_score: number | null
  fraud_flags: Array<Record<string, unknown>> | null
}

interface VerifyStats {
  ok: boolean
  processed: number
  dhupActive: number
  dhupInactive: number
  sireneActive: number
  sireneCeased: number
  sireneSkipped: number
  gmbEnriched: number
  gmbSkipped: number
  flaggedFraud: number
  belowThreshold: number
  durationMs: number
  batchOffset: number
  batchLimit: number
  notes: string[]
}

interface RequestBody {
  mode?: 'batch' | 'single' | 'all'
  limit?: number
  offset?: number
  diagnostician_id?: string
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function isAuthorized(req: Request): boolean {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''

  const auth = req.headers.get('Authorization') ?? ''
  if (serviceKey && auth === `Bearer ${serviceKey}`) return true

  const cronHeader = req.headers.get('x-cron-secret') ?? ''
  if (cronSecret && cronHeader === cronSecret) return true

  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function isDhupFresh(syncedAt: string | null, freshnessDays: number): boolean {
  if (!syncedAt) return false
  const synced = new Date(syncedAt).getTime()
  if (Number.isNaN(synced)) return false
  const ageMs = Date.now() - synced
  return ageMs < freshnessDays * 24 * 60 * 60 * 1000
}

function hasValidCertification(certs: DiagnosticianRow['certifications']): boolean {
  if (!certs || certs.length === 0) return false
  const today = Date.now()
  return certs.some((c) => {
    if (c.status && c.status !== 'valid') return false
    if (!c.valid_until) return true
    const expiry = new Date(c.valid_until).getTime()
    return !Number.isNaN(expiry) && expiry > today
  })
}

// ─────────────────────────────────────────────────────────────
// INSEE Sirene OAuth2 + fetch (réutilise pattern cross-validate-sirene)
// ─────────────────────────────────────────────────────────────

interface CachedInseeToken {
  token: string
  expiresAt: number
}

let cachedInseeToken: CachedInseeToken | null = null

async function getInseeToken(force = false): Promise<string | null> {
  const clientId = Deno.env.get('INSEE_CLIENT_ID')
  const clientSecret = Deno.env.get('INSEE_CLIENT_SECRET')
  if (!clientId || !clientSecret) return null

  const now = Date.now()
  if (!force && cachedInseeToken && cachedInseeToken.expiresAt > now) {
    return cachedInseeToken.token
  }

  const tokenUrl = Deno.env.get('INSEE_TOKEN_URL') ?? 'https://api.insee.fr/token'
  const basic = btoa(`${clientId}:${clientSecret}`)

  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
    })
    if (!res.ok) {
      console.error(`[verify-daily] INSEE token error: ${res.status}`)
      return null
    }
    const data = (await res.json()) as {
      access_token: string
      expires_in: number
    }
    cachedInseeToken = {
      token: data.access_token,
      expiresAt: now + Math.min(50 * 60 * 1000, (data.expires_in ?? 3000) * 1000 - 60_000),
    }
    return cachedInseeToken.token
  } catch (err) {
    console.error(`[verify-daily] INSEE token exception: ${(err as Error).message}`)
    return null
  }
}

interface SireneVerdict {
  state: 'active' | 'ceased' | 'unknown'
  skipped: boolean
}

async function checkSirene(siret: string): Promise<SireneVerdict> {
  const token = await getInseeToken()
  if (!token) return { state: 'unknown', skipped: true }

  const apiBase = Deno.env.get('INSEE_API_BASE') ?? 'https://api.insee.fr/entreprises/sirene/V3.11'
  const url = `${apiBase.replace(/\/$/, '')}/siret/${encodeURIComponent(siret)}`

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (res.status === 404) return { state: 'unknown', skipped: false }
    if (res.status === 401) {
      // Force refresh + retry une fois
      cachedInseeToken = null
      const fresh = await getInseeToken(true)
      if (!fresh) return { state: 'unknown', skipped: true }
      const retry = await fetch(url, {
        headers: { Authorization: `Bearer ${fresh}`, Accept: 'application/json' },
      })
      if (!retry.ok) return { state: 'unknown', skipped: true }
      const data = (await retry.json()) as {
        etablissement?: { etatAdministratifEtablissement?: 'A' | 'F' }
      }
      const etat = data.etablissement?.etatAdministratifEtablissement
      return {
        state: etat === 'A' ? 'active' : etat === 'F' ? 'ceased' : 'unknown',
        skipped: false,
      }
    }
    if (res.status === 429) {
      await sleep(5000)
      return { state: 'unknown', skipped: true } // skip ce tour, retentera demain
    }
    if (!res.ok) return { state: 'unknown', skipped: true }
    const data = (await res.json()) as {
      etablissement?: { etatAdministratifEtablissement?: 'A' | 'F' }
    }
    const etat = data.etablissement?.etatAdministratifEtablissement
    return {
      state: etat === 'A' ? 'active' : etat === 'F' ? 'ceased' : 'unknown',
      skipped: false,
    }
  } catch (err) {
    console.error(`[verify-daily] sirene exception ${siret}: ${(err as Error).message}`)
    return { state: 'unknown', skipped: true }
  }
}

// ─────────────────────────────────────────────────────────────
// Google Places API : Text Search + Place Details (Places API v1)
// ─────────────────────────────────────────────────────────────

interface GmbVerdict {
  placeId: string | null
  rating: number | null
  reviewCount: number | null
  skipped: boolean
}

async function checkGmb(fullName: string, city: string | null): Promise<GmbVerdict> {
  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
  if (!apiKey) {
    return { placeId: null, rating: null, reviewCount: null, skipped: true }
  }
  if (!fullName.trim()) {
    return { placeId: null, rating: null, reviewCount: null, skipped: false }
  }

  const query = city
    ? `${fullName} diagnostic immobilier ${city}`
    : `${fullName} diagnostic immobilier`

  try {
    // Places API v1 — Text Search (endpoint moderne, plus simple que legacy)
    const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.rating,places.userRatingCount,places.displayName',
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'fr', regionCode: 'fr', pageSize: 1 }),
    })
    if (!searchRes.ok) {
      console.error(`[verify-daily] gmb search ${searchRes.status} for "${query}"`)
      return { placeId: null, rating: null, reviewCount: null, skipped: true }
    }
    const data = (await searchRes.json()) as {
      places?: Array<{
        id: string
        rating?: number
        userRatingCount?: number
        displayName?: { text: string }
      }>
    }
    const first = data.places?.[0]
    if (!first) {
      return { placeId: null, rating: null, reviewCount: null, skipped: false }
    }
    return {
      placeId: first.id,
      rating: typeof first.rating === 'number' ? first.rating : null,
      reviewCount: typeof first.userRatingCount === 'number' ? first.userRatingCount : null,
      skipped: false,
    }
  } catch (err) {
    console.error(`[verify-daily] gmb exception: ${(err as Error).message}`)
    return { placeId: null, rating: null, reviewCount: null, skipped: true }
  }
}

// ─────────────────────────────────────────────────────────────
// Score computation + fraud detection
// ─────────────────────────────────────────────────────────────

interface ScoreOutput {
  score: number // 0..1
  signals: Array<{ type: string; severity: string; detected_at: string; reason: string }>
  details: {
    dhupActive: boolean
    sireneActive: boolean
    gmbPresent: boolean
    hasValidCert: boolean
  }
}

function computeScore(
  dhupActive: boolean,
  sireneActive: boolean,
  sireneSkipped: boolean,
  gmbRating: number | null,
  hasValidCert: boolean,
): ScoreOutput {
  const detectedAt = new Date().toISOString()
  const signals: ScoreOutput['signals'] = []

  // Pondérations explicites
  let score = 0
  if (dhupActive) score += 0.4
  // Si Sirene a été skipped (API down ou env absent), on neutralise en
  // donnant le bénéfice du doute (+0.3) pour ne pas pénaliser à tort.
  if (sireneActive || sireneSkipped) score += 0.3
  const gmbPresent = typeof gmbRating === 'number' && gmbRating > 0
  if (gmbPresent) score += 0.2
  if (hasValidCert) score += 0.1

  // Détection signaux fraude
  if (!dhupActive) {
    signals.push({
      type: 'dhup_absent',
      severity: 'high',
      detected_at: detectedAt,
      reason: 'Hash DHUP absent du dernier import (> seuil fraîcheur).',
    })
  }
  if (!sireneActive && !sireneSkipped) {
    signals.push({
      type: 'sirene_inactive',
      severity: 'high',
      detected_at: detectedAt,
      reason: 'SIRET radié ou inconnu côté INSEE (état≠A).',
    })
  }
  if (!hasValidCert) {
    signals.push({
      type: 'no_valid_certification',
      severity: 'medium',
      detected_at: detectedAt,
      reason: 'Aucune certification non expirée.',
    })
  }

  return {
    score: Math.min(1, Math.max(0, score)),
    signals,
    details: { dhupActive, sireneActive, gmbPresent, hasValidCert },
  }
}

// ─────────────────────────────────────────────────────────────
// Per-diagnostician processing
// ─────────────────────────────────────────────────────────────

interface ProcessOutcome {
  dhupActive: boolean
  sireneActive: boolean
  sireneCeased: boolean
  sireneSkipped: boolean
  gmbEnriched: boolean
  gmbSkipped: boolean
  flaggedFraud: boolean
  belowThreshold: boolean
}

async function processOne(
  supabase: SupabaseClient,
  diag: DiagnosticianRow,
  freshnessDays: number,
  inseeThrottleMs: number,
  gmbThrottleMs: number,
): Promise<ProcessOutcome> {
  // ─── 1. DHUP freshness ───
  const dhupActive = isDhupFresh(diag.dhup_last_synced_at, freshnessDays)

  // ─── 2. Sirene ───
  let sireneVerdict: SireneVerdict = { state: diag.sirene_state ?? 'unknown', skipped: true }
  if (diag.sirene_siret) {
    sireneVerdict = await checkSirene(diag.sirene_siret)
    if (inseeThrottleMs > 0) await sleep(inseeThrottleMs)
  }
  const sireneActive = sireneVerdict.state === 'active'
  const sireneCeased = sireneVerdict.state === 'ceased'

  // ─── 3. GMB ───
  const fullName = diag.full_name ?? `${diag.first_name ?? ''} ${diag.last_name ?? ''}`.trim()
  let gmbVerdict: GmbVerdict = {
    placeId: diag.gmb_place_id,
    rating: diag.gmb_rating,
    reviewCount: diag.gmb_review_count,
    skipped: true,
  }
  // On ne réenrichit que si pas de place_id ou tous les 30 jours
  // (économise quota Google Places gratuit ~28k/mois)
  const shouldGmbCheck = !diag.gmb_place_id || diag.gmb_rating === null
  if (shouldGmbCheck) {
    gmbVerdict = await checkGmb(fullName, diag.city)
    if (gmbThrottleMs > 0) await sleep(gmbThrottleMs)
  }

  // ─── 4. Certifications ───
  const hasValidCert = hasValidCertification(diag.certifications)

  // ─── 5. Score + fraud ───
  const scoreOut = computeScore(
    dhupActive,
    sireneActive,
    sireneVerdict.skipped,
    gmbVerdict.rating,
    hasValidCert,
  )

  // ─── 6. UPDATE ───
  const updatePayload: Record<string, unknown> = {
    activity_score: scoreOut.score,
    activity_score_computed_at: new Date().toISOString(),
    sirene_state: sireneVerdict.state,
  }
  // GMB : on n'écrase QUE si on a refait un lookup
  if (!gmbVerdict.skipped) {
    updatePayload.gmb_place_id = gmbVerdict.placeId
    updatePayload.gmb_rating = gmbVerdict.rating
    updatePayload.gmb_review_count = gmbVerdict.reviewCount
  }
  if (sireneActive) {
    updatePayload.sirene_last_synced_at = new Date().toISOString()
  }
  // Fraud flags : remplacement complet (idempotence + pas d'inflation jsonb).
  // Colonne canonique = `fraud_flags` (cf. migration 20260524110000_diagnosticians_unified.sql).
  const belowThreshold = scoreOut.score < 0.5
  if (scoreOut.signals.length > 0) {
    updatePayload.fraud_flags = scoreOut.signals
  } else {
    updatePayload.fraud_flags = []
  }

  const { error } = await supabase.from('diagnosticians').update(updatePayload).eq('id', diag.id)

  if (error) {
    console.error(`[verify-daily] update ${diag.id} failed: ${error.message}`)
  }

  // ─── 7. Log audit (1 ligne par diagnostiqueur) ───
  await supabase
    .from('diagnostician_cross_validation_logs')
    .insert({
      diagnostician_id: diag.id,
      source: 'VERIFY_DAILY',
      outcome: belowThreshold ? 'fraud_flag' : sireneCeased ? 'ceased' : 'matched',
      payload: {
        score: scoreOut.score,
        signals: scoreOut.signals,
        details: scoreOut.details,
        sirene_skipped: sireneVerdict.skipped,
        gmb_skipped: gmbVerdict.skipped,
      } as Record<string, unknown>,
      error_message: null,
      latency_ms: null,
    })
    .then(({ error: logErr }) => {
      if (logErr) console.error(`[verify-daily] log insert failed: ${logErr.message}`)
    })

  return {
    dhupActive,
    sireneActive,
    sireneCeased,
    sireneSkipped: sireneVerdict.skipped,
    gmbEnriched: !gmbVerdict.skipped && gmbVerdict.placeId !== null,
    gmbSkipped: gmbVerdict.skipped,
    flaggedFraud: scoreOut.signals.length > 0,
    belowThreshold,
  }
}

// ─────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  const t0 = Date.now()

  if (!isAuthorized(req)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ ok: false, error: 'missing_supabase_env' }, 500)
  }

  // Parse body (POST). GET aussi accepté pour healthcheck.
  let body: RequestBody = {}
  if (req.method === 'POST') {
    try {
      const raw = await req.text()
      if (raw) body = JSON.parse(raw) as RequestBody
    } catch {
      return jsonResponse({ ok: false, error: 'invalid_json' }, 400)
    }
  }

  const mode = body.mode ?? 'batch'
  const limit = Math.max(1, Math.min(body.limit ?? 500, 2000))
  const offset = Math.max(0, body.offset ?? 0)
  const freshnessDays = Number.parseInt(Deno.env.get('DHUP_FRESHNESS_DAYS') ?? '60', 10)
  const inseeThrottleMs = Number.parseInt(Deno.env.get('INSEE_THROTTLE_MS') ?? '1500', 10)
  const gmbThrottleMs = Number.parseInt(Deno.env.get('GMB_THROTTLE_MS') ?? '200', 10)

  const supabase: SupabaseClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const notes: string[] = []
  if (!Deno.env.get('INSEE_CLIENT_ID')) {
    notes.push('INSEE_CLIENT_ID absent — Sirene cross-validation skipped (graceful)')
  }
  if (!Deno.env.get('GOOGLE_PLACES_API_KEY')) {
    notes.push('GOOGLE_PLACES_API_KEY absent — GMB enrichment skipped (graceful)')
  }

  // ─── Sélection des fiches ───
  let diagnosticians: DiagnosticianRow[] = []

  const selectCols =
    'id, full_name, first_name, last_name, city, postcode, sirene_siret, sirene_state, dhup_last_synced_at, certifications, gmb_place_id, gmb_rating, gmb_review_count, activity_score, fraud_flags'

  if (mode === 'single') {
    if (!body.diagnostician_id) {
      return jsonResponse({ ok: false, error: 'missing_diagnostician_id' }, 400)
    }
    const { data, error } = await supabase
      .from('diagnosticians')
      .select(selectCols)
      .eq('id', body.diagnostician_id)
      .maybeSingle()
    if (error) return jsonResponse({ ok: false, error: error.message }, 500)
    if (!data) return jsonResponse({ ok: false, error: 'not_found' }, 404)
    diagnosticians = [data as unknown as DiagnosticianRow]
  } else {
    // mode 'batch' ou 'all' : ordre LRU par activity_score_computed_at
    const query = supabase
      .from('diagnosticians')
      .select(selectCols)
      .order('activity_score_computed_at', { ascending: true, nullsFirst: true })
      .range(offset, offset + limit - 1)
    const { data, error } = await query
    if (error) return jsonResponse({ ok: false, error: error.message }, 500)
    diagnosticians = (data ?? []) as unknown as DiagnosticianRow[]
  }

  // ─── Boucle de traitement ───
  const stats: VerifyStats = {
    ok: true,
    processed: 0,
    dhupActive: 0,
    dhupInactive: 0,
    sireneActive: 0,
    sireneCeased: 0,
    sireneSkipped: 0,
    gmbEnriched: 0,
    gmbSkipped: 0,
    flaggedFraud: 0,
    belowThreshold: 0,
    durationMs: 0,
    batchOffset: offset,
    batchLimit: limit,
    notes,
  }

  for (const diag of diagnosticians) {
    try {
      const out = await processOne(supabase, diag, freshnessDays, inseeThrottleMs, gmbThrottleMs)
      stats.processed += 1
      if (out.dhupActive) stats.dhupActive += 1
      else stats.dhupInactive += 1
      if (out.sireneActive) stats.sireneActive += 1
      if (out.sireneCeased) stats.sireneCeased += 1
      if (out.sireneSkipped) stats.sireneSkipped += 1
      if (out.gmbEnriched) stats.gmbEnriched += 1
      if (out.gmbSkipped) stats.gmbSkipped += 1
      if (out.flaggedFraud) stats.flaggedFraud += 1
      if (out.belowThreshold) stats.belowThreshold += 1
    } catch (err) {
      console.error(`[verify-daily] processOne ${diag.id} exception: ${(err as Error).message}`)
      stats.processed += 1
    }
  }

  stats.durationMs = Date.now() - t0
  return jsonResponse(stats)
})

// ============================================
// Setup cron quotidien (cf. migration 20260524190000_verify_diagnosticians_daily_cron.sql) :
//
//   SELECT cron.schedule(
//     'kovas-verify-diagnosticians-daily',
//     '0 3 * * *',  -- 03:00 UTC chaque jour (05:00 Paris en été, 04:00 hiver)
//     $$
//     SELECT public.invoke_edge_function(
//       'verify-diagnosticians-daily',
//       jsonb_build_object('mode', 'batch', 'limit', 500)
//     );
//     $$
//   );
//
// Rotation 13k diags / 500 par jour = ~26 jours pour parcourir toute la base.
// Pour augmenter la fréquence, modifier limit à 1000 OU dupliquer le job à 04:00.
// ============================================
