// KOVAS — Edge Function `regulatory-watcher`
//
// Cron horaire (à brancher via Supabase Cron / pg_cron / GitHub Action) :
//
//     SCHEDULE: 0 * * * *   (toutes les heures, à HH:00 UTC)
//
// Exemple de configuration via pg_cron (à exécuter dans la migration cron) :
//
//     SELECT cron.schedule(
//       'regulatory-watcher-hourly',
//       '0 * * * *',
//       $$ SELECT net.http_post(
//            url := current_setting('app.settings.supabase_functions_url') || '/regulatory-watcher',
//            headers := jsonb_build_object(
//              'Content-Type', 'application/json',
//              'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
//            )
//          ); $$
//     );
//
// Responsabilité :
// 1. Lister les sources actives à re-vérifier (last_check_at + check_interval_hours).
// 2. Scraper chaque source selon `source_type` (rss | html_scraping | api | legifrance | sitemap).
// 3. Pour chaque document extrait : déduplication par (source_id, reference) + hash sha-256.
//    - Nouveau document  → INSERT + appel regulatory-analyze
//    - Hash changé       → UPDATE + appel regulatory-analyze (modification)
// 4. Update `last_check_at` (succès ou erreur) pour éviter la boucle de re-tentatives.
//
// IMPORTANT : ne PLANTE PAS le worker si une source down — log + continue.

/// <reference lib="deno.ns" />
// deno-lint-ignore-file no-explicit-any

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ────────────────────────────────────────────────────────────
// Types miroir du schéma DB (les types Database des migrations
// n'étant pas encore générés pour les nouvelles tables).
// ────────────────────────────────────────────────────────────

type SourceType = 'rss' | 'html_scraping' | 'api' | 'legifrance' | 'sitemap'

interface RegulatorySource {
  id: string
  source_name: string
  source_url: string
  source_type: SourceType
  scraping_strategy: string | null
  scraping_config: Record<string, unknown> | null
  check_interval_hours: number
  last_check_at: string | null
  last_change_detected_at: string | null
  active: boolean
}

interface ScrapedDocument {
  reference: string
  title: string
  publication_date?: string // ISO date
  document_type: string
  full_text: string
  full_text_url: string
  full_text_hash: string
}

interface RegulatoryDocumentRow {
  id: string
  source_id: string
  reference: string
  full_text_hash: string | null
}

// ────────────────────────────────────────────────────────────
// SHA-256 helper (Deno Web Crypto)
// ────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buffer = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ────────────────────────────────────────────────────────────
// Scrapers (inlines, dupliqués depuis apps/web/src/lib/regulatory/scrapers.ts
// car Deno Edge Runtime n'a pas accès au monorepo Node).
// ────────────────────────────────────────────────────────────

/** Parse un flux RSS/Atom minimal — sans dépendance XML lourde. */
async function scrapeRss(url: string): Promise<ScrapedDocument[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'KOVAS-RegulatoryWatcher/1.0 (kovas.fr)' },
  })
  if (!res.ok) throw new Error(`RSS ${url} HTTP ${res.status}`)
  const xml = await res.text()

  const items: ScrapedDocument[] = []
  const itemRegex = /<(item|entry)>([\s\S]*?)<\/\1>/gi
  let match: RegExpExecArray | null
  match = itemRegex.exec(xml)
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

    if (!titleRaw || !linkRaw) {
      match = itemRegex.exec(xml)
      continue
    }
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
    match = itemRegex.exec(xml)
  }
  return items
}

/**
 * Scraping HTML générique selon `scraping_config.selector` (regex ou marqueurs).
 * Approche V1 : regex sur balises (sans DOM lib lourde côté Deno).
 * Pour les sources complexes (Légifrance, Cofrac), prévoir des scrapers dédiés.
 */
async function scrapeHtml(
  url: string,
  config: Record<string, unknown> | null,
): Promise<ScrapedDocument[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'KOVAS-RegulatoryWatcher/1.0 (kovas.fr)' },
  })
  if (!res.ok) throw new Error(`HTML ${url} HTTP ${res.status}`)
  const html = await res.text()

  const linkPattern = String(config?.['linkPattern'] ?? 'a[href*="actualite"]')
  // Très conservatif : extrait les <a href> dont le texte > 20 chars,
  // utilisable comme premier signal "page de news a changé".
  const links: ScrapedDocument[] = []
  const anchorRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  m = anchorRegex.exec(html)
  let count = 0
  while (m !== null && count < 50) {
    const href = m[1] ?? ''
    const label = stripHtml(m[2] ?? '').trim()
    if (label.length >= 20 && /actualit|publication|texte|arrêté|décret/i.test(label)) {
      const absUrl = href.startsWith('http') ? href : new URL(href, url).toString()
      const hash = await sha256(`${label}\n${absUrl}`)
      links.push({
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
  // linkPattern reste un signal V1 - exposé en log pour audit
  console.log(`[scrapeHtml] linkPattern hint: ${linkPattern} (${links.length} liens extraits)`)
  return links
}

/**
 * Scraper Légifrance — V1 placeholder.
 *
 * TODO V1.5 : brancher l'API PISTE officielle (OAuth2 client_credentials).
 * Doc : https://piste.gouv.fr/index.php?option=com_apiportal&view=apitester&apiId=...
 *
 * En attendant : on appelle l'URL fournie et on récupère un signal de changement
 * via le hash de la page (utile pour détecter qu'un sommaire a bougé).
 */
async function scrapeLegifrance(
  url: string,
  _config: Record<string, unknown> | null,
): Promise<ScrapedDocument[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'KOVAS-RegulatoryWatcher/1.0 (kovas.fr)' },
    })
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
    console.error('[scrapeLegifrance] error:', err)
    return []
  }
}

/** Parse un sitemap.xml et retourne 1 doc-signal par URL listée (avec lastmod). */
async function scrapeSitemap(url: string): Promise<ScrapedDocument[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'KOVAS-RegulatoryWatcher/1.0 (kovas.fr)' },
  })
  if (!res.ok) throw new Error(`Sitemap ${url} HTTP ${res.status}`)
  const xml = await res.text()
  const urlRegex = /<url>([\s\S]*?)<\/url>/gi
  const docs: ScrapedDocument[] = []
  let m: RegExpExecArray | null
  m = urlRegex.exec(xml)
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
// Utilitaires XML/HTML
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
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

// ────────────────────────────────────────────────────────────
// Dispatcher
// ────────────────────────────────────────────────────────────

async function scrapeOne(source: RegulatorySource): Promise<ScrapedDocument[]> {
  switch (source.source_type) {
    case 'rss':
      return await scrapeRss(source.source_url)
    case 'html_scraping':
      return await scrapeHtml(source.source_url, source.scraping_config)
    case 'legifrance':
    case 'api':
      return await scrapeLegifrance(source.source_url, source.scraping_config)
    case 'sitemap':
      return await scrapeSitemap(source.source_url)
    default:
      console.warn(`[regulatory-watcher] unknown source_type=${source.source_type as string}`)
      return []
  }
}

// ────────────────────────────────────────────────────────────
// Persistance + déclenchement analyse
// ────────────────────────────────────────────────────────────

async function persistDocument(
  client: SupabaseClient,
  source: RegulatorySource,
  scraped: ScrapedDocument,
): Promise<{ documentId: string; isNew: boolean; isModification: boolean } | null> {
  const { data: existing } = await (client as any)
    .from('regulatory_documents')
    .select('id, full_text_hash')
    .eq('source_id', source.id)
    .eq('reference', scraped.reference)
    .maybeSingle()

  const existingRow = existing as Pick<RegulatoryDocumentRow, 'id' | 'full_text_hash'> | null

  if (!existingRow) {
    const insert = await (client as any)
      .from('regulatory_documents')
      .insert({
        source_id: source.id,
        document_type: scraped.document_type,
        reference: scraped.reference,
        title: scraped.title,
        publication_date: scraped.publication_date ?? null,
        full_text: scraped.full_text,
        full_text_url: scraped.full_text_url,
        full_text_hash: scraped.full_text_hash,
        processed: false,
        processing_status: 'pending',
        is_modification: false,
      })
      .select('id')
      .single()
    if (insert.error) {
      console.error('[regulatory-watcher] insert error:', insert.error.message)
      return null
    }
    return { documentId: (insert.data as { id: string }).id, isNew: true, isModification: false }
  }

  if (existingRow.full_text_hash !== scraped.full_text_hash) {
    const upd = await (client as any)
      .from('regulatory_documents')
      .update({
        title: scraped.title,
        full_text: scraped.full_text,
        full_text_hash: scraped.full_text_hash,
        processed: false,
        processing_status: 'pending',
        is_modification: true,
        modifies_document_id: existingRow.id,
        change_summary: 'Contenu modifié, ré-analyse en attente',
      })
      .eq('id', existingRow.id)
    if (upd.error) {
      console.error('[regulatory-watcher] update error:', upd.error.message)
      return null
    }
    return { documentId: existingRow.id, isNew: false, isModification: true }
  }

  return null // pas de changement
}

async function triggerAnalyze(documentId: string): Promise<void> {
  const supaUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supaUrl || !serviceKey) {
    console.error('[regulatory-watcher] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return
  }
  try {
    const res = await fetch(`${supaUrl}/functions/v1/regulatory-analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ documentId }),
    })
    if (!res.ok) {
      console.error(`[regulatory-watcher] analyze trigger failed: HTTP ${res.status}`)
    }
  } catch (err) {
    console.error('[regulatory-watcher] analyze trigger exception:', err)
  }
}

// ────────────────────────────────────────────────────────────
// Handler principal
// ────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  const startedAt = Date.now()
  const supaUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supaUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'missing supabase env' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const client = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Récupérer les sources actives à re-vérifier
  // (filtrage côté serveur : interval comparé en TypeScript car postgrest
  // ne permet pas de comparer à une expression d'interval dérivée d'une colonne.)
  const { data: rawSources, error: srcErr } = await (client as any)
    .from('regulatory_sources')
    .select(
      'id, source_name, source_url, source_type, scraping_strategy, scraping_config, check_interval_hours, last_check_at, last_change_detected_at, active',
    )
    .eq('active', true)

  if (srcErr) {
    return new Response(
      JSON.stringify({ ok: false, error: srcErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const allSources: RegulatorySource[] = Array.isArray(rawSources)
    ? (rawSources as RegulatorySource[])
    : []
  const now = Date.now()
  const dueSources = allSources.filter((s) => {
    if (!s.last_check_at) return true
    const last = new Date(s.last_check_at).getTime()
    const intervalMs = (s.check_interval_hours ?? 1) * 3600_000
    return now - last >= intervalMs
  })

  console.log(
    `[regulatory-watcher] ${dueSources.length}/${allSources.length} sources due (active)`,
  )

  // 2. Scraper chaque source — isolé pour ne pas planter le batch
  const results: Array<{
    source: string
    found: number
    new: number
    modified: number
    error?: string
  }> = []

  for (const source of dueSources) {
    let found = 0
    let newCount = 0
    let modifiedCount = 0
    let errMsg: string | undefined

    try {
      console.log(
        `[regulatory-watcher] scraping "${source.source_name}" (${source.source_type}) ${source.source_url}`,
      )
      const scraped = await scrapeOne(source)
      found = scraped.length
      for (const doc of scraped) {
        const persist = await persistDocument(client, source, doc)
        if (persist) {
          if (persist.isNew) newCount++
          if (persist.isModification) modifiedCount++
          await triggerAnalyze(persist.documentId)
        }
      }
    } catch (err) {
      errMsg = (err as Error).message ?? String(err)
      console.error(`[regulatory-watcher] source "${source.source_name}" failed:`, errMsg)
    }

    // 3. Update last_check_at (succès ou erreur — toujours)
    const patch: Record<string, unknown> = { last_check_at: new Date().toISOString() }
    if (newCount + modifiedCount > 0) patch['last_change_detected_at'] = new Date().toISOString()
    const { error: updateErr } = await (client as any)
      .from('regulatory_sources')
      .update(patch)
      .eq('id', source.id)
    if (updateErr) {
      console.error('[regulatory-watcher] last_check_at update failed:', updateErr.message)
    }

    results.push({
      source: source.source_name,
      found,
      new: newCount,
      modified: modifiedCount,
      error: errMsg,
    })
  }

  const durationMs = Date.now() - startedAt
  console.log(
    `[regulatory-watcher] done in ${durationMs}ms`,
    JSON.stringify(results),
  )

  return new Response(
    JSON.stringify({
      ok: true,
      duration_ms: durationMs,
      sources_checked: dueSources.length,
      results,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
