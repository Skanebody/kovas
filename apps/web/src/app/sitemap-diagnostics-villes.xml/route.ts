/**
 * /sitemap-diagnostics-villes.xml — sitemap des pages programmatiques SEO.
 *
 * Couvre 6 patterns d'URL :
 *   - /diagnostic/{type}/{ville}      (9 × N villes)
 *   - /prix/{type}/{ville}            (9 × N villes)
 *   - /urgent/{ville}                 (N villes)
 *   - /comparatif/{type}/{ville}      (9 × N villes)
 *   - /audit-energetique/{ville}      (N villes)
 *   - /maprimerenov/{ville}           (N villes)
 *
 * Volume V1 (213 villes registry) : 6 390 URLs (sous limite 50k).
 *
 * Priorités sitemap :
 *   - /diagnostic/, /prix/ : 0.6 (longue traîne forte)
 *   - /comparatif/ : 0.55
 *   - /urgent/ : 0.5 (saisonnier)
 *   - /audit-energetique/, /maprimerenov/ : 0.55 (réglementaire)
 *
 * Note : si volume dépasse 50k URLs (sprint V2 avec 1000+ villes), passer en
 * sitemap-index paginé via Next.js `generateSitemaps`.
 */

import { CITIES } from '@/lib/cities/registry'
import { DIAGNOSTIC_TYPES } from '@/lib/diagnostics/types'

export const dynamic = 'force-static'
export const revalidate = 86400

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'

interface SitemapEntry {
  readonly loc: string
  readonly priority: number
  readonly changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

function priorityForCity(priority: 'top' | 'mid' | 'low'): number {
  if (priority === 'top') return 0.1
  if (priority === 'mid') return 0
  return -0.05
}

function buildEntries(): ReadonlyArray<SitemapEntry> {
  const entries: SitemapEntry[] = []

  for (const city of CITIES) {
    const boost = priorityForCity(city.priority)

    for (const type of DIAGNOSTIC_TYPES) {
      entries.push({
        loc: `${BASE_URL}/diagnostic/${type}/${city.slug}`,
        priority: Math.max(0.3, Math.min(0.9, 0.6 + boost)),
        changefreq: 'monthly',
      })
      entries.push({
        loc: `${BASE_URL}/prix/${type}/${city.slug}`,
        priority: Math.max(0.3, Math.min(0.9, 0.6 + boost)),
        changefreq: 'monthly',
      })
      entries.push({
        loc: `${BASE_URL}/comparatif/${type}/${city.slug}`,
        priority: Math.max(0.3, Math.min(0.9, 0.55 + boost)),
        changefreq: 'monthly',
      })
    }

    entries.push({
      loc: `${BASE_URL}/urgent/${city.slug}`,
      priority: Math.max(0.3, Math.min(0.9, 0.5 + boost)),
      changefreq: 'weekly',
    })
    entries.push({
      loc: `${BASE_URL}/audit-energetique/${city.slug}`,
      priority: Math.max(0.3, Math.min(0.9, 0.55 + boost)),
      changefreq: 'monthly',
    })
    entries.push({
      loc: `${BASE_URL}/maprimerenov/${city.slug}`,
      priority: Math.max(0.3, Math.min(0.9, 0.55 + boost)),
      changefreq: 'monthly',
    })
  }

  return entries
}

export function GET(): Response {
  const lastmod = new Date().toISOString()
  const entries = buildEntries()

  const urls = entries
    .map((entry) =>
      [
        '  <url>',
        `    <loc>${entry.loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority.toFixed(2)}</priority>`,
        '  </url>',
      ].join('\n'),
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
