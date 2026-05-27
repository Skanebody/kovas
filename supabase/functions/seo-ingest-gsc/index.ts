// ============================================
// KOVAS App — Edge Function : seo-ingest-gsc
//
// Mission : ingerer les requetes search analytics de Google Search Console
//   sur les 30 derniers jours pour le site kovas.fr, et alimenter les tables
//   seo_keywords + seo_keyword_signals + seo_sources.
//
// Auth   : Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY} OU header
//          x-cron-secret: ${CRON_SECRET}
// Trigger: pg_cron hebdomadaire (lundi 03:00 UTC) + appels admin manuels.
//
// Signaux emis par requete GSC :
//   - source_code='gsc', signal_type='volume'  , signal_value=impressions
//   - source_code='gsc', signal_type='position', signal_value=position
//   - source_code='gsc', signal_type='ctr'     , signal_value=ctr
//
// Mode mock : si GSC_SERVICE_ACCOUNT_JSON ou GSC_SITE_URL absent, on bascule
//   sur un jeu de 10 requetes hardcodees (metadata.mock=true) pour permettre
//   le dev local.
//
// Variables env :
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (admin)
//   - CRON_SECRET (auth alternative cron)
//   - GSC_SERVICE_ACCOUNT_JSON (JSON stringifie de la service account)
//   - GSC_SITE_URL (ex: sc-domain:kovas.fr)
// ============================================

import { serve } from 'https://deno.land/std@0.220.1/http/server.ts'
import { type SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

// ============================================
// Types
// ============================================

interface RequestBody {
  /** Nombre maximal de requetes a remonter (defaut 5000, max 25000). */
  rowLimit?: number
  /** Date debut au format ISO (defaut: J-30). */
  startDate?: string
  /** Date fin au format ISO (defaut: aujourd'hui). */
  endDate?: string
}

interface GscServiceAccount {
  client_email: string
  private_key: string
  token_uri?: string
}

interface GscTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

interface GscQueryRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface GscQueryResponse {
  rows?: GscQueryRow[]
  responseAggregationType?: string
}

interface KeywordCategoryInput {
  display: string
  category: KeywordCategory
  geo_scope?: string | null
  language?: string
  intent_type?: string | null
}

type KeywordCategory =
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'gaz'
  | 'electricite'
  | 'termites'
  | 'carrez'
  | 'erp'
  | 'general'

interface RunSummary {
  ok: boolean
  mock: boolean
  queries: number
  signals: number
  keywordsInserted: number
  durationMs: number
  ingestion_run_id: string
  error?: string
}

// ============================================
// Helpers communs
// ============================================

function normalizeKeyword(raw: string): string {
  return (
    raw
      .toLowerCase()
      .normalize('NFD')
      // Retire les marques diacritiques (accents) — plage Combining Diacritics
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

function detectCategory(query: string): KeywordCategory {
  const q = normalizeKeyword(query)
  // Ordre important : on teste les categories les plus specifiques d'abord
  if (/\b(amiante)\b/.test(q)) return 'amiante'
  if (/\b(plomb|crep)\b/.test(q)) return 'plomb'
  if (/\b(termites?)\b/.test(q)) return 'termites'
  if (/\b(gaz)\b/.test(q)) return 'gaz'
  if (/\b(electric(ite|ity|ique)|electrique)\b/.test(q)) return 'electricite'
  if (/\b(carrez|boutin|surface)\b/.test(q)) return 'carrez'
  if (/\b(erp|etat des risques|georisques?)\b/.test(q)) return 'erp'
  if (/\b(dpe|diagnostic de performance|performance energetique)\b/.test(q)) {
    return 'dpe'
  }
  return 'general'
}

async function upsertKeyword(supabase: SupabaseClient, kw: KeywordCategoryInput): Promise<string> {
  const normalized = normalizeKeyword(kw.display)
  const { data, error } = await supabase
    .from('seo_keywords')
    .upsert(
      {
        keyword_normalized: normalized,
        keyword_display: kw.display,
        language: kw.language ?? 'fr',
        geo_scope: kw.geo_scope ?? null,
        category: kw.category,
        intent_type: kw.intent_type ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'keyword_normalized' },
    )
    .select('id')
    .single()
  if (error) throw new Error(`upsertKeyword failed: ${error.message}`)
  if (!data) throw new Error('upsertKeyword returned no row')
  return data.id as string
}

interface SignalInsert {
  keyword_id: string
  source_code: string
  signal_value: number
  signal_type: string
  metadata?: Record<string, unknown>
  ingestion_run_id: string
}

async function insertSignal(supabase: SupabaseClient, params: SignalInsert): Promise<void> {
  const { error } = await supabase.from('seo_keyword_signals').insert({
    keyword_id: params.keyword_id,
    source_code: params.source_code,
    signal_value: params.signal_value,
    signal_type: params.signal_type,
    metadata: params.metadata ?? {},
    ingestion_run_id: params.ingestion_run_id,
    captured_at: new Date().toISOString(),
  })
  if (error) throw new Error(`insertSignal failed: ${error.message}`)
}

async function bumpSourceCounter(
  supabase: SupabaseClient,
  sourceCode: string,
  addedSignals: number,
): Promise<void> {
  // On lit l'existant pour incrementer (RPC plus tard si besoin de l'atomicite).
  const { data, error } = await supabase
    .from('seo_sources')
    .select('total_signals_count')
    .eq('code', sourceCode)
    .maybeSingle()
  if (error) {
    // Pas bloquant : on log mais on continue
    console.warn(`bumpSourceCounter read failed: ${error.message}`)
    return
  }

  const nowIso = new Date().toISOString()
  if (!data) {
    // Source pas encore enregistree : on l'insere (idempotent via upsert)
    const { error: upErr } = await supabase.from('seo_sources').upsert(
      {
        code: sourceCode,
        display_name: sourceCode,
        weight: 1,
        last_ingested_at: nowIso,
        total_signals_count: addedSignals,
      },
      { onConflict: 'code' },
    )
    if (upErr) console.warn(`bumpSourceCounter insert failed: ${upErr.message}`)
    return
  }

  const current = (data.total_signals_count as number | undefined) ?? 0
  const { error: updErr } = await supabase
    .from('seo_sources')
    .update({
      last_ingested_at: nowIso,
      total_signals_count: current + addedSignals,
    })
    .eq('code', sourceCode)
  if (updErr) console.warn(`bumpSourceCounter update failed: ${updErr.message}`)
}

// ============================================
// OAuth2 Service Account (JWT signe RS256)
// ============================================

function base64UrlEncode(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input)
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input)
  } else {
    bytes = input
  }
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

async function fetchGscAccessToken(sa: GscServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const tokenUri = sa.token_uri ?? 'https://oauth2.googleapis.com/token'

  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }

  const encHeader = base64UrlEncode(JSON.stringify(header))
  const encClaims = base64UrlEncode(JSON.stringify(claims))
  const unsigned = `${encHeader}.${encClaims}`

  const keyData = pemToArrayBuffer(sa.private_key)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned),
  )
  const jwt = `${unsigned}.${base64UrlEncode(signature)}`

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`GSC token error ${res.status}: ${txt.substring(0, 300)}`)
  }
  const data = (await res.json()) as GscTokenResponse
  return data.access_token
}

// ============================================
// Appel Search Analytics API
// ============================================

async function fetchGscQueries(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  rowLimit: number,
): Promise<GscQueryRow[]> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit,
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`GSC query error ${res.status}: ${txt.substring(0, 300)}`)
  }
  const data = (await res.json()) as GscQueryResponse
  return data.rows ?? []
}

// ============================================
// Mode mock (10 requetes typiques diagnostic FR)
// ============================================

function getMockGscRows(): GscQueryRow[] {
  return [
    { keys: ['dpe paris'], clicks: 45, impressions: 1230, ctr: 0.037, position: 8.2 },
    {
      keys: ['diagnostic immobilier dieppe'],
      clicks: 18,
      impressions: 420,
      ctr: 0.043,
      position: 5.1,
    },
    { keys: ['amiante avant 1997'], clicks: 32, impressions: 980, ctr: 0.033, position: 11.4 },
    {
      keys: ['diagnostic plomb crep prix'],
      clicks: 12,
      impressions: 350,
      ctr: 0.034,
      position: 14.8,
    },
    { keys: ['loi carrez calcul'], clicks: 55, impressions: 2100, ctr: 0.026, position: 9.7 },
    { keys: ['etat des risques erp'], clicks: 28, impressions: 1500, ctr: 0.019, position: 13.2 },
    {
      keys: ['diagnostic gaz copropriete'],
      clicks: 9,
      impressions: 280,
      ctr: 0.032,
      position: 16.3,
    },
    { keys: ['termites definition'], clicks: 24, impressions: 890, ctr: 0.027, position: 12.1 },
    { keys: ['dpe vente obligatoire'], clicks: 67, impressions: 2450, ctr: 0.027, position: 7.8 },
    {
      keys: ['diagnostic electricite obligatoire'],
      clicks: 41,
      impressions: 1180,
      ctr: 0.035,
      position: 10.5,
    },
  ]
}

// ============================================
// Handler principal
// ============================================

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  const t0 = Date.now()
  const ingestionRunId = crypto.randomUUID()

  try {
    // --- Auth : service_role OU x-cron-secret ---
    const authHeader = req.headers.get('Authorization') ?? ''
    const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const cronSecret = Deno.env.get('CRON_SECRET') ?? ''

    const isServiceRole = serviceKey && authHeader === `Bearer ${serviceKey}`
    const isCron = cronSecret && cronSecretHeader === cronSecret
    if (!isServiceRole && !isCron) {
      return jsonResponse(401, { ok: false, error: 'unauthorized' })
    }

    // --- Parse body ---
    let body: RequestBody = {}
    try {
      const raw = await req.text()
      if (raw) body = JSON.parse(raw) as RequestBody
    } catch {
      return jsonResponse(400, { ok: false, error: 'invalid json body' })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse(500, {
        ok: false,
        error: 'missing supabase env (SUPABASE_URL/SERVICE_ROLE_KEY)',
      })
    }
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // --- Dates par defaut : 30 derniers jours ---
    const endDate = body.endDate ?? new Date().toISOString().slice(0, 10)
    const startDate =
      body.startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const rowLimit = Math.max(1, Math.min(body.rowLimit ?? 5000, 25000))

    // --- Recuperation rows GSC ou mock ---
    const saJson = Deno.env.get('GSC_SERVICE_ACCOUNT_JSON') ?? ''
    const siteUrl = Deno.env.get('GSC_SITE_URL') ?? ''

    let rows: GscQueryRow[]
    let mock = false

    if (!saJson || !siteUrl) {
      console.warn(
        'seo-ingest-gsc : GSC_SERVICE_ACCOUNT_JSON ou GSC_SITE_URL absent — bascule mode mock',
      )
      rows = getMockGscRows()
      mock = true
    } else {
      let sa: GscServiceAccount
      try {
        sa = JSON.parse(saJson) as GscServiceAccount
      } catch (err) {
        return jsonResponse(500, {
          ok: false,
          error: `GSC_SERVICE_ACCOUNT_JSON invalide: ${(err as Error).message}`,
        })
      }
      const accessToken = await fetchGscAccessToken(sa)
      rows = await fetchGscQueries(accessToken, siteUrl, startDate, endDate, rowLimit)
    }

    // --- Boucle d'insertion ---
    let signalsInserted = 0
    let keywordsInserted = 0
    const errors: string[] = []

    for (const row of rows) {
      const query = row.keys?.[0]
      if (!query || query.trim().length === 0) continue

      try {
        const keywordId = await upsertKeyword(supabase, {
          display: query,
          category: detectCategory(query),
          language: 'fr',
          geo_scope: 'FR',
        })
        keywordsInserted += 1

        const baseMeta: Record<string, unknown> = mock
          ? { mock: true, clicks: row.clicks }
          : { clicks: row.clicks, start: startDate, end: endDate }

        await insertSignal(supabase, {
          keyword_id: keywordId,
          source_code: 'gsc',
          signal_value: row.impressions,
          signal_type: 'volume',
          metadata: baseMeta,
          ingestion_run_id: ingestionRunId,
        })
        await insertSignal(supabase, {
          keyword_id: keywordId,
          source_code: 'gsc',
          signal_value: row.position,
          signal_type: 'position',
          metadata: baseMeta,
          ingestion_run_id: ingestionRunId,
        })
        await insertSignal(supabase, {
          keyword_id: keywordId,
          source_code: 'gsc',
          signal_value: row.ctr,
          signal_type: 'ctr',
          metadata: baseMeta,
          ingestion_run_id: ingestionRunId,
        })
        signalsInserted += 3
      } catch (err) {
        errors.push(`${query}: ${(err as Error).message}`)
      }
    }

    await bumpSourceCounter(supabase, 'gsc', signalsInserted)

    const summary: RunSummary = {
      ok: true,
      mock,
      queries: rows.length,
      signals: signalsInserted,
      keywordsInserted,
      durationMs: Date.now() - t0,
      ingestion_run_id: ingestionRunId,
    }
    if (errors.length > 0) {
      summary.error = `${errors.length} erreurs partielles: ${errors.slice(0, 3).join(' | ')}`
    }
    return jsonResponse(200, summary as unknown as Record<string, unknown>)
  } catch (err) {
    return jsonResponse(200, {
      ok: false,
      error: (err as Error).message,
      durationMs: Date.now() - t0,
      ingestion_run_id: ingestionRunId,
    })
  }
})

// ============================================
// Setup cron hebdomadaire (a executer cote SQL une fois) :
//
//   SELECT cron.schedule(
//     'seo-ingest-gsc-weekly',
//     '0 3 * * 1',  -- lundi 03:00 UTC
//     $$
//     SELECT net.http_post(
//       url := 'https://<project-ref>.supabase.co/functions/v1/seo-ingest-gsc',
//       headers := jsonb_build_object(
//         'Content-Type', 'application/json',
//         'x-cron-secret', current_setting('app.cron_secret', true)
//       ),
//       body := '{}'::jsonb
//     );
//     $$
//   );
// ============================================
