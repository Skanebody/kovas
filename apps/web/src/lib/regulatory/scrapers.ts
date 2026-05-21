/**
 * KOVAS — Scrapers réglementaires (Node.js / Next.js side).
 *
 * Helpers utilisés par les API routes Next.js et les futurs tests Vitest.
 * NB : les Edge Functions Supabase (Deno) ont une copie locale de ces fonctions
 * car le runtime Deno ne peut pas importer depuis le monorepo Node.
 * Toute évolution doit être propagée dans `supabase/functions/regulatory-watcher/index.ts`.
 *
 * V1 — sans dépendance XML lourde : regex + heuristiques.
 * V1.5 — TODO :
 *   - Brancher l'API PISTE Légifrance officielle (OAuth2 client_credentials).
 *     Endpoint : https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/consult/jorf
 *     Avantages : structuration JORF native, identification d'arrêté, hash stable.
 *   - Brancher ADEME Open Data API (datasets DPE 2021, statistiques DPE).
 */

export type SourceType = 'rss' | 'html_scraping' | 'api' | 'legifrance' | 'sitemap'

export interface ScrapedDocument {
  reference: string
  title: string
  publication_date?: string
  document_type: string
  full_text: string
  full_text_url: string
  full_text_hash: string
}

// ────────────────────────────────────────────────────────────
// SHA-256 helper compatible Node 18+ (Web Crypto API natif)
// ────────────────────────────────────────────────────────────

export async function sha256(text: string): Promise<string> {
  const buffer = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ────────────────────────────────────────────────────────────
// Utils XML/HTML
// ────────────────────────────────────────────────────────────

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = block.match(re)
  if (!m) return ''
  const raw = m[1] ?? ''
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  return (cdata ? cdata[1] : raw) ?? ''
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
    .replace(/\s+/g, ' ')
}

function parseDateSafe(input: string | null | undefined): string | undefined {
  if (!input) return undefined
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString().slice(0, 10)
}

const USER_AGENT = 'KOVAS-RegulatoryWatcher/1.0 (kovas.fr)'

// ────────────────────────────────────────────────────────────
// RSS / Atom
// ────────────────────────────────────────────────────────────

export async function scrapeRss(url: string): Promise<ScrapedDocument[]> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`RSS ${url} HTTP ${res.status}`)
  const xml = await res.text()

  const items: ScrapedDocument[] = []
  const itemRegex = /<(item|entry)>([\s\S]*?)<\/\1>/gi
  let match: RegExpExecArray | null = itemRegex.exec(xml)
  while (match !== null) {
    const block = match[2] ?? ''
    const titleRaw = extractTag(block, 'title')
    const linkRaw =
      extractTag(block, 'link') ||
      block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ||
      ''
    const desc =
      extractTag(block, 'description') ||
      extractTag(block, 'content') ||
      extractTag(block, 'summary') ||
      ''
    const pubDate =
      extractTag(block, 'pubDate') ||
      extractTag(block, 'published') ||
      extractTag(block, 'updated') ||
      ''
    const guid = extractTag(block, 'guid') || linkRaw || titleRaw

    if (titleRaw && linkRaw) {
      const title = stripHtml(titleRaw).trim()
      const fullText = `${title}\n\n${stripHtml(desc).trim()}`
      const hash = await sha256(fullText)
      items.push({
        reference: stripHtml(guid).trim().slice(0, 200),
        title,
        publication_date: parseDateSafe(pubDate),
        document_type: 'rss_item',
        full_text: fullText,
        full_text_url: linkRaw.trim(),
        full_text_hash: hash,
      })
    }
    match = itemRegex.exec(xml)
  }
  return items
}

// ────────────────────────────────────────────────────────────
// HTML scraping générique
// ────────────────────────────────────────────────────────────

export async function scrapeHtml(
  url: string,
  config: Record<string, unknown> | null,
): Promise<ScrapedDocument[]> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTML ${url} HTTP ${res.status}`)
  const html = await res.text()

  const linkPattern = String(config?.['linkPattern'] ?? 'actualite')
  const docs: ScrapedDocument[] = []
  const anchorRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null = anchorRegex.exec(html)
  let count = 0
  while (m !== null && count < 50) {
    const href = m[1] ?? ''
    const label = stripHtml(m[2] ?? '').trim()
    if (
      label.length >= 20 &&
      /actualit|publication|texte|arrêté|décret/i.test(label) &&
      href.includes(linkPattern.replace(/^.*\*/, '').replace(/[\]"\[]/g, ''))
    ) {
      const absUrl = href.startsWith('http') ? href : new URL(href, url).toString()
      const hash = await sha256(`${label}\n${absUrl}`)
      docs.push({
        reference: absUrl.slice(0, 200),
        title: label.slice(0, 500),
        document_type: 'html_news_item',
        full_text: label,
        full_text_url: absUrl,
        full_text_hash: hash,
      })
      count++
    }
    m = anchorRegex.exec(html)
  }
  return docs
}

// ────────────────────────────────────────────────────────────
// Légifrance — placeholder (TODO API PISTE)
// ────────────────────────────────────────────────────────────

/**
 * Scraper Légifrance V1 — fragile.
 *
 * TODO V1.5 : migrer sur l'API PISTE officielle (OAuth2 client_credentials).
 * Endpoints utiles :
 *   - POST /consult/jorf       → liste JORF (Journal Officiel)
 *   - POST /consult/legi       → texte consolidé
 *   - POST /search             → recherche full-text
 *
 * En attendant : on capte le hash de la page comme signal de changement.
 */
export async function scrapeLegifranceHtml(
  url: string,
  _config: Record<string, unknown> | null,
): Promise<ScrapedDocument[]> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) throw new Error(`Legifrance ${url} HTTP ${res.status}`)
    const html = await res.text()
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = stripHtml(titleMatch?.[1] ?? 'Légifrance').trim().slice(0, 500)
    const fullText = stripHtml(html).slice(0, 50_000)
    const hash = await sha256(fullText)
    return [
      {
        reference: url.slice(0, 200),
        title,
        document_type: 'legifrance_page',
        full_text: fullText,
        full_text_url: url,
        full_text_hash: hash,
      },
    ]
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[scrapeLegifranceHtml] error:', err)
    return []
  }
}

// ────────────────────────────────────────────────────────────
// ADEME Open Data — datasets nouveaux ou modifiés
// ────────────────────────────────────────────────────────────

/**
 * Détecte les datasets ADEME Open Data nouveaux ou modifiés.
 * Source attendue : https://data.ademe.fr/ (CKAN-like, expose souvent /api/3/action/recently_changed_packages_activity_list).
 *
 * V1 : récupère un sitemap/listing et capte le hash global pour signaler un changement.
 */
export async function scrapeAdemeOpendata(url: string): Promise<ScrapedDocument[]> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) throw new Error(`ADEME ${url} HTTP ${res.status}`)
    const text = await res.text()

    // Tente JSON CKAN (action_list ou package_list)
    try {
      const json = JSON.parse(text) as {
        result?: Array<{ id?: string; name?: string; title?: string; metadata_modified?: string }>
      }
      if (Array.isArray(json.result)) {
        const docs: ScrapedDocument[] = []
        for (const pkg of json.result.slice(0, 100)) {
          const ref = pkg.id ?? pkg.name ?? ''
          const title = pkg.title ?? pkg.name ?? '(dataset sans titre)'
          if (!ref) continue
          const payload = JSON.stringify(pkg)
          const hash = await sha256(payload)
          docs.push({
            reference: ref.slice(0, 200),
            title: title.slice(0, 500),
            publication_date: parseDateSafe(pkg.metadata_modified),
            document_type: 'ademe_dataset',
            full_text: payload,
            full_text_url: `${url.replace(/\/?$/, '/')}${ref}`,
            full_text_hash: hash,
          })
        }
        return docs
      }
    } catch {
      // Non-JSON → fallback hash global
    }

    const hash = await sha256(stripHtml(text).slice(0, 50_000))
    return [
      {
        reference: url.slice(0, 200),
        title: 'ADEME Open Data — listing',
        document_type: 'ademe_listing',
        full_text: stripHtml(text).slice(0, 50_000),
        full_text_url: url,
        full_text_hash: hash,
      },
    ]
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[scrapeAdemeOpendata] error:', err)
    return []
  }
}

// ────────────────────────────────────────────────────────────
// Sitemap
// ────────────────────────────────────────────────────────────

export async function scrapeSitemap(url: string): Promise<ScrapedDocument[]> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Sitemap ${url} HTTP ${res.status}`)
  const xml = await res.text()
  const urlRegex = /<url>([\s\S]*?)<\/url>/gi
  const docs: ScrapedDocument[] = []
  let m: RegExpExecArray | null = urlRegex.exec(xml)
  while (m !== null && docs.length < 200) {
    const block = m[1] ?? ''
    const loc = extractTag(block, 'loc')
    const lastmod = extractTag(block, 'lastmod')
    if (loc) {
      const hash = await sha256(`${loc}|${lastmod}`)
      docs.push({
        reference: loc.slice(0, 200),
        title: loc.slice(0, 500),
        publication_date: parseDateSafe(lastmod),
        document_type: 'sitemap_url',
        full_text: `${loc}\n${lastmod}`,
        full_text_url: loc,
        full_text_hash: hash,
      })
    }
    m = urlRegex.exec(xml)
  }
  return docs
}

// ────────────────────────────────────────────────────────────
// Dispatcher
// ────────────────────────────────────────────────────────────

export async function scrapeBySourceType(
  type: SourceType,
  url: string,
  config: Record<string, unknown> | null,
): Promise<ScrapedDocument[]> {
  switch (type) {
    case 'rss':
      return scrapeRss(url)
    case 'html_scraping':
      return scrapeHtml(url, config)
    case 'legifrance':
    case 'api':
      return scrapeLegifranceHtml(url, config)
    case 'sitemap':
      return scrapeSitemap(url)
    default:
      return []
  }
}
