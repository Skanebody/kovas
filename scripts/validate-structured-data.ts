#!/usr/bin/env tsx
/**
 * scripts/validate-structured-data.ts — extraction + validation JSON-LD.
 *
 * Pour chaque URL publique, Playwright extrait les `<script type="application/ld+json">`,
 * parse leur contenu et vérifie la structure schema.org minimum :
 *
 *  - `@context` présent et contient "schema.org"
 *  - `@type` présent (string ou array)
 *  - `@type` parmi la whitelist : Organization, LocalBusiness, FAQPage, Article,
 *    BreadcrumbList, Product, Service, WebSite, WebPage (élargissable)
 *
 * Sortie : `reports/jsonld-validation.json`. Exit 1 si invalidité détectée.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { type Browser, chromium } from 'playwright'

const BASE_URL = process.env.SEO_AUDIT_BASE_URL ?? 'http://localhost:3000'
const OUTPUT_PATH = resolve(process.cwd(), 'reports/jsonld-validation.json')

const ALLOWED_TYPES = new Set<string>([
  'Organization',
  'LocalBusiness',
  'FAQPage',
  'Article',
  'BreadcrumbList',
  'Product',
  'Service',
  'WebSite',
  'WebPage',
])

interface JsonLdNodeResult {
  url: string
  index: number
  raw: string
  parsed: unknown
  ok: boolean
  errors: Array<string>
}

interface ValidationReport {
  baseUrl: string
  generatedAt: string
  nodeCount: number
  invalidCount: number
  results: Array<JsonLdNodeResult>
}

const URLS_TO_VALIDATE: ReadonlyArray<string> = [
  '/',
  '/pricing',
  '/faq',
  '/contact',
  '/cgu',
  '/confidentialite',
  '/mentions-legales',
]

function validateNode(parsed: unknown, errors: Array<string>): boolean {
  if (typeof parsed !== 'object' || parsed === null) {
    errors.push('JSON-LD racine n’est pas un objet')
    return false
  }

  const obj = parsed as Record<string, unknown>
  const ctx = obj['@context']
  if (typeof ctx !== 'string' || !ctx.toLowerCase().includes('schema.org')) {
    errors.push('@context manquant ou ne contient pas schema.org')
    return false
  }

  const type = obj['@type']
  if (!type) {
    errors.push('@type manquant')
    return false
  }

  const types = Array.isArray(type) ? type : [type]
  const stringTypes = types.filter((t): t is string => typeof t === 'string')
  if (stringTypes.length === 0) {
    errors.push('@type non-string')
    return false
  }

  const recognized = stringTypes.some((t) => ALLOWED_TYPES.has(t))
  if (!recognized) {
    errors.push(`@type ${stringTypes.join(',')} hors whitelist`)
    return false
  }

  return true
}

async function extractJsonLd(browser: Browser, url: string): Promise<Array<JsonLdNodeResult>> {
  const page = await browser.newPage()
  const out: Array<JsonLdNodeResult> = []

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const rawScripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(
        (n) => n.textContent ?? '',
      )
    })

    rawScripts.forEach((raw, idx) => {
      const errors: Array<string> = []
      let parsed: unknown = null
      let ok = false

      try {
        parsed = JSON.parse(raw)
        ok = validateNode(parsed, errors)
      } catch (err) {
        errors.push(`JSON parse error: ${(err as Error).message}`)
      }

      out.push({ url, index: idx, raw, parsed, ok, errors })
    })

    if (rawScripts.length === 0) {
      out.push({
        url,
        index: 0,
        raw: '',
        parsed: null,
        ok: false,
        errors: ['aucun JSON-LD trouvé'],
      })
    }
  } catch (err) {
    out.push({
      url,
      index: 0,
      raw: '',
      parsed: null,
      ok: false,
      errors: [`navigation error: ${(err as Error).message}`],
    })
  } finally {
    await page.close()
  }

  return out
}

async function main(): Promise<void> {
  console.log(`[validate-jsonld] base URL = ${BASE_URL}`)

  const browser = await chromium.launch({ headless: true })
  const results: Array<JsonLdNodeResult> = []

  for (const path of URLS_TO_VALIDATE) {
    const url = `${BASE_URL}${path}`
    const nodes = await extractJsonLd(browser, url)
    results.push(...nodes)
    const okCount = nodes.filter((n) => n.ok).length
    console.log(`  · ${url} → ${okCount}/${nodes.length} JSON-LD valides`)
  }

  await browser.close()

  const invalidCount = results.filter((r) => !r.ok).length
  const report: ValidationReport = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    nodeCount: results.length,
    invalidCount,
    results,
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8')
  console.log(`[validate-jsonld] rapport : ${OUTPUT_PATH}`)
  console.log(`[validate-jsonld] invalides : ${invalidCount}/${results.length}`)

  if (invalidCount > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[validate-jsonld] échec :', err)
  process.exit(1)
})
