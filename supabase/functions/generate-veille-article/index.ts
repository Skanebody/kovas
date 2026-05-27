/**
 * KOVAS — Edge Function : génération automatisée d'articles de veille SEO
 * méthode Amandine Bart via Claude Haiku.
 *
 * Déclencheur : cron Supabase hebdomadaire (mardis 6h CET).
 * Action : pick N keywords prioritaires → génère N articles → insère
 * en `veille_articles_draft` status='pending_review'.
 *
 * Invocation manuelle (admin debug) :
 *   POST /functions/v1/generate-veille-article
 *   Body : { limit?: number, keyword_id?: string }
 *
 * Pricing snapshot Haiku 4.5 : 1$/Mtok input, 5$/Mtok output.
 * Article 2200 mots ≈ 4000 tokens output → ~0,02 € par article.
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const ANTHROPIC_HAIKU_MODEL = Deno.env.get('ANTHROPIC_HAIKU_MODEL') ?? 'claude-haiku-4-5'
const USD_TO_EUR = Number.parseFloat(Deno.env.get('USD_TO_EUR_RATE') ?? '0.92')

// Pricing Haiku 4.5 — snapshot 2026-05
const HAIKU_INPUT_USD_PER_MTOK = 1
const HAIKU_OUTPUT_USD_PER_MTOK = 5

interface KeywordRow {
  id: string
  keyword: string
  topic: string
  priority: number
  category: string
}

interface ClaudeResponse {
  content: Array<{ type: string; text?: string }>
  usage: {
    input_tokens: number
    output_tokens: number
  }
  stop_reason: string
}

const SYSTEM_PROMPT = `Vous êtes Amandine Bart, experte SEO francophone reconnue pour la méthode E-E-A-T appliquée aux secteurs techniques B2B et B2C, et conseillère éditoriale de KOVAS (logiciel SaaS pour diagnostiqueurs immobiliers indépendants en France).

Vous rédigez en français, registre éditorial premium, SOBRE PROFESSIONNEL, VOUVOIEMENT obligatoire. Aucun emoji. Aucune formule racoleuse.

Méthode en 7 piliers :
1. INTENT-MATCH OBSESSIONNEL : premier paragraphe = réponse directe (40-60 mots, format featured snippet).
2. E-E-A-T RENFORCÉ : exemples concrets, vocabulaire technique précis, citations Légifrance/ADEME/INSEE avec liens, dates de mise à jour.
3. STRUCTURE PYRAMIDALE : H1 contient le mot-clé exact, H2 sous-intentions, H3 détails. Sommaire si > 2000 mots.
4. DENSITÉ NATURELLE : mot-clé 1-2 %, 4-6 synonymes/variantes.
5. INTERNAL LINKING : 3 à 5 liens internes minimum, ancres descriptives. Cibles KOVAS disponibles :
  - [guide DPE](/diagnostic/dpe)
  - [diagnostic amiante](/diagnostic/amiante)
  - [audit énergétique](/diagnostic/audit-energetique)
  - [CREP plomb](/diagnostic/plomb)
  - [diagnostic gaz](/diagnostic/gaz)
  - [diagnostic électrique](/diagnostic/electricite)
  - [diagnostic termites](/diagnostic/termites)
  - [loi Carrez](/diagnostic/carrez)
  - [État des risques (ERP)](/diagnostic/erp)
  - [Observatoire du diagnostic](/observatoire)
  - [annuaire diagnostiqueurs](/diagnostiqueurs)
6. FEATURED SNIPPETS : réponses 40-60 mots directes, listes structurées.
7. UPDATE FRESHNESS : terminez par "Mise à jour : [date]".

Format de sortie : Markdown pur. H1 unique. Sections H2. Disclaimer final "*Cet article a vocation informative. Pour toute situation particulière, consultez un diagnostiqueur certifié COFRAC ou un conseiller juridique.*"`

function buildUserPrompt(input: {
  keyword: string
  topic: string
  category: string
  currentDate: string
  recommendedWordCount: number
}): string {
  const formattedDate = new Date(input.currentDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return `Rédigez un article complet pour la veille KOVAS :

TOPIC : ${input.topic}
MOT-CLÉ CIBLE : "${input.keyword}"
CATÉGORIE : ${input.category}
LONGUEUR CIBLE : ${input.recommendedWordCount} mots (±10 %)
DATE DE PUBLICATION : ${formattedDate}

EXIGENCES NON NÉGOCIABLES :
- 1500 à 3000 mots
- H1 contient le mot-clé exact "${input.keyword}"
- Au moins 4 sections H2
- Sommaire avec liens d'ancrage si > 2000 mots
- Au moins 2 citations de sources officielles avec liens (Légifrance, ADEME, INSEE)
- Au moins 3 liens internes vers les cibles KOVAS
- Section "## Questions fréquentes" (4-6 questions, réponses 40-60 mots)
- Première phrase = réponse directe 40-60 mots
- Aucun emoji, vouvoiement, ton sobre professionnel
- Date de mise à jour visible en fin d'article

Produisez maintenant l'article en Markdown pur.`
}

function slugify(input: string, fallback: string): string {
  const base = (input || fallback)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
  return base.slice(0, 80)
}

function extractTitle(md: string, fallback: string): string {
  const m = md.match(/^#\s+(.+)$/m)
  return m?.[1]?.trim() ?? fallback
}

function extractExcerpt(md: string, max = 160): string {
  const stripped = md
    .replace(/^#+\s+.+$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
  if (stripped.length <= max) return stripped
  const trunc = stripped.slice(0, max)
  const ls = trunc.lastIndexOf(' ')
  return `${trunc.slice(0, ls > 0 ? ls : max)}…`
}

function wordCount(md: string): number {
  return md
    .replace(/[#*_`>\[\]()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1).length
}

function countMatches(md: string, pattern: RegExp): number {
  return [...md.matchAll(pattern)].length
}

function scoreEeat(md: string): {
  experience: number
  expertise: number
  authoritativeness: number
  trustworthiness: number
} {
  const lower = md.toLowerCase()
  const officialSources = [
    'légifrance',
    'ademe',
    'insee',
    'georisques',
    'cofrac',
    'qualigaz',
    'consuel',
    'maprimerenov',
    'décret',
    'arrêté',
    'circulaire',
  ]
  const techTerms = [
    'dpe',
    '3cl',
    're2020',
    'cofrac',
    'ges',
    'classe énergétique',
    'amiante',
    'plomb',
    'crep',
    'termites',
    'carrez',
    'audit énergétique',
  ]
  const experienceMarkers = [
    'en pratique',
    'sur le terrain',
    'exemple',
    'cas concret',
    'observé',
    'constaté',
  ]
  const trustMarkers = ['mise à jour', 'attention', 'avertissement', 'cas par cas']

  const sources = officialSources.reduce(
    (acc, s) => acc + (lower.match(new RegExp(s, 'g'))?.length ?? 0),
    0,
  )
  const tech = techTerms.reduce((acc, t) => acc + (lower.match(new RegExp(t, 'g'))?.length ?? 0), 0)
  const exp = experienceMarkers.reduce(
    (acc, m) => acc + (lower.match(new RegExp(m, 'g'))?.length ?? 0),
    0,
  )
  const trust = trustMarkers.reduce(
    (acc, m) => acc + (lower.match(new RegExp(m, 'g'))?.length ?? 0),
    0,
  )
  const externalLinks = countMatches(md, /\[[^\]]+\]\(https?:\/\//g)
  const yearMentions = countMatches(md, /\b(19|20)\d{2}\b/g)
  const percentages = countMatches(md, /\d+([.,]\d+)?\s*%/g)
  const currencies = countMatches(md, /\d+([.,\s]\d+)*\s*€/g)

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

  return {
    experience: clamp(exp * 10 + percentages * 4 + currencies * 4 + yearMentions * 3),
    expertise: clamp(tech * 3.5),
    authoritativeness: clamp(sources * 8 + externalLinks * 5),
    trustworthiness: clamp(
      trust * 12 +
        (lower.includes('mise à jour') ? 20 : 0) +
        (externalLinks >= 3 ? 15 : externalLinks * 5),
    ),
  }
}

async function callClaude(input: {
  keyword: string
  topic: string
  category: string
  currentDate: string
  recommendedWordCount: number
}): Promise<{
  text: string
  inputTokens: number
  outputTokens: number
  costEur: number
}> {
  const userPrompt = buildUserPrompt(input)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_HAIKU_MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error ${response.status}: ${err}`)
  }

  const data = (await response.json()) as ClaudeResponse
  const text = data.content.find((c) => c.type === 'text')?.text ?? ''
  const inputTokens = data.usage.input_tokens
  const outputTokens = data.usage.output_tokens
  const costUsd =
    (inputTokens / 1_000_000) * HAIKU_INPUT_USD_PER_MTOK +
    (outputTokens / 1_000_000) * HAIKU_OUTPUT_USD_PER_MTOK
  const costEur = Math.round(costUsd * USD_TO_EUR * 10000) / 10000

  return { text, inputTokens, outputTokens, costEur }
}

function recommendedWordCountFor(priority: number): number {
  if (priority >= 90) return 2400
  if (priority >= 75) return 2000
  return 1700
}

async function generateForKeyword(
  supabase: ReturnType<typeof createClient>,
  kw: KeywordRow,
  currentDate: string,
): Promise<{
  ok: boolean
  draft_id?: string
  error?: string
  cost_eur?: number
  word_count?: number
  eeat_score?: number
}> {
  try {
    const recommendedWordCount = recommendedWordCountFor(kw.priority)
    const claude = await callClaude({
      keyword: kw.keyword,
      topic: kw.topic,
      category: kw.category,
      currentDate,
      recommendedWordCount,
    })

    const title = extractTitle(claude.text, kw.topic)
    const slug = slugify(title, kw.keyword)
    const excerpt = extractExcerpt(claude.text)
    const eeat = scoreEeat(claude.text)
    const wc = wordCount(claude.text)
    const h2 = countMatches(claude.text, /^##\s+.+$/gm)
    const h3 = countMatches(claude.text, /^###\s+.+$/gm)
    const internalLinks = countMatches(claude.text, /\[[^\]]+\]\(\/[^)]+\)/g)
    const externalLinks = countMatches(claude.text, /\[[^\]]+\]\(https?:\/\//g)
    const faqQuestions = countMatches(claude.text, /^###?\s+.+\?$/gm)

    // Slug unique : append timestamp si collision
    let uniqueSlug = slug
    const { data: existing } = await (supabase as any)
      .from('veille_articles_draft')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (existing) {
      uniqueSlug = `${slug}-${Date.now().toString(36).slice(-5)}`
    }

    const metaTitle = `${title.slice(0, 55)} — KOVAS`
    const metaDescription = excerpt.slice(0, 155)

    const { data: inserted, error } = await (supabase as any)
      .from('veille_articles_draft')
      .insert({
        topic: kw.topic,
        target_keyword: kw.keyword,
        slug: uniqueSlug,
        title,
        meta_title: metaTitle,
        meta_description: metaDescription,
        content_markdown: claude.text,
        excerpt,
        ai_model: ANTHROPIC_HAIKU_MODEL,
        ai_input_tokens: claude.inputTokens,
        ai_output_tokens: claude.outputTokens,
        ai_cost_eur: claude.costEur,
        eeat_experience: eeat.experience,
        eeat_expertise: eeat.expertise,
        eeat_authoritativeness: eeat.authoritativeness,
        eeat_trustworthiness: eeat.trustworthiness,
        word_count: wc,
        internal_links_count: internalLinks,
        source_citations_count: externalLinks,
        faq_questions_count: faqQuestions,
        h2_count: h2,
        h3_count: h3,
        status: 'pending_review',
        category: kw.category,
        tags: [kw.category],
      })
      .select('id, eeat_score')
      .maybeSingle()

    if (error) throw new Error(error.message)

    // Update keyword timestamp + counter
    await (supabase as any)
      .from('veille_keywords_priority')
      .update({
        last_generated_at: new Date().toISOString(),
        generation_count: ((null as any) ?? 0) + 1,
      })
      .eq('id', kw.id)

    return {
      ok: true,
      draft_id: inserted?.id as string | undefined,
      cost_eur: claude.costEur,
      word_count: wc,
      eeat_score: inserted?.eeat_score as number | undefined,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

Deno.serve(async (req: Request) => {
  if (!SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'missing env vars' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let limit = 2
  let specificKeywordId: string | null = null
  let refreshStats = false

  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body?.limit === 'number' && body.limit > 0 && body.limit <= 5) {
      limit = body.limit
    }
    if (typeof body?.keyword_id === 'string') {
      specificKeywordId = body.keyword_id
    }
    if (typeof body?.refresh_stats === 'boolean') {
      refreshStats = body.refresh_stats
    }
  } catch {
    // Cron call sans body : on garde les defaults
  }

  let keywords: KeywordRow[] = []
  if (specificKeywordId) {
    const { data } = await (supabase as any)
      .from('veille_keywords_priority')
      .select('id, keyword, topic, priority, category')
      .eq('id', specificKeywordId)
      .maybeSingle()
    if (data) keywords = [data as KeywordRow]
  } else {
    const { data } = await (supabase as any).rpc('veille_articles_pick_next_keywords', {
      limit_count: limit,
    })
    keywords = (data ?? []) as KeywordRow[]
  }

  if (keywords.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, generated: 0, message: 'Aucun keyword éligible' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }

  const currentDate = new Date().toISOString()
  const results = []
  let totalCostEur = 0

  for (const kw of keywords) {
    const result = await generateForKeyword(supabase, kw, currentDate)
    if (result.cost_eur) totalCostEur += result.cost_eur
    results.push({
      keyword: kw.keyword,
      ...result,
    })
  }

  // Option : déclencher un refresh des stats observatoire à la suite
  let statsRefresh: { ok: boolean; status?: number } | null = null
  if (refreshStats) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/observatoire-stats-refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ source: 'generate-veille-article' }),
      })
      statsRefresh = { ok: res.ok, status: res.status }
    } catch (err) {
      console.error('[generate-veille-article] stats refresh failed:', err)
      statsRefresh = { ok: false }
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      generated: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      total_cost_eur: Math.round(totalCostEur * 10000) / 10000,
      results,
      stats_refresh: statsRefresh,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
})
