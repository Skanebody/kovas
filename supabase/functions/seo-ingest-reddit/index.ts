// ============================================
// KOVAS SEO — Edge Function : seo-ingest-reddit
//
// Mission : ingerer les signaux community Reddit FR sur la thematique
//   diagnostic immobilier. Lit /r/${sub}/hot.json sur 5 subreddits, filtre
//   les posts contenant des mots-cles metier, et upsert keywords +
//   signaux community_mention (signal_value = post.score Reddit).
//
// Auth   : Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY} OU header
//          x-cron-secret: ${CRON_SECRET}
// Trigger: pg_cron quotidien.
//
// Sources / couts API :
//   - Reddit JSON public : https://www.reddit.com/r/${sub}/hot.json
//   - User-Agent obligatoire (anti rate-limit), 60 req/min anonymous.
//   - Pas de cle requise.
//
// Variables env : aucune (API publique).
// ============================================

import { type SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

// ============================================
// Types
// ============================================
interface RedditPostData {
  id: string
  title: string
  selftext: string
  score: number
  num_comments: number
  subreddit: string
  created_utc: number
  permalink: string
  author: string
  ups: number
  downs: number
}

interface RedditListingChild {
  kind: string
  data: RedditPostData
}

interface RedditListingResponse {
  kind: string
  data: {
    after: string | null
    before: string | null
    children: RedditListingChild[]
  }
}

interface IngestStats {
  ok: boolean
  subreddits: number
  postsParsed: number
  signalsCreated: number
  keywordsCreated: number
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
// 5 subreddits cibles
// ============================================
const TARGET_SUBREDDITS: ReadonlyArray<string> = [
  'ImmobilierFR',
  'france',
  'AskFrance',
  'ImmobilierConseil',
  'LegalAdviceFR',
]

// User-Agent obligatoire
const REDDIT_USER_AGENT = 'KOVAS-SEO-Crawler/1.0 (contact@kovas.fr)'

// ============================================
// Filtre mots-cles metier
// ============================================
const KEYWORD_FILTER_REGEX =
  /\b(dpe|diagnostic|amiante|plomb|carrez|erp|electricit[eé]|gaz|termites|audit|passoire|thermique|renovation|energetique|certificat|loi climat|maprimerenov|ma prime renov)\b/i

const TARGET_PATTERNS: ReadonlyArray<{ pattern: RegExp; keyword: string; category: string }> = [
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
  { pattern: /\bcarrez\b/i, keyword: 'loi carrez', category: 'carrez' },
  { pattern: /\berp\b/i, keyword: 'erp etat des risques', category: 'erp' },
  { pattern: /\bamiante\b/i, keyword: 'amiante', category: 'amiante' },
  { pattern: /\bplomb\b/i, keyword: 'plomb', category: 'plomb' },
  { pattern: /\btermites\b/i, keyword: 'termites', category: 'termites' },
  { pattern: /\bpassoire thermique\b/i, keyword: 'passoire thermique', category: 'dpe' },
  { pattern: /\bpassoires thermiques\b/i, keyword: 'passoires thermiques', category: 'dpe' },
  { pattern: /\bloi climat\b/i, keyword: 'loi climat resilience', category: 'reglementation' },
  { pattern: /\bmaprimerenov\b/i, keyword: 'maprimerenov', category: 'reglementation' },
  { pattern: /\bma prime renov\b/i, keyword: 'maprimerenov', category: 'reglementation' },
  { pattern: /\brenovation energetique\b/i, keyword: 'renovation energetique', category: 'audit' },
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
// Sentiment analysis basique : Reddit "score" est deja un proxy net
// ups - downs. On l'utilise comme indicateur principal :
//   - score > 10  → 'positive'
//   - score >= 0  → 'neutral'
//   - score < 0   → 'negative'
// ============================================
function classifySentiment(score: number): 'positive' | 'neutral' | 'negative' {
  if (score > 10) return 'positive'
  if (score >= 0) return 'neutral'
  return 'negative'
}

// ============================================
// Extraction mots-cles d'un post
// ============================================
interface ExtractedKeyword {
  keyword: string
  category: string
}

function extractKeywords(text: string): ExtractedKeyword[] {
  const found: ExtractedKeyword[] = []
  const seen = new Set<string>()

  for (const target of TARGET_PATTERNS) {
    if (target.pattern.test(text)) {
      const norm = normalizeKeyword(target.keyword)
      if (!seen.has(norm)) {
        seen.add(norm)
        found.push({ keyword: target.keyword, category: target.category })
      }
    }
  }

  return found
}

// ============================================
// Reddit fetch
// ============================================
async function fetchSubredditHot(
  sub: string,
): Promise<{ ok: boolean; posts: RedditPostData[]; status: number }> {
  const url = `https://www.reddit.com/r/${sub}/hot.json?limit=100&t=month`

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': REDDIT_USER_AGENT,
      },
    })

    if (!res.ok) {
      return { ok: false, posts: [], status: res.status }
    }

    const json = (await res.json()) as RedditListingResponse
    const posts = (json.data?.children ?? [])
      .map((c) => c.data)
      .filter((p): p is RedditPostData => p !== undefined && p !== null)

    return { ok: true, posts, status: 200 }
  } catch {
    return { ok: false, posts: [], status: 0 }
  }
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

  const ingestionRunId = crypto.randomUUID()
  const stats: IngestStats = {
    ok: true,
    subreddits: 0,
    postsParsed: 0,
    signalsCreated: 0,
    keywordsCreated: 0,
    durationMs: 0,
    errors: 0,
  }

  try {
    for (const sub of TARGET_SUBREDDITS) {
      const result = await fetchSubredditHot(sub)
      stats.subreddits += 1

      if (!result.ok) {
        stats.errors += 1
        await sleep(1000)
        continue
      }

      for (const post of result.posts) {
        stats.postsParsed += 1

        const text = `${post.title} ${post.selftext ?? ''}`
        if (!KEYWORD_FILTER_REGEX.test(text)) continue

        const extracted = extractKeywords(text)
        if (extracted.length === 0) continue

        const sentiment = classifySentiment(post.score)
        const metadata: Record<string, unknown> = {
          subreddit: post.subreddit ?? sub,
          post_id: post.id,
          num_comments: post.num_comments,
          sentiment,
          permalink: post.permalink,
          author: post.author,
          created_utc: post.created_utc,
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

            // signal_value = score Reddit (peut etre negatif → on garde le
            // signe : un score negatif indique un sentiment defavorable
            // sur le keyword)
            await insertSignal(supabase, {
              keywordId: id,
              sourceCode: 'reddit',
              signalValue: post.score,
              signalType: 'community_mention',
              metadata,
              ingestionRunId,
            })
            stats.signalsCreated += 1
          } catch (err) {
            stats.errors += 1
            console.error(`Keyword ${kw.keyword} (post ${post.id}) erreur:`, (err as Error).message)
          }
        }
      }

      // Rate limit Reddit : 60 req/min anonymous → 1 req/s entre subs
      await sleep(1000)
    }

    await updateSeoSource(supabase, 'reddit', stats.signalsCreated)
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
