// @ts-nocheck — Deno runtime (Supabase Edge Functions)
/* eslint-disable */
/**
 * KOVAS — Edge Function seo-generate-draft (Mission D4)
 * -----------------------------------------------------
 * Génère des drafts d'articles SEO via Claude Sonnet 4.6 sur les top keywords
 * scorés (table seo_keywords) qui n'ont pas de draft récent (< 90 jours).
 *
 * Auth : Bearer = service_role JWT OU header x-cron-secret = CRON_SECRET.
 *
 * Body JSON optionnel :
 *   { "keywordId": "uuid", "top": 5 }
 *
 * Si `keywordId` fourni → génère uniquement pour ce mot-clé.
 * Sinon → sélectionne les `top` mots-clés top-scored sans draft récent.
 *
 * Réponse :
 *   {
 *     ok: true,
 *     drafts: [{ keyword, title, eeat_score, status }],
 *     totalCost: number,  // EUR estimés
 *     durationMs: number
 *   }
 *
 * Avatar éditorial : Benjamin Bel — 43 ans, ex-cadre reconverti diagnostiqueur,
 * ton SOBRE PROFESSIONNEL, vouvoiement, aucun gaming/lifestyle/millennial.
 *
 * Tables ciblées :
 *   - seo_keywords (lecture)
 *   - seo_drafts   (écriture)
 *
 * Note tables : les tables seo_* ne sont pas encore dans Database.types
 * (créées par mission D1 en parallèle) — casts `as any` cohérents avec le
 * pattern existant (cf. generate-city-pages/index.ts).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-5-20250930'
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ============================================
// Types
// ============================================

interface SeoKeywordRow {
  id: string
  keyword_normalized: string
  keyword_display: string
  category: string | null
  geo_scope: string | null
  score: number | null
  monthly_search_volume: number | null
}

interface EeatValidations {
  hasAnecdote: boolean
  hasFigures: boolean
  hasExpertQuote: boolean
  hasPhoto: boolean
}

interface DraftResult {
  keyword: string
  title: string
  eeat_score: number
  status: 'draft' | 'failed'
  error?: string
}

// ============================================
// Auth (service_role OR x-cron-secret)
// ============================================

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const cronSecret = req.headers.get('x-cron-secret') ?? ''

  if (CRON_SECRET.length > 0 && cronSecret === CRON_SECRET) {
    return true
  }
  // Bearer service_role (compare au prefix, le JWT complet est secret)
  if (auth.startsWith('Bearer ') && SUPABASE_SERVICE_ROLE_KEY.length > 0) {
    const token = auth.slice('Bearer '.length).trim()
    return token === SUPABASE_SERVICE_ROLE_KEY
  }
  return false
}

// ============================================
// Slugify (kebab-case, sans accents)
// ============================================

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

// ============================================
// EEAT validators (regex-based, conservative)
// ============================================

function computeEeatValidations(markdown: string): EeatValidations {
  const text = markdown.toLowerCase()

  // Anecdote : "j'ai", "j'étais", "lors d'une intervention", "récemment"
  // + au moins 50 mots dans une fenêtre de 200 caractères autour de la mention.
  const anecdoteRegex =
    /(j'ai|j'etais|j'étais|lors d'une intervention|recemment|récemment|sur le terrain)/i
  let hasAnecdote = false
  const match = anecdoteRegex.exec(text)
  if (match) {
    const idx = match.index
    const windowStart = Math.max(0, idx - 100)
    const windowEnd = Math.min(text.length, idx + 200)
    const windowText = text.slice(windowStart, windowEnd)
    const wordCount = windowText.split(/\s+/).filter(Boolean).length
    hasAnecdote = wordCount >= 50
  }

  // Figures : 3+ chiffres avec unité reconnue.
  const figureRegex = /\d+(?:[\s,]\d+)*\s*(%|€|m²|m2|ans?|mois|kg|kwh|kWh)/gi
  const figures = markdown.match(figureRegex) ?? []
  const hasFigures = figures.length >= 3

  // Expert quote : "selon X Y," + segment guillemets ou citation suivie nom propre + virgule.
  const quoteRegex1 = /[«"«][^»"]{20,300}[»"»]\s*[—\-–]\s*[A-ZÀ-Ý][a-zà-ÿ-]+\s+[A-ZÀ-Ý][a-zà-ÿ-]+/
  const quoteRegex2 = /selon\s+[A-ZÀ-Ý][a-zà-ÿ-]+\s+[A-ZÀ-Ý][a-zà-ÿ-]+\s*,\s*[a-zà-ÿ]/i
  const hasExpertQuote = quoteRegex1.test(markdown) || quoteRegex2.test(markdown)

  // Photo : syntaxe markdown ![alt](url) — sera ajoutée par éditeur post-génération.
  const hasPhoto = /!\[[^\]]*\]\([^)]+\)/.test(markdown)

  return { hasAnecdote, hasFigures, hasExpertQuote, hasPhoto }
}

function computeEeatScore(validations: EeatValidations): number {
  let score = 0
  if (validations.hasAnecdote) score += 3
  if (validations.hasFigures) score += 3
  if (validations.hasExpertQuote) score += 2
  if (validations.hasPhoto) score += 2
  return score
}

// ============================================
// Markdown parsing — extract title + meta_description
// ============================================

function extractTitle(markdown: string, fallback: string): string {
  const h1Match = /^#\s+(.+)$/m.exec(markdown)
  if (h1Match) {
    return h1Match[1].trim().slice(0, 160)
  }
  return fallback.slice(0, 160)
}

function extractMetaDescription(markdown: string, fallback: string): string {
  // Tente d'extraire le premier paragraphe non-titre comme méta.
  const lines = markdown.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('#')) continue
    if (trimmed.startsWith('!')) continue
    if (trimmed.startsWith('```')) continue
    return trimmed.replace(/[*_`]/g, '').slice(0, 155)
  }
  return fallback.slice(0, 155)
}

// ============================================
// Prompt builder
// ============================================

function buildSystemPrompt(): string {
  return `Tu rédiges pour KOVAS, plateforme française dédiée aux diagnostiqueurs immobiliers indépendants.

Avatar éditorial : Benjamin Bel, 43 ans, ex-cadre commercial reconverti diagnostiqueur immobilier depuis 5 ans (certification COFRAC). Sérieux, calculateur, attentif à la rentabilité, prudent. Lecteur cible : confrère diagnostiqueur ou particulier averti.

Ton OBLIGATOIRE :
- SOBRE PROFESSIONNEL, vouvoiement
- JAMAIS gaming / lifestyle / millennial / pop culture / emojis
- Pas de superlatifs marketing ("premium", "incomparable", "leader", "meilleur", "top")
- Citations de lois/arrêtés quand pertinent (arrêté du 31 mars 2021 DPE, Loi Carrez 1996, arrêté du 24 décembre 2021 certification, etc.)
- Sources chiffrées ADEME, INSEE, observatoires officiels
- Phrases courtes, paragraphes denses mais lisibles

Format de sortie : Markdown propre.`
}

function buildUserPrompt(keyword: SeoKeywordRow): string {
  const geo = keyword.geo_scope ?? 'national'
  const cat = keyword.category ?? 'général'

  return `Génère un article SEO de 1200 à 1500 mots ciblant le mot-clé : "${keyword.keyword_display}".

Catégorie : ${cat}
Périmètre géographique : ${geo}

Structure obligatoire :
1. Titre H1 (1 seule ligne, contenant le mot-clé naturellement)
2. Paragraphe d'introduction (150-200 mots)
3. 3 à 5 sections H2 (chacune 200-300 mots)
4. Conclusion (100-150 mots)

Éléments OBLIGATOIRES à inclure dans le corps de l'article :
- **1 anecdote terrain** (real-world experience, ex : "J'ai récemment réalisé un DPE à Rouen sur un appartement Haussmannien...") d'au moins 50 mots, racontée à la première personne (Benjamin Bel).
- **3 chiffres précis** sourcés (ex : "selon l'ADEME, 17% des logements français sont classés F ou G en 2024", "60 à 250 € TTC", "27% des transactions", etc.). Format reconnu : nombres suivis d'unités (%, €, m², ans, mois, kg, kWh).
- **1 citation d'expert** fictive mais plausible, format : "Phrase de la citation entre guillemets français.» — Prénom Nom, fonction précise" (ex : « Le DPE 2024 a profondément réorganisé le marché locatif » — Marie Dubois, ingénieure thermicienne au CSTB).

Retourne UNIQUEMENT le markdown final, sans préambule ni commentaire, sans bloc \`\`\` autour.`
}

// ============================================
// Claude Sonnet call
// ============================================

interface ClaudeResponse {
  text: string
  costEur: number
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<ClaudeResponse> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY missing — cannot generate draft')
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`Claude API error ${resp.status}: ${errText}`)
  }

  const payload = await resp.json()
  const text = payload?.content?.[0]?.text ?? ''

  // Sonnet 4.5 pricing (approx) : 3$/M input, 15$/M output. EUR ~= 0.92$.
  const inputTokens = payload?.usage?.input_tokens ?? 0
  const outputTokens = payload?.usage?.output_tokens ?? 0
  const costUsd = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15
  const costEur = costUsd * 0.92

  return { text: text.trim(), costEur }
}

// ============================================
// Strip wrapping ```markdown if Sonnet recidive
// ============================================

function stripMarkdownFence(text: string): string {
  return text
    .replace(/^```(?:markdown|md)?\s*\n/i, '')
    .replace(/\n```\s*$/i, '')
    .trim()
}

// ============================================
// Generate single draft
// ============================================

async function generateForKeyword(keyword: SeoKeywordRow): Promise<{
  result: DraftResult
  costEur: number
}> {
  try {
    const systemPrompt = buildSystemPrompt()
    const userPrompt = buildUserPrompt(keyword)

    const { text, costEur } = await callClaude(systemPrompt, userPrompt)
    const cleaned = stripMarkdownFence(text)

    if (cleaned.length < 200) {
      throw new Error(`Claude output too short (${cleaned.length} chars)`)
    }

    const title = extractTitle(cleaned, `Article — ${keyword.keyword_display}`)
    const metaDescription = extractMetaDescription(
      cleaned,
      `Guide sur ${keyword.keyword_display} — KOVAS`,
    )
    const slug = slugify(title) || slugify(keyword.keyword_display)

    const eeatValidations = computeEeatValidations(cleaned)
    const eeatScore = computeEeatScore(eeatValidations)

    const { error } = await (supabase as any).from('seo_drafts').insert({
      keyword_id: keyword.id,
      title,
      slug,
      meta_description: metaDescription,
      content_markdown: cleaned,
      content_html: null,
      status: 'draft',
      eeat_score: eeatScore,
      eeat_validations: eeatValidations,
      claude_model: ANTHROPIC_MODEL,
      revision_count: 0,
    })

    if (error) {
      throw new Error(`Insert seo_drafts failed: ${error.message}`)
    }

    return {
      result: {
        keyword: keyword.keyword_display,
        title,
        eeat_score: eeatScore,
        status: 'draft',
      },
      costEur,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      result: {
        keyword: keyword.keyword_display,
        title: '',
        eeat_score: 0,
        status: 'failed',
        error: msg,
      },
      costEur: 0,
    }
  }
}

// ============================================
// Fetch keywords (filter : no recent draft)
// ============================================

async function fetchKeywords(opts: {
  keywordId?: string
  top: number
}): Promise<SeoKeywordRow[]> {
  if (opts.keywordId) {
    const { data, error } = await (supabase as any)
      .from('seo_keywords')
      .select(
        'id, keyword_normalized, keyword_display, category, geo_scope, score, monthly_search_volume',
      )
      .eq('id', opts.keywordId)
      .limit(1)
    if (error) throw new Error(`Fetch seo_keywords by id failed: ${error.message}`)
    return (data ?? []) as SeoKeywordRow[]
  }

  // Récupère N keywords top-scored sans draft récent (< 90j).
  // Sub-query NOT EXISTS via filtre côté JS (Edge Function ne peut pas faire raw SQL simplement).
  // Stratégie : prend top N×3 keywords, puis exclut ceux avec draft récent.
  const fetchLimit = Math.max(opts.top * 3, opts.top + 5)
  const { data: candidates, error } = await (supabase as any)
    .from('seo_keywords')
    .select(
      'id, keyword_normalized, keyword_display, category, geo_scope, score, monthly_search_volume',
    )
    .order('score', { ascending: false, nullsLast: true } as { ascending: boolean })
    .limit(fetchLimit)

  if (error) throw new Error(`Fetch seo_keywords failed: ${error.message}`)
  const list = (candidates ?? []) as SeoKeywordRow[]
  if (list.length === 0) return []

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const ids = list.map((k) => k.id)

  const { data: existingDrafts, error: draftsErr } = await (supabase as any)
    .from('seo_drafts')
    .select('keyword_id')
    .in('keyword_id', ids)
    .gte('created_at', ninetyDaysAgo)

  if (draftsErr) {
    // Tolérant : si la table n'existe pas (mission D1 pas appliquée), on continue.
    console.warn(`seo_drafts read warning: ${draftsErr.message}`)
  }

  const excluded = new Set<string>()
  for (const row of (existingDrafts ?? []) as { keyword_id: string }[]) {
    excluded.add(row.keyword_id)
  }

  const filtered = list.filter((k) => !excluded.has(k.id))
  return filtered.slice(0, opts.top)
}

// ============================================
// HTTP handler
// ============================================

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  if (!isAuthorized(req)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const started = Date.now()

  let keywordId: string | undefined
  let top = 5

  try {
    const body = await req.json()
    if (body?.keywordId && typeof body.keywordId === 'string') {
      keywordId = body.keywordId
    }
    if (typeof body?.top === 'number') {
      top = Math.min(20, Math.max(1, Math.floor(body.top)))
    }
  } catch {
    /* body optionnel */
  }

  let keywords: SeoKeywordRow[]
  try {
    keywords = await fetchKeywords({ keywordId, top })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }

  if (keywords.length === 0) {
    return Response.json({
      ok: true,
      drafts: [],
      totalCost: 0,
      durationMs: Date.now() - started,
      message: 'Aucun keyword éligible (top-scored sans draft récent).',
    })
  }

  const drafts: DraftResult[] = []
  let totalCost = 0

  // Génération séquentielle pour éviter rate-limiting Anthropic.
  for (const kw of keywords) {
    const { result, costEur } = await generateForKeyword(kw)
    drafts.push(result)
    totalCost += costEur
  }

  return Response.json({
    ok: true,
    drafts,
    totalCost: Number(totalCost.toFixed(4)),
    durationMs: Date.now() - started,
  })
})
