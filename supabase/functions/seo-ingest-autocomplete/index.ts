// ============================================
// KOVAS App — Edge Function : seo-ingest-autocomplete
//
// Mission : interroger l'endpoint public Google Autocomplete (suggestqueries)
//   pour 20 seed-keywords metier diagnostic, et alimenter seo_keywords
//   + seo_keyword_signals avec les suggestions decouvertes.
//
// Auth   : Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY} OU header
//          x-cron-secret: ${CRON_SECRET}
// Trigger: pg_cron hebdomadaire (mercredi 03:00 UTC) + appels admin manuels.
//
// Source : https://suggestqueries.google.com/complete/search
//   - Pas de cle API, endpoint public stable (client=firefox)
//   - Rate limit officiel inconnu, on throttle 200ms entre requetes (5 req/s)
//
// Signaux emis par suggestion decouverte :
//   - source_code='google_autocomplete', signal_type='discovered', signal_value=1
//   - metadata.parent_seed = seed d'origine, metadata.rank = position
//
// Variables env :
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (admin)
//   - CRON_SECRET (auth alternative cron)
//   - AUTOCOMPLETE_THROTTLE_MS (defaut 200ms)
//
// Pas de mode mock : l'endpoint Google est public et gratuit, fonctionne
//   meme sans cle. Si tous les fetch echouent, on remonte simplement
//   suggestions=0 dans la reponse.
// ============================================

import { serve } from 'https://deno.land/std@0.220.1/http/server.ts'
import { type SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

// ============================================
// Types
// ============================================

interface RequestBody {
  /** Liste de seeds additionnels (en plus des 20 par defaut). */
  additionalSeeds?: string[]
}

/** Reponse Google Autocomplete : [query, suggestions[], descriptions, urls, ...] */
type AutocompleteResponse = [string, string[], ...unknown[]]

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
  seeds: number
  suggestions: number
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
// 20 seeds metier diagnostic
// ============================================

const SEED_KEYWORDS_20: string[] = [
  'dpe',
  'amiante',
  'plomb',
  'diagnostic immobilier',
  'diagnostic gaz',
  'termites',
  'carrez',
  'erp',
  'audit energetique',
  'diagnostic technique',
  'dpe location',
  'dpe vente',
  'amiante avant 1997',
  'diagnostic plomb',
  'diagnostic electricite',
  'diagnostic gaz copropriete',
  'termites definition',
  'loi carrez',
  'etat des risques',
  'diagnostic obligatoire',
]

// ============================================
// Appel Google Autocomplete (client=firefox)
// ============================================

async function fetchAutocomplete(seed: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed)}&hl=fr&gl=fr`
  const res = await fetch(url, {
    headers: {
      // User-Agent neutre — Google rejette les UA vides
      'User-Agent': 'Mozilla/5.0 (compatible; KovasSeoBot/1.0; +https://kovas.fr/bot)',
    },
  })
  if (!res.ok) {
    throw new Error(`autocomplete ${res.status} for "${seed}"`)
  }
  const parsed = (await res.json()) as AutocompleteResponse
  if (!Array.isArray(parsed) || parsed.length < 2) return []
  const suggestions = parsed[1]
  if (!Array.isArray(suggestions)) return []
  return suggestions.filter((s): s is string => typeof s === 'string')
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

    const seeds = Array.from(
      new Set([...SEED_KEYWORDS_20, ...(body.additionalSeeds ?? [])].map((s) => s.trim())),
    ).filter((s) => s.length > 0)

    const throttleMs = Number.parseInt(Deno.env.get('AUTOCOMPLETE_THROTTLE_MS') ?? '200', 10)

    let totalSuggestions = 0
    let totalSignals = 0
    const errors: string[] = []

    for (const seed of seeds) {
      let suggestions: string[] = []
      try {
        suggestions = await fetchAutocomplete(seed)
      } catch (err) {
        errors.push(`fetch "${seed}": ${(err as Error).message}`)
        if (throttleMs > 0) await sleep(throttleMs)
        continue
      }
      if (throttleMs > 0) await sleep(throttleMs)

      for (let i = 0; i < suggestions.length; i++) {
        const suggestion = suggestions[i]
        if (!suggestion || suggestion.trim().length === 0) continue

        try {
          const keywordId = await upsertKeyword(supabase, {
            display: suggestion,
            category: detectCategory(suggestion),
            language: 'fr',
            geo_scope: 'FR',
          })
          await insertSignal(supabase, {
            keyword_id: keywordId,
            source_code: 'google_autocomplete',
            signal_value: 1,
            signal_type: 'discovered',
            metadata: {
              parent_seed: seed,
              rank: i,
            },
            ingestion_run_id: ingestionRunId,
          })
          totalSuggestions += 1
          totalSignals += 1
        } catch (err) {
          errors.push(`${suggestion}: ${(err as Error).message}`)
        }
      }
    }

    await bumpSourceCounter(supabase, 'google_autocomplete', totalSignals)

    const summary: RunSummary = {
      ok: true,
      seeds: seeds.length,
      suggestions: totalSuggestions,
      signals: totalSignals,
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
// Setup cron hebdomadaire (mercredi 03:00 UTC) :
//
//   SELECT cron.schedule(
//     'seo-ingest-autocomplete-weekly',
//     '0 3 * * 3',
//     $$
//     SELECT net.http_post(
//       url := 'https://<project-ref>.supabase.co/functions/v1/seo-ingest-autocomplete',
//       headers := jsonb_build_object(
//         'Content-Type', 'application/json',
//         'x-cron-secret', current_setting('app.cron_secret', true)
//       ),
//       body := '{}'::jsonb
//     );
//     $$
//   );
// ============================================
