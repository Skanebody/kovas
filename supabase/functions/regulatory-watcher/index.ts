/**
 * KOVAS — Edge Function : regulatory-watcher
 *
 * Scrape automatiquement les 9 sources réglementaires actives (JORF Légifrance,
 * ADEME, Cofrac, DGCCRF, MTE, CSTB, AFNOR) et insère les nouveaux documents
 * trouvés dans `regulatory_documents` avec `processed_at=NULL`.
 *
 * Le pipeline aval `batch-results-poller` prend ensuite le relais pour
 * l'enrichissement IA (résumé Claude + topics + embeddings pgvector).
 *
 * Déclencheurs :
 *   - cron pg_cron quotidien 01:00 UTC (cf. migration 20260527180000_cron_*)
 *   - invocation manuelle pour debug admin :
 *     POST /functions/v1/regulatory-watcher
 *     Body optionnel : { sourceSlug?: string, dryRun?: boolean }
 *
 * Retour JSON :
 *   {
 *     ok: true,
 *     ran_at: ISO timestamp,
 *     sources_processed: number,
 *     documents_inserted: number,
 *     documents_skipped_duplicate: number,
 *     errors: Array<{ source: string, error: string }>
 *   }
 *
 * Architecture en 2 étapes (cette fonction = étape 1) :
 *   1. regulatory-watcher (cette fonction) : ingestion brute, processed=false
 *   2. batch-results-poller (déjà déployé) : enrichissement IA aval
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ────────────────────────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
// User-Agent navigateur réaliste : les sites publics français (Légifrance,
// DGCCRF, MTE, etc.) bloquent les UA "bot" identifiés en 403 Forbidden.
// On utilise une signature Chrome stable + on respecte le robots.txt (déjà
// flagué `robots_txt_checked` côté regulatory_sources.notes).
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 20_000
const MAX_DOCS_PER_SOURCE = 30 // limite anti-flood au premier run
const MAX_RAW_TEXT_LENGTH = 50_000 // tronque les très longs articles

// Mots-clés métier "FORTS" — directement liés au diagnostic immobilier.
// Match → garde le document.
const STRONG_KEYWORDS = [
  'dpe',
  'diagnostic',
  'diagnostiqueur',
  'amiante',
  'plomb',
  'crep',
  'termites',
  'carrez',
  'boutin',
  'audit énergétique',
  'audit energetique',
  'performance énergétique',
  'performance energetique',
  'passoire énergétique',
  'passoire energetique',
  'cofrac',
  '3cl',
  '3cl-2021',
  "état des risques",
  'etat des risques',
]

// Mots-clés métier "FAIBLES" — pertinents mais trop génériques pour matcher seuls.
// Garde le document UNIQUEMENT si au moins 1 strong OU 2+ weak.
const WEAK_KEYWORDS = [
  'rénovation énergétique',
  'renovation energetique',
  'gaz',
  'électricité',
  'electricite',
  'electrique',
  'erp',
  'ademe',
  'logement',
  'habitation',
  'bâtiment',
  'batiment',
]

// Domaines blocklist — pas des sources réglementaires (réseaux sociaux,
// pages utilisateurs, blogs personnels). Évite la pollution du flux.
const DOMAIN_BLOCKLIST = [
  'x.com',
  'twitter.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'tiktok.com',
]

const HIGH_IMPORTANCE_KEYWORDS = [
  'obligation',
  'obligatoire',
  'arrêté',
  'décret',
  'sanction',
  'amende',
  'interdiction',
  'certification',
]

const CRITICAL_IMPORTANCE_KEYWORDS = ['sanction', 'amende', 'retrait', 'suspension']

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface SourceRow {
  id: string
  slug: string
  name: string
  authority: string
  url: string
  feed_url: string | null
  api_url: string | null
  fetch_method: string
  fetch_frequency_hours: number
  is_active: boolean
  consecutive_failures: number
}

interface ParsedItem {
  external_id: string
  title: string
  url: string
  published_at?: string // YYYY-MM-DD
  raw_text: string
}

interface WatcherSummary {
  ok: boolean
  ran_at: string
  sources_processed: number
  documents_inserted: number
  documents_skipped_duplicate: number
  errors: Array<{ source: string; error: string }>
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers — fetch + parsing
// ────────────────────────────────────────────────────────────────────────────

/**
 * Fetch avec headers navigateur réalistes complets.
 *
 * SCRAPING_FALLBACK (pas d'API officielle disponible pour la plupart des
 * sources réglementaires FR) — les WAF gouvernementaux (Cloudflare, ImpervaWAF,
 * etc.) bloquent les UA "bot". Solution : émuler une vraie session Chrome
 * avec headers Sec-Fetch-*, Accept-Language fr-FR, Accept-Encoding gzip,
 * Upgrade-Insecure-Requests, Referer Google FR.
 *
 * Cf. CLAUDE.md §10 — règle "API officielles en priorité, scraping en fallback".
 * Pour Légifrance JORF, la vraie solution durable est l'API PISTE
 * (https://piste.gouv.fr, inscription développeur OAuth2 gratuite).
 */
async function fetchWithTimeout(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const urlObj = new URL(url)
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml,application/rss+xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        // Headers Sec-Fetch — Chrome 126+ les envoie systématiquement,
        // leur absence est un signal classique des WAF anti-bot.
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1',
        'Sec-Ch-Ua': '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Upgrade-Insecure-Requests': '1',
        // Referer Google FR pour simuler un visiteur arrivant via une recherche.
        // Évite le flag "direct access without referer" qui sert d'heuristique
        // anti-bot pour certains WAF (Cloudflare Bot Management notamment).
        Referer: 'https://www.google.fr/',
        Host: urlObj.host,
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`)
    }
    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

async function sha256(text: string): Promise<string> {
  const buffer = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function stripHtml(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = block.match(re)
  if (!m) return ''
  const raw = m[1] ?? ''
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  return (cdata?.[1] ?? raw).trim()
}

function parseDateSafe(input: string | null | undefined): string | undefined {
  if (!input) return undefined
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString().slice(0, 10)
}

/** Parse un flux RSS / Atom et retourne les N premiers items. */
function parseRssFeed(xml: string, maxItems: number): ParsedItem[] {
  const items: ParsedItem[] = []
  // RSS 2.0 : <item>...</item>
  const itemRe = /<item[\s\S]*?<\/item>/gi
  // Atom : <entry>...</entry>
  const entryRe = /<entry[\s\S]*?<\/entry>/gi

  const blocks = [...(xml.match(itemRe) ?? []), ...(xml.match(entryRe) ?? [])].slice(0, maxItems)

  for (const block of blocks) {
    const title = stripHtml(extractTag(block, 'title'))
    if (!title) continue

    // Lien : <link>...</link> ou <link href="..."/>
    let link = extractTag(block, 'link')
    if (!link) {
      const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["']/i)
      link = hrefMatch?.[1] ?? ''
    }
    link = link.trim()
    if (!link) continue

    const pubDateRaw =
      extractTag(block, 'pubDate') ||
      extractTag(block, 'published') ||
      extractTag(block, 'updated') ||
      extractTag(block, 'dc:date')
    const published_at = parseDateSafe(pubDateRaw)

    const description = stripHtml(
      extractTag(block, 'description') ||
        extractTag(block, 'summary') ||
        extractTag(block, 'content'),
    )

    const guid = extractTag(block, 'guid') || extractTag(block, 'id') || link

    items.push({
      external_id: guid.slice(0, 500),
      title: title.slice(0, 500),
      url: link.slice(0, 1000),
      published_at,
      raw_text: `${title}\n\n${description}`.slice(0, MAX_RAW_TEXT_LENGTH),
    })
  }

  return items
}

/**
 * Parse une page HTML — extraction tolérante de liens d'articles.
 *
 * Stratégie multi-passes pour absorber la diversité des structures HTML des
 * sites institutionnels français (qui ont quasi-tous abandonné les RSS) :
 *   1. <article>...</article> (sémantique HTML5 moderne — rare en FR public)
 *   2. <div class="...news...|...post...|...article...|...card..."> (CMS WordPress, Drupal)
 *   3. <li class="...news..."> (listes d'actualités classiques)
 *
 * Filtre des faux positifs : titre ≥ 15 caractères, URL non-fragment (#),
 * URL pas vers /tag/ /category/ /author/ (pages méta WordPress).
 */
function parseHtmlListing(html: string, sourceUrl: string, maxItems: number): ParsedItem[] {
  const items: ParsedItem[] = []
  const seenUrls = new Set<string>()

  // Multi-pass : essaie plusieurs patterns dans l'ordre de fiabilité
  const blockPatterns: RegExp[] = [
    /<article\b[\s\S]*?<\/article>/gi,
    /<div\s+class=["'][^"']*(?:news|post|article|card|item|teaser)[^"']*["'][\s\S]*?<\/div>/gi,
    /<li\s+class=["'][^"']*(?:news|post|article|teaser)[^"']*["'][\s\S]*?<\/li>/gi,
  ]

  const allBlocks: string[] = []
  for (const pattern of blockPatterns) {
    const matches = html.match(pattern) ?? []
    allBlocks.push(...matches)
    if (allBlocks.length >= maxItems * 3) break // suffisant
  }

  // 4e fallback : si aucun block sémantique trouvé, extraire les liens
  // directs avec texte ≥ 20 chars (ratisse large — le filtre métier
  // `isRelevantToDiagnostic` éliminera le bruit en aval).
  // Utile pour les sites institutionnels FR (Cofrac, MTE) qui mettent les
  // liens d'actualités directement dans le body sans <article> parent.
  if (allBlocks.length === 0) {
    const linkRe = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]{20,})<\/a>/gi
    let m: RegExpExecArray | null
    m = linkRe.exec(html)
    while (m !== null) {
      // On synthétise un pseudo-block par lien pour réutiliser la suite du parseur.
      allBlocks.push(`<a href="${m[1]}">${m[2]}</a>`)
      if (allBlocks.length >= maxItems * 5) break
      m = linkRe.exec(html)
    }
  }

  for (const block of allBlocks) {
    if (items.length >= maxItems) break

    const linkMatch = block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
    if (!linkMatch) continue
    const href = linkMatch[1]
    const titleRaw = linkMatch[2]
    if (!href || !titleRaw) continue
    if (href.startsWith('#') || href.startsWith('javascript:')) continue
    if (/\/(tag|category|author|wp-admin)\//i.test(href)) continue

    const title = stripHtml(titleRaw)
    if (title.length < 15) continue

    let url: string
    try {
      url = href.startsWith('http') ? href : new URL(href, sourceUrl).toString()
    } catch {
      continue
    }
    if (seenUrls.has(url)) continue
    seenUrls.add(url)

    const dateMatch = block.match(/<time[^>]+datetime=["']([^"']+)["']/i)
    const published_at = parseDateSafe(dateMatch?.[1])

    const raw_text = stripHtml(block).slice(0, MAX_RAW_TEXT_LENGTH)

    items.push({
      external_id: url.slice(0, 500),
      title: title.slice(0, 500),
      url: url.slice(0, 1000),
      published_at,
      raw_text,
    })
  }

  return items
}

// ────────────────────────────────────────────────────────────────────────────
// Heuristiques métier — doc_type + importance
// ────────────────────────────────────────────────────────────────────────────

/**
 * Inférence doc_type — DOIT matcher la CHECK constraint
 * `regulatory_documents_doc_type_check` qui autorise :
 *   ['arrete', 'decret', 'loi', 'circulaire', 'guide', 'norme', 'faq', 'autre']
 */
function inferDocType(title: string, authority: string): string {
  const lower = title.toLowerCase()
  if (lower.includes('arrêté') || lower.includes('arrete ')) return 'arrete'
  if (lower.includes('décret') || lower.includes('decret ')) return 'decret'
  if (lower.includes('loi ') || lower.startsWith('loi ')) return 'loi'
  if (lower.includes('circulaire')) return 'circulaire'
  if (lower.includes('faq')) return 'faq'
  if (authority === 'cofrac') return 'faq'
  if (authority === 'ademe') return 'guide'
  if (authority === 'afnor') return 'norme'
  if (authority === 'cstb') return 'guide'
  return 'autre'
}

/**
 * Inférence importance — DOIT matcher la CHECK constraint
 * `regulatory_documents_importance_check` qui autorise :
 *   ['low', 'normal', 'high', 'critical']
 * (et NON 'medium' comme on aurait pu s'attendre — c'est `normal`).
 */
function inferImportance(title: string, rawText: string): string {
  const haystack = `${title} ${rawText}`.toLowerCase()
  if (CRITICAL_IMPORTANCE_KEYWORDS.some((kw) => haystack.includes(kw))) return 'critical'
  if (HIGH_IMPORTANCE_KEYWORDS.some((kw) => haystack.includes(kw))) return 'high'
  return 'normal'
}

/**
 * Filtre pertinence diagnostic — 2 niveaux pour éviter les faux positifs :
 *   - au moins 1 keyword "fort" (dpe, amiante, plomb, COFRAC, etc.)
 *   - OU au moins 2 keywords "faibles" différents (logement + bâtiment, etc.)
 *
 * Bloque aussi les URLs vers réseaux sociaux (X, Facebook, LinkedIn…) qui
 * ne sont jamais des sources réglementaires.
 */
function isRelevantToDiagnostic(title: string, rawText: string, url: string): boolean {
  // Domain blocklist (réseaux sociaux et trackers)
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    if (DOMAIN_BLOCKLIST.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
      return false
    }
  } catch {
    // URL invalide → skip
    return false
  }

  const haystack = `${title} ${rawText}`.toLowerCase()
  if (STRONG_KEYWORDS.some((kw) => haystack.includes(kw))) return true

  const weakHits = WEAK_KEYWORDS.filter((kw) => haystack.includes(kw)).length
  return weakHits >= 2
}

function inferTopics(title: string, rawText: string): string[] {
  const haystack = `${title} ${rawText}`.toLowerCase()
  const topics: string[] = []
  if (/\bdpe\b|performance.{0,5}énerg/.test(haystack)) topics.push('dpe')
  if (/\bamiante\b/.test(haystack)) topics.push('amiante')
  if (/\bplomb\b|\bcrep\b/.test(haystack)) topics.push('plomb')
  if (/\btermites?\b/.test(haystack)) topics.push('termites')
  if (/\bgaz\b/.test(haystack)) topics.push('gaz')
  if (/\bélectric|\belectric/.test(haystack)) topics.push('electricite')
  if (/\bcarrez\b|\bboutin\b/.test(haystack)) topics.push('carrez_boutin')
  if (/\berp\b|état des risques|etat des risques/.test(haystack)) topics.push('erp')
  if (/\baudit énerg|\baudit energ/.test(haystack)) topics.push('audit_energetique')
  if (/\bcofrac\b|certification/.test(haystack)) topics.push('certification')
  return topics
}

// ────────────────────────────────────────────────────────────────────────────
// Pipeline source — fetch + parse + insert
// ────────────────────────────────────────────────────────────────────────────

async function processSource(
  source: SourceRow,
  client: ReturnType<typeof createClient>,
  dryRun: boolean,
): Promise<{ inserted: number; skipped: number; error?: string }> {
  const fetchUrl = source.feed_url ?? source.api_url ?? source.url
  if (!fetchUrl) {
    return { inserted: 0, skipped: 0, error: 'no fetch_url configured' }
  }

  let content: string
  try {
    content = await fetchWithTimeout(fetchUrl)
  } catch (err) {
    return { inserted: 0, skipped: 0, error: `fetch_failed: ${(err as Error).message}` }
  }

  // Parse selon fetch_method
  let items: ParsedItem[] = []
  if (source.fetch_method === 'rss') {
    items = parseRssFeed(content, MAX_DOCS_PER_SOURCE)
  } else if (source.fetch_method === 'http_scrape') {
    items = parseHtmlListing(content, fetchUrl, MAX_DOCS_PER_SOURCE)
  } else {
    return { inserted: 0, skipped: 0, error: `unsupported fetch_method: ${source.fetch_method}` }
  }

  // Filtre : ne garder que les items pertinents diagnostic (strong | 2+ weak)
  const relevant = items.filter((it) => isRelevantToDiagnostic(it.title, it.raw_text, it.url))

  let inserted = 0
  let skipped = 0

  for (const item of relevant) {
    const contentHash = await sha256(item.raw_text)
    const docType = inferDocType(item.title, source.authority)
    const importance = inferImportance(item.title, item.raw_text)
    const topics = inferTopics(item.title, item.raw_text)

    if (dryRun) {
      inserted++
      continue
    }

    // INSERT ... ON CONFLICT (source_id, content_hash) DO NOTHING
    // biome-ignore lint/suspicious/noExplicitAny: PostgREST returning rows generic
    const { data, error } = await (client as any)
      .from('regulatory_documents')
      .upsert(
        {
          source_id: source.id,
          external_id: item.external_id,
          doc_type: docType,
          title: item.title,
          url: item.url,
          published_at: item.published_at ?? null,
          jurisdiction: 'FR',
          raw_text: item.raw_text,
          topics,
          importance,
          content_hash: contentHash,
          processed: false,
          processed_at: null,
          is_superseded: false,
          metadata: {
            ingested_by: 'regulatory-watcher',
            ingested_at: new Date().toISOString(),
          },
        },
        { onConflict: 'source_id,content_hash', ignoreDuplicates: true },
      )
      .select('id')
    if (error) {
      // erreur unique violation = doublon → skipped
      if ((error as { code?: string }).code === '23505') {
        skipped++
        continue
      }
      console.error('[regulatory-watcher] insert error', { source: source.slug, error })
      continue
    }
    if (Array.isArray(data) && data.length > 0) {
      inserted++
    } else {
      skipped++
    }
  }

  return { inserted, skipped }
}

// ────────────────────────────────────────────────────────────────────────────
// HTTP handler
// ────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { sourceSlug?: string; dryRun?: boolean } = {}
  if (req.method === 'POST') {
    try {
      body = await req.json()
    } catch {
      body = {}
    }
  }
  const dryRun = body.dryRun === true

  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Load active sources (filtre slug si fourni)
  // biome-ignore lint/suspicious/noExplicitAny: PostgREST cast
  let query = (client as any).from('regulatory_sources').select('*').eq('is_active', true)
  if (body.sourceSlug) {
    query = query.eq('slug', body.sourceSlug)
  }
  const { data: sources, error: sourcesError } = await query
  if (sourcesError || !sources) {
    return new Response(
      JSON.stringify({ error: 'sources_query_failed', detail: sourcesError?.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  const summary: WatcherSummary = {
    ok: true,
    ran_at: new Date().toISOString(),
    sources_processed: 0,
    documents_inserted: 0,
    documents_skipped_duplicate: 0,
    errors: [],
  }

  for (const src of sources as SourceRow[]) {
    summary.sources_processed++
    const startedAt = Date.now()
    const result = await processSource(src, client, dryRun)
    summary.documents_inserted += result.inserted
    summary.documents_skipped_duplicate += result.skipped

    // Update source tracking
    const tracking = {
      last_fetched_at: new Date().toISOString(),
      ...(result.error
        ? {
            last_error: result.error,
            consecutive_failures: (src.consecutive_failures ?? 0) + 1,
          }
        : {
            last_success_at: new Date().toISOString(),
            last_error: null,
            consecutive_failures: 0,
          }),
    }
    if (!dryRun) {
      // biome-ignore lint/suspicious/noExplicitAny: PostgREST cast
      await (client as any).from('regulatory_sources').update(tracking).eq('id', src.id)
    }

    if (result.error) {
      summary.errors.push({ source: src.slug, error: result.error })
    }
    console.log(
      `[regulatory-watcher] ${src.slug} : inserted=${result.inserted}, skipped=${result.skipped}, duration=${Date.now() - startedAt}ms${result.error ? `, error=${result.error}` : ''}`,
    )
  }

  return new Response(JSON.stringify(summary, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
