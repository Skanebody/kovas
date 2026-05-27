// ============================================
// KOVAS SEO — Edge Function : seo-ingest-newsapi
//
// Mission : ingerer les signaux de couverture mediatique FR sur 10 themes
//   diagnostic immobilier via NewsAPI.org. Extraction heuristique bigrams
//   depuis les titres puis upsert keywords + signaux news_mention.
//
// Auth   : Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY} OU header
//          x-cron-secret: ${CRON_SECRET}
// Trigger: pg_cron quotidien (volume modere : 10 queries x 20 articles).
//
// Sources / couts API :
//   - NewsAPI.org : https://newsapi.org/v2/everything
//   - Gratuit jusqu'a 100 req/jour (plan Developer).
//
// Mode mock : si NEWSAPI_API_KEY absent, genere 5 articles factices par
//   query (50 articles mockes au total).
//
// Variables env :
//   - NEWSAPI_API_KEY (requis pour mode reel, sinon mock)
// ============================================

import { type SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

// ============================================
// Types
// ============================================
interface NewsApiArticle {
  source: { id: string | null; name: string }
  author: string | null
  title: string
  description: string | null
  url: string
  urlToImage: string | null
  publishedAt: string
  content: string | null
}

interface NewsApiResponse {
  status: string
  totalResults: number
  articles: NewsApiArticle[]
  code?: string
  message?: string
}

interface IngestStats {
  ok: boolean
  queriesProcessed: number
  articlesParsed: number
  signalsCreated: number
  keywordsCreated: number
  mockMode: boolean
  durationMs: number
  errors: number
}

interface InsertSignalParams {
  keywordId: string
  sourceCode: string
  signalValue: number
  signalType: string
  metadata: Record<string, unknown>
  ingestionRunId: string
}

// ============================================
// 10 queries thematiques diagnostic immobilier FR
// ============================================
const SEARCH_QUERIES: ReadonlyArray<{ query: string; category: string }> = [
  { query: 'DPE 2025 France', category: 'dpe' },
  { query: 'audit energetique France', category: 'audit' },
  { query: 'diagnostic immobilier obligatoire', category: 'general' },
  { query: 'passoire thermique location', category: 'dpe' },
  { query: 'amiante avant 1997', category: 'amiante' },
  { query: 'diagnostic plomb peinture', category: 'plomb' },
  { query: 'Loi Climat Resilience DPE', category: 'reglementation' },
  { query: 'interdiction location G', category: 'reglementation' },
  { query: 'RE2020 diagnostic', category: 'reglementation' },
  { query: 'diagnostic gaz copropriete', category: 'gaz' },
]

// ============================================
// Stopwords FR + bruit (titres news)
// ============================================
const STOPWORDS_FR = new Set<string>([
  'a',
  'au',
  'aux',
  'avec',
  'ce',
  'ces',
  'cet',
  'cette',
  'comment',
  'dans',
  'de',
  'des',
  'du',
  'en',
  'est',
  'et',
  'eu',
  'il',
  'ils',
  'je',
  'la',
  'le',
  'les',
  'leur',
  'leurs',
  'lui',
  'ma',
  'mais',
  'me',
  'mes',
  'mon',
  'ne',
  'nos',
  'notre',
  'nous',
  'on',
  'ont',
  'ou',
  'par',
  'pas',
  'plus',
  'pour',
  'qu',
  'que',
  'qui',
  'quoi',
  'sa',
  'sans',
  'se',
  'ses',
  'son',
  'sont',
  'sur',
  'ta',
  'te',
  'tes',
  'toi',
  'ton',
  'tu',
  'un',
  'une',
  'vos',
  'votre',
  'vous',
  'y',
  'cas',
  'fait',
  'tout',
  'tous',
  'toute',
  'toutes',
  'apres',
  'avant',
  'aussi',
  'comme',
  'entre',
  'leur',
  'meme',
  'plus',
  'sous',
  'vers',
  'ici',
  'la',
  'ya',
  'etre',
  'etait',
  'ete',
  'etat',
  'avoir',
  'eu',
  'eue',
  'eues',
  'eus',
  'the',
  'and',
  'for',
  'with',
  'this',
  'that',
  'from',
  'are',
  'was',
  'were',
  'has',
  'have',
  'will',
  'can',
  'all',
])

// Bigrams metier "fixes" qu'on cherche en priorite
const TARGET_BIGRAMS: ReadonlyArray<{ pattern: RegExp; keyword: string; category: string }> = [
  { pattern: /\bdpe\b/i, keyword: 'dpe', category: 'dpe' },
  { pattern: /\baudit energetique\b/i, keyword: 'audit energetique', category: 'audit' },
  { pattern: /\bdiagnostic immobilier\b/i, keyword: 'diagnostic immobilier', category: 'general' },
  { pattern: /\bdiagnostic amiante\b/i, keyword: 'diagnostic amiante', category: 'amiante' },
  { pattern: /\bdiagnostic plomb\b/i, keyword: 'diagnostic plomb', category: 'plomb' },
  { pattern: /\bdiagnostic gaz\b/i, keyword: 'diagnostic gaz', category: 'gaz' },
  {
    pattern: /\bdiagnostic electrique\b/i,
    keyword: 'diagnostic electrique',
    category: 'electricite',
  },
  { pattern: /\bdiagnostic termites\b/i, keyword: 'diagnostic termites', category: 'termites' },
  { pattern: /\bdiagnostic carrez\b/i, keyword: 'diagnostic carrez', category: 'carrez' },
  { pattern: /\bdiagnostic erp\b/i, keyword: 'diagnostic erp', category: 'erp' },
  { pattern: /\bpassoire thermique\b/i, keyword: 'passoire thermique', category: 'dpe' },
  { pattern: /\bpassoires thermiques\b/i, keyword: 'passoires thermiques', category: 'dpe' },
  { pattern: /\bloi climat\b/i, keyword: 'loi climat resilience', category: 'reglementation' },
  { pattern: /\bre2020\b/i, keyword: 're2020', category: 'reglementation' },
  {
    pattern: /\binterdiction location\b/i,
    keyword: 'interdiction location passoire',
    category: 'reglementation',
  },
  { pattern: /\brenovation energetique\b/i, keyword: 'renovation energetique', category: 'audit' },
  { pattern: /\bmaprimerenov\b/i, keyword: 'maprimerenov', category: 'reglementation' },
  { pattern: /\bma prime renov\b/i, keyword: 'maprimerenov', category: 'reglementation' },
]

// ============================================
// Helpers
// ============================================
function normalizeKeyword(raw: string): string {
  return raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function upsertKeyword(
  supabase: SupabaseClient,
  params: {
    keywordDisplay: string
    category: string
    geoScope: string
    language: string
    intentType?: string
  },
): Promise<string> {
  const normalized = normalizeKeyword(params.keywordDisplay)

  const { data: existing, error: selectErr } = await supabase
    .from('seo_keywords')
    .select('id')
    .eq('keyword_normalized', normalized)
    .maybeSingle()

  if (selectErr && selectErr.code !== 'PGRST116') {
    throw new Error(`upsertKeyword select: ${selectErr.message}`)
  }

  if (existing && typeof existing.id === 'string') {
    await supabase
      .from('seo_keywords')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', existing.id)
    return existing.id
  }

  const insertPayload: Record<string, unknown> = {
    keyword_normalized: normalized,
    keyword_display: params.keywordDisplay,
    category: params.category,
    geo_scope: params.geoScope,
    language: params.language,
    last_seen_at: new Date().toISOString(),
  }
  if (params.intentType) insertPayload.intent_type = params.intentType

  const { data: inserted, error: insertErr } = await supabase
    .from('seo_keywords')
    .insert(insertPayload)
    .select('id')
    .single()

  if (insertErr || !inserted) {
    throw new Error(`upsertKeyword insert: ${insertErr?.message ?? 'unknown'}`)
  }
  return inserted.id as string
}

async function insertSignal(supabase: SupabaseClient, params: InsertSignalParams): Promise<void> {
  const { error } = await supabase.from('seo_keyword_signals').insert({
    keyword_id: params.keywordId,
    source_code: params.sourceCode,
    signal_value: params.signalValue,
    signal_type: params.signalType,
    metadata: params.metadata,
    ingestion_run_id: params.ingestionRunId,
    captured_at: new Date().toISOString(),
  })
  if (error) throw new Error(`insertSignal: ${error.message}`)
}

async function updateSeoSource(
  supabase: SupabaseClient,
  code: string,
  signalsAdded: number,
): Promise<void> {
  const { data: existing } = await supabase
    .from('seo_sources')
    .select('code, total_signals_count')
    .eq('code', code)
    .maybeSingle()

  if (existing) {
    const prev = typeof existing.total_signals_count === 'number' ? existing.total_signals_count : 0
    await supabase
      .from('seo_sources')
      .update({
        last_ingested_at: new Date().toISOString(),
        total_signals_count: prev + signalsAdded,
      })
      .eq('code', code)
  } else {
    await supabase.from('seo_sources').insert({
      code,
      last_ingested_at: new Date().toISOString(),
      total_signals_count: signalsAdded,
    })
  }
}

// ============================================
// Extraction mots-cles heuristique
// ============================================
interface ExtractedKeyword {
  keyword: string
  category: string
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS_FR.has(t))
}

function extractKeywordsFromTitle(title: string, fallbackCategory: string): ExtractedKeyword[] {
  const found: ExtractedKeyword[] = []
  const seen = new Set<string>()

  // 1. Bigrams metier fixes (priorite haute)
  for (const target of TARGET_BIGRAMS) {
    if (target.pattern.test(title)) {
      const norm = normalizeKeyword(target.keyword)
      if (!seen.has(norm)) {
        seen.add(norm)
        found.push({ keyword: target.keyword, category: target.category })
      }
    }
  }

  // 2. Si rien trouve, fallback : prendre 2-3 mots-cles unigrams pertinents
  if (found.length === 0) {
    const tokens = tokenize(title)
    const filtered = tokens.filter((t) =>
      /^(dpe|amiante|plomb|gaz|electricite|termites|carrez|erp|audit|energetique|diagnostic|renovation|passoire|thermique|climat|location|copropriete)$/i.test(
        t,
      ),
    )
    for (const t of filtered.slice(0, 2)) {
      if (!seen.has(t)) {
        seen.add(t)
        found.push({ keyword: t, category: fallbackCategory })
      }
    }
  }

  return found
}

// ============================================
// NewsAPI fetch
// ============================================
async function fetchNewsApi(
  query: string,
  fromDate: string,
  apiKey: string,
): Promise<{ ok: boolean; articles: NewsApiArticle[]; status: number }> {
  const url =
    'https://newsapi.org/v2/everything' +
    `?q=${encodeURIComponent(query)}` +
    `&language=fr` +
    `&from=${fromDate}` +
    `&pageSize=20` +
    `&apiKey=${encodeURIComponent(apiKey)}`

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      return { ok: false, articles: [], status: res.status }
    }
    const json = (await res.json()) as NewsApiResponse
    if (json.status !== 'ok' || !Array.isArray(json.articles)) {
      return { ok: false, articles: [], status: res.status }
    }
    return { ok: true, articles: json.articles, status: 200 }
  } catch {
    return { ok: false, articles: [], status: 0 }
  }
}

function mockArticles(query: string, count: number): NewsApiArticle[] {
  const articles: NewsApiArticle[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const publishedAt = new Date(now.getTime() - i * 86400000).toISOString()
    articles.push({
      source: { id: null, name: 'Mock Source' },
      author: 'Mock Author',
      title: `Mock article ${i + 1}: ${query}`,
      description: `Description factice pour la requete "${query}"`,
      url: `https://mock.example.com/article-${i + 1}`,
      urlToImage: null,
      publishedAt,
      content: null,
    })
  }
  return articles
}

// ============================================
// Handler
// ============================================
Deno.serve(async (req) => {
  const t0 = Date.now()

  const authHeader = req.headers.get('Authorization') ?? ''
  const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const isServiceRole = serviceKey && authHeader === `Bearer ${serviceKey}`
  const isCron = cronSecret && cronSecretHeader === cronSecret

  if (!isServiceRole && !isCron) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: 'missing supabase env' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const apiKey = Deno.env.get('NEWSAPI_API_KEY') ?? ''
  const mockMode = !apiKey

  // 30 derniers jours
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const ingestionRunId = crypto.randomUUID()
  const stats: IngestStats = {
    ok: true,
    queriesProcessed: 0,
    articlesParsed: 0,
    signalsCreated: 0,
    keywordsCreated: 0,
    mockMode,
    durationMs: 0,
    errors: 0,
  }

  try {
    for (const { query, category } of SEARCH_QUERIES) {
      let articles: NewsApiArticle[] = []

      if (mockMode) {
        articles = mockArticles(query, 5)
      } else {
        const result = await fetchNewsApi(query, fromDate, apiKey)
        if (!result.ok) {
          stats.errors += 1
          // Throttle entre requetes meme en cas d'echec
          await sleep(1000)
          continue
        }
        articles = result.articles
      }

      stats.queriesProcessed += 1

      for (const article of articles) {
        stats.articlesParsed += 1

        if (!article.title) continue

        const extracted = extractKeywordsFromTitle(article.title, category)
        if (extracted.length === 0) continue

        const metadata: Record<string, unknown> = {
          article_url: article.url,
          published_at: article.publishedAt,
          source_name: article.source?.name ?? 'unknown',
          query_origin: query,
          mock: mockMode,
        }

        for (const kw of extracted) {
          try {
            const id = await upsertKeyword(supabase, {
              keywordDisplay: kw.keyword,
              category: kw.category,
              geoScope: 'national',
              language: 'fr',
            })
            stats.keywordsCreated += 1

            await insertSignal(supabase, {
              keywordId: id,
              sourceCode: 'newsapi',
              signalValue: 1,
              signalType: 'news_mention',
              metadata,
              ingestionRunId,
            })
            stats.signalsCreated += 1
          } catch (err) {
            stats.errors += 1
            console.error(
              `Keyword ${kw.keyword} (article ${article.url}) erreur:`,
              (err as Error).message,
            )
          }
        }
      }

      // NewsAPI Developer plan : 100 req/jour, soft throttle 1s entre queries
      if (!mockMode) await sleep(1000)
    }

    await updateSeoSource(supabase, 'newsapi', stats.signalsCreated)
  } catch (err) {
    stats.ok = false
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message, stats }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  stats.durationMs = Date.now() - t0

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
