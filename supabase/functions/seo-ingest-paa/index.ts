// ============================================
// KOVAS App — Edge Function : seo-ingest-paa
//
// Mission : remonter les "People Also Ask" Google pour les top-10 keywords
//   scored dans seo_keywords (ORDER BY score DESC LIMIT 10), via le scraper
//   Apify apify/google-search-scraper, et alimenter seo_keywords
//   + seo_keyword_signals avec les questions PAA decouvertes.
//
// Auth   : Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY} OU header
//          x-cron-secret: ${CRON_SECRET}
// Trigger: pg_cron hebdomadaire (jeudi 04:00 UTC) + appels admin manuels.
//
// Cout Apify : ~0.10$ / 100 requetes (actor google-search-scraper). 10 top
//   keywords / semaine = ~0.40$/mois, marginal.
//
// Signaux emis par question PAA :
//   - source_code='paa_apify', signal_type='paa_question', signal_value=1
//   - metadata.parent_keyword, metadata.question_position
//
// Mode mock : si APIFY_API_TOKEN absent, on retourne 5 PAA questions
//   hardcodees par keyword (metadata.mock=true).
//
// Variables env :
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (admin)
//   - CRON_SECRET (auth alternative cron)
//   - APIFY_API_TOKEN (token API Apify)
//   - APIFY_PAA_ACTOR_ID (defaut "apify~google-search-scraper")
//   - APIFY_RUN_TIMEOUT_MS (defaut 60000ms = 60s)
//   - APIFY_POLL_INTERVAL_MS (defaut 2000ms)
// ============================================

import { serve } from 'https://deno.land/std@0.220.1/http/server.ts'
import { type SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

// ============================================
// Types
// ============================================

interface RequestBody {
  /** Nombre de top-keywords a traiter (defaut 10, max 50). */
  topN?: number
}

interface SeoKeywordRow {
  id: string
  keyword_display: string
  score: number | null
}

interface ApifyRunStartResponse {
  data: {
    id: string
    actId: string
    status: string
    defaultDatasetId: string
  }
}

interface ApifyRunStatusResponse {
  data: {
    id: string
    status:
      | 'READY'
      | 'RUNNING'
      | 'SUCCEEDED'
      | 'FAILED'
      | 'ABORTING'
      | 'ABORTED'
      | 'TIMING-OUT'
      | 'TIMED-OUT'
    defaultDatasetId: string
  }
}

interface ApifyPaaItem {
  question: string
  answer?: string
}

interface ApifySerpItem {
  searchQuery?: { term?: string }
  peopleAlsoAsk?: ApifyPaaItem[]
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

interface KeywordCategoryInput {
  display: string
  category: KeywordCategory
  geo_scope?: string | null
  language?: string
  intent_type?: string | null
}

interface RunSummary {
  ok: boolean
  mock: boolean
  keywordsProcessed: number
  paaQuestionsFound: number
  signals: number
  durationMs: number
  ingestion_run_id: string
  error?: string
}

// ============================================
// Helpers communs
// ============================================

function normalizeKeyword(raw: string): string {
  return raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

function detectCategory(query: string): KeywordCategory {
  const q = normalizeKeyword(query)
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
  const { data, error } = await supabase
    .from('seo_sources')
    .select('total_signals_count')
    .eq('code', sourceCode)
    .maybeSingle()
  if (error) {
    console.warn(`bumpSourceCounter read failed: ${error.message}`)
    return
  }
  const nowIso = new Date().toISOString()
  if (!data) {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================
// Apify : lancer run + poll + recuperer dataset items
// ============================================

interface ApifyConfig {
  token: string
  actorId: string
  pollIntervalMs: number
  timeoutMs: number
}

async function runApifyPaa(cfg: ApifyConfig, keyword: string): Promise<ApifyPaaItem[]> {
  // 1. Lancement du run (synchroneous "runs" — pas runs-sync car on veut
  //    timeout cote nous + status polling explicite)
  const startUrl = `https://api.apify.com/v2/acts/${cfg.actorId}/runs?token=${encodeURIComponent(cfg.token)}`
  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      queries: keyword,
      countryCode: 'fr',
      languageCode: 'fr',
      maxPagesPerQuery: 1,
      mobileResults: false,
      includeUnfilteredResults: false,
      saveHtml: false,
    }),
  })
  if (!startRes.ok) {
    const txt = await startRes.text().catch(() => '')
    throw new Error(`Apify start ${startRes.status}: ${txt.substring(0, 200)}`)
  }
  const startData = (await startRes.json()) as ApifyRunStartResponse
  const runId = startData.data.id
  let datasetId = startData.data.defaultDatasetId

  // 2. Poll status (max timeoutMs)
  const startedAt = Date.now()
  let lastStatus = startData.data.status
  while (Date.now() - startedAt < cfg.timeoutMs) {
    if (
      lastStatus === 'SUCCEEDED' ||
      lastStatus === 'FAILED' ||
      lastStatus === 'ABORTED' ||
      lastStatus === 'TIMED-OUT'
    ) {
      break
    }
    await sleep(cfg.pollIntervalMs)

    const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(cfg.token)}`
    const statusRes = await fetch(statusUrl)
    if (!statusRes.ok) {
      throw new Error(`Apify status ${statusRes.status}`)
    }
    const statusData = (await statusRes.json()) as ApifyRunStatusResponse
    lastStatus = statusData.data.status
    datasetId = statusData.data.defaultDatasetId
  }

  if (lastStatus !== 'SUCCEEDED') {
    throw new Error(`Apify run not succeeded for "${keyword}" (status=${lastStatus})`)
  }

  // 3. Recuperer dataset items
  const itemsUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(cfg.token)}&clean=true&format=json`
  const itemsRes = await fetch(itemsUrl)
  if (!itemsRes.ok) {
    throw new Error(`Apify dataset items ${itemsRes.status}`)
  }
  const items = (await itemsRes.json()) as ApifySerpItem[]
  const paas: ApifyPaaItem[] = []
  for (const item of items) {
    if (Array.isArray(item.peopleAlsoAsk)) {
      for (const paa of item.peopleAlsoAsk) {
        if (paa.question && typeof paa.question === 'string') {
          paas.push(paa)
        }
      }
    }
  }
  return paas
}

// ============================================
// Mode mock : 5 PAA questions hardcodees par keyword
// ============================================

function mockPaaForKeyword(keyword: string): ApifyPaaItem[] {
  const lower = keyword.toLowerCase()
  const generic: ApifyPaaItem[] = [
    { question: `Quel est le prix d'un diagnostic ${lower} ?` },
    { question: `Quelle est la duree de validite d'un diagnostic ${lower} ?` },
    { question: `Le diagnostic ${lower} est-il obligatoire ?` },
    { question: `Qui realise le diagnostic ${lower} ?` },
    { question: `Comment se passe un diagnostic ${lower} ?` },
  ]
  return generic
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
    // --- Auth ---
    const authHeader = req.headers.get('Authorization') ?? ''
    const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const cronSecret = Deno.env.get('CRON_SECRET') ?? ''

    const isServiceRole = serviceKey && authHeader === `Bearer ${serviceKey}`
    const isCron = cronSecret && cronSecretHeader === cronSecret
    if (!isServiceRole && !isCron) {
      return jsonResponse(401, { ok: false, error: 'unauthorized' })
    }

    // --- Body ---
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

    const topN = Math.max(1, Math.min(body.topN ?? 10, 50))

    // --- Selection des top-N keywords scored ---
    const { data: topKeywords, error: selErr } = await supabase
      .from('seo_keywords')
      .select('id, keyword_display, score')
      .order('score', { ascending: false, nullsFirst: false })
      .limit(topN)
    if (selErr) {
      return jsonResponse(200, {
        ok: false,
        error: `select top keywords: ${selErr.message}`,
        durationMs: Date.now() - t0,
        ingestion_run_id: ingestionRunId,
      })
    }
    const keywords = (topKeywords ?? []) as SeoKeywordRow[]

    // --- Mode mock si APIFY_API_TOKEN absent ---
    const apifyToken = Deno.env.get('APIFY_API_TOKEN') ?? ''
    const actorId = Deno.env.get('APIFY_PAA_ACTOR_ID') ?? 'apify~google-search-scraper'
    const pollIntervalMs = Number.parseInt(Deno.env.get('APIFY_POLL_INTERVAL_MS') ?? '2000', 10)
    const timeoutMs = Number.parseInt(Deno.env.get('APIFY_RUN_TIMEOUT_MS') ?? '60000', 10)

    const mock = !apifyToken
    if (mock) {
      console.warn(
        'seo-ingest-paa : APIFY_API_TOKEN absent — bascule mode mock (5 questions hardcodees par keyword)',
      )
    }

    let paaQuestionsFound = 0
    let signalsInserted = 0
    let processed = 0
    const errors: string[] = []

    const apifyCfg: ApifyConfig = {
      token: apifyToken,
      actorId,
      pollIntervalMs,
      timeoutMs,
    }

    for (const kw of keywords) {
      processed += 1
      let paas: ApifyPaaItem[] = []
      try {
        if (mock) {
          paas = mockPaaForKeyword(kw.keyword_display)
        } else {
          paas = await runApifyPaa(apifyCfg, kw.keyword_display)
        }
      } catch (err) {
        errors.push(`${kw.keyword_display}: ${(err as Error).message}`)
        continue
      }

      for (let i = 0; i < paas.length; i++) {
        const paa = paas[i]
        if (!paa.question || paa.question.trim().length === 0) continue

        try {
          const paaKeywordId = await upsertKeyword(supabase, {
            display: paa.question,
            category: detectCategory(paa.question),
            language: 'fr',
            geo_scope: 'FR',
            intent_type: 'informational',
          })
          await insertSignal(supabase, {
            keyword_id: paaKeywordId,
            source_code: 'paa_apify',
            signal_value: 1,
            signal_type: 'paa_question',
            metadata: {
              parent_keyword: kw.keyword_display,
              parent_keyword_id: kw.id,
              question_position: i,
              ...(paa.answer ? { answer_preview: paa.answer.substring(0, 280) } : {}),
              ...(mock ? { mock: true } : {}),
            },
            ingestion_run_id: ingestionRunId,
          })
          paaQuestionsFound += 1
          signalsInserted += 1
        } catch (err) {
          errors.push(`${paa.question}: ${(err as Error).message}`)
        }
      }
    }

    await bumpSourceCounter(supabase, 'paa_apify', signalsInserted)

    const summary: RunSummary = {
      ok: true,
      mock,
      keywordsProcessed: processed,
      paaQuestionsFound,
      signals: signalsInserted,
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
// Setup cron hebdomadaire (jeudi 04:00 UTC) :
//
//   SELECT cron.schedule(
//     'seo-ingest-paa-weekly',
//     '0 4 * * 4',
//     $$
//     SELECT net.http_post(
//       url := 'https://<project-ref>.supabase.co/functions/v1/seo-ingest-paa',
//       headers := jsonb_build_object(
//         'Content-Type', 'application/json',
//         'x-cron-secret', current_setting('app.cron_secret', true)
//       ),
//       body := jsonb_build_object('topN', 10)
//     );
//     $$
//   );
// ============================================
