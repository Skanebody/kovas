#!/usr/bin/env tsx
/**
 * scripts/seo-audit.ts — audit on-page SEO baseline.
 *
 * Crawl du sitemap.xml local ou distant (variable `SEO_AUDIT_BASE_URL`),
 * puis pour chaque URL, contrôle des essentiels :
 *
 *  - <title> entre 30 et 70 caractères
 *  - <meta name="description"> entre 120 et 170 caractères
 *  - exactement 1 <h1>
 *  - <link rel="canonical"> présent
 *  - <meta property="og:*"> minimum (title, description, image, url)
 *  - <meta name="twitter:card"> = summary_large_image
 *  - au moins un <script type="application/ld+json"> parseable
 *  - aucun <img alt=""> (ou alt manquant)
 *  - absence de <meta name="robots" content="noindex">
 *
 * Sortie :
 *  - JSON détaillé dans `reports/seo-audit.json`
 *  - exit code 1 si ≥ 1 anomalie bloquante détectée
 *
 * Lancement : `pnpm seo:audit` (depuis la racine). Base URL configurable :
 *   `SEO_AUDIT_BASE_URL=https://kovas.fr pnpm seo:audit`
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { type Browser, type Page, chromium } from 'playwright'

interface PageAudit {
  url: string
  status: number
  title: string | null
  titleLength: number
  description: string | null
  descriptionLength: number
  h1Count: number
  canonical: string | null
  og: Readonly<Record<string, string>>
  twitter: Readonly<Record<string, string>>
  jsonLdCount: number
  jsonLdValid: number
  imagesWithoutAlt: number
  totalImages: number
  noindex: boolean
  issues: Array<string>
}

interface AuditReport {
  baseUrl: string
  generatedAt: string
  pageCount: number
  blockingIssueCount: number
  warningCount: number
  pages: Array<PageAudit>
}

const TITLE_MIN = 30
const TITLE_MAX = 70
const DESC_MIN = 120
const DESC_MAX = 170

const BASE_URL = process.env.SEO_AUDIT_BASE_URL ?? 'http://localhost:3000'
const OUTPUT_PATH = resolve(process.cwd(), 'reports/seo-audit.json')

/**
 * Liste les URLs à auditer.
 * En l'absence d'un sitemap accessible localement, on retombe sur une liste
 * statique des pages publiques connues — suffisant pour la baseline.
 */
async function listUrlsToAudit(): Promise<Array<string>> {
  const sitemapUrl = `${BASE_URL}/sitemap.xml`
  try {
    const res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      throw new Error(`sitemap HTTP ${res.status}`)
    }
    const xml = await res.text()
    const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    if (matches.length > 0) {
      return matches.map((m) => m[1] ?? '').filter(Boolean)
    }
  } catch (err) {
    console.warn(
      `[seo-audit] sitemap.xml indisponible (${(err as Error).message}), fallback liste statique.`,
    )
  }

  return [
    `${BASE_URL}/`,
    `${BASE_URL}/pricing`,
    `${BASE_URL}/faq`,
    `${BASE_URL}/contact`,
    `${BASE_URL}/cgu`,
    `${BASE_URL}/confidentialite`,
    `${BASE_URL}/mentions-legales`,
  ]
}

async function auditPage(browser: Browser, url: string): Promise<PageAudit> {
  const page: Page = await browser.newPage()
  const audit: PageAudit = {
    url,
    status: 0,
    title: null,
    titleLength: 0,
    description: null,
    descriptionLength: 0,
    h1Count: 0,
    canonical: null,
    og: {},
    twitter: {},
    jsonLdCount: 0,
    jsonLdValid: 0,
    imagesWithoutAlt: 0,
    totalImages: 0,
    noindex: false,
    issues: [],
  }

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    audit.status = response?.status() ?? 0

    if (audit.status >= 400) {
      audit.issues.push(`HTTP ${audit.status}`)
      return audit
    }

    const meta = await page.evaluate(() => {
      const og: Record<string, string> = {}
      const twitter: Record<string, string> = {}

      for (const el of Array.from(document.querySelectorAll('meta[property^="og:"]'))) {
        const k = el.getAttribute('property')
        const v = el.getAttribute('content')
        if (k && v) og[k] = v
      }
      for (const el of Array.from(document.querySelectorAll('meta[name^="twitter:"]'))) {
        const k = el.getAttribute('name')
        const v = el.getAttribute('content')
        if (k && v) twitter[k] = v
      }

      const robotsMeta = document
        .querySelector('meta[name="robots"]')
        ?.getAttribute('content')
        ?.toLowerCase()

      const imgs = Array.from(document.querySelectorAll('img'))
      const totalImages = imgs.length
      const imagesWithoutAlt = imgs.filter(
        (img) => !img.getAttribute('alt') || img.getAttribute('alt')?.trim() === '',
      ).length

      const jsonLdNodes = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]'),
      )

      return {
        title: document.title,
        description:
          document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
        h1Count: document.querySelectorAll('h1').length,
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
        og,
        twitter,
        jsonLdRaw: jsonLdNodes.map((n) => n.textContent ?? ''),
        totalImages,
        imagesWithoutAlt,
        noindex: robotsMeta?.includes('noindex') ?? false,
      }
    })

    audit.title = meta.title
    audit.titleLength = meta.title?.length ?? 0
    audit.description = meta.description
    audit.descriptionLength = meta.description?.length ?? 0
    audit.h1Count = meta.h1Count
    audit.canonical = meta.canonical
    audit.og = meta.og
    audit.twitter = meta.twitter
    audit.totalImages = meta.totalImages
    audit.imagesWithoutAlt = meta.imagesWithoutAlt
    audit.noindex = meta.noindex
    audit.jsonLdCount = meta.jsonLdRaw.length

    for (const raw of meta.jsonLdRaw) {
      try {
        const parsed = JSON.parse(raw) as { '@context'?: string; '@type'?: string }
        if (parsed['@context']?.includes('schema.org') && parsed['@type']) {
          audit.jsonLdValid += 1
        }
      } catch {
        audit.issues.push('JSON-LD non parseable')
      }
    }

    // ── Détection des anomalies bloquantes ────────────────────────────────
    if (!audit.title || audit.titleLength < TITLE_MIN || audit.titleLength > TITLE_MAX) {
      audit.issues.push(`title hors plage [${TITLE_MIN}-${TITLE_MAX}] (${audit.titleLength} chars)`)
    }
    if (
      !audit.description ||
      audit.descriptionLength < DESC_MIN ||
      audit.descriptionLength > DESC_MAX
    ) {
      audit.issues.push(
        `meta description hors plage [${DESC_MIN}-${DESC_MAX}] (${audit.descriptionLength} chars)`,
      )
    }
    if (audit.h1Count !== 1) {
      audit.issues.push(`nombre de H1 attendu = 1, trouvé ${audit.h1Count}`)
    }
    if (!audit.canonical) {
      audit.issues.push('canonical manquant')
    }
    if (!audit.og['og:title'] || !audit.og['og:description'] || !audit.og['og:image']) {
      audit.issues.push('OG title/description/image incomplets')
    }
    if (audit.twitter['twitter:card'] !== 'summary_large_image') {
      audit.issues.push('twitter:card devrait être summary_large_image')
    }
    if (audit.jsonLdValid === 0) {
      audit.issues.push('aucun JSON-LD schema.org valide détecté')
    }
    if (audit.imagesWithoutAlt > 0) {
      audit.issues.push(`${audit.imagesWithoutAlt} image(s) sans alt sur ${audit.totalImages}`)
    }
    if (audit.noindex) {
      audit.issues.push('robots noindex actif')
    }
  } catch (err) {
    audit.issues.push(`exception: ${(err as Error).message}`)
  } finally {
    await page.close()
  }

  return audit
}

async function main(): Promise<void> {
  console.log(`[seo-audit] base URL = ${BASE_URL}`)

  const urls = await listUrlsToAudit()
  console.log(`[seo-audit] ${urls.length} URL(s) à auditer`)

  const browser = await chromium.launch({ headless: true })
  const pages: Array<PageAudit> = []

  for (const url of urls) {
    const result = await auditPage(browser, url)
    pages.push(result)
    const status = result.issues.length === 0 ? 'OK' : `${result.issues.length} issue(s)`
    console.log(`  · ${url} → ${status}`)
  }

  await browser.close()

  const blockingIssueCount = pages.reduce((acc, p) => acc + p.issues.length, 0)
  const report: AuditReport = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    pageCount: pages.length,
    blockingIssueCount,
    warningCount: 0,
    pages,
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8')
  console.log(`[seo-audit] rapport écrit : ${OUTPUT_PATH}`)
  console.log(`[seo-audit] total issues : ${blockingIssueCount}`)

  if (blockingIssueCount > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[seo-audit] échec :', err)
  process.exit(1)
})
